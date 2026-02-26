import { Job, Worker } from "bullmq";
import type { InternalEvent, MessageRecord } from "@acx/shared";

import { ConsoleAuditLogger } from "./infra/audit.js";
import { triggerQueue, QUEUE_CONNECTION } from "./queue.js";
import { evaluateTriggers } from "@acx/trigger-engine";
import { SupabaseContinuityStore } from "@acx/memory";
import { TelegramConnector } from "@acx/connectors";
import { HubSpotAdapter } from "@acx/connectors";

/**
 * BullMQ worker for async trigger processing.
 * - Keeps orchestrator stateless and response path fast.
 * - In production: use Postgres-backed stores + real CRM adapters + alerting.
 */

const audit = new ConsoleAuditLogger();

// For MVP: use same in-memory store shape. In production, this would be a shared DB-backed store.
const store = new SupabaseContinuityStore();
const crm = new HubSpotAdapter(process.env.HUBSPOT_ACCESS_TOKEN || "");

interface TriggerJobData {
  customerId: string;
  event: InternalEvent;
  recentMessages: MessageRecord[];
}

const worker = new Worker(
  triggerQueue.name,
  async (job: Job<TriggerJobData>) => {
    if (job.name !== "evaluate_triggers") return;

    const { customerId, event, recentMessages } = job.data;

    const result = await evaluateTriggers(
      { store, crm },
      {
        customerId,
        event,
        recentMessages,
      },
    );

    await audit.write({
      at: new Date().toISOString(),
      actor: "system",
      action: "trigger_job_processed",
      resourceType: "bullmq_job",
      resourceId: String(job.id),
      details: {
        customerId,
        signals: result.signals,
        actions: result.actions,
      },
    });

    // Dispatch stubs:
    // - escalate: send to pager/slack
    // - pivot_to_sales: create lead/opportunity
    // - crm_sync: call CRM adapter
    // - admin_alert: send Telegram alert to TELEGRAM_ADMIN_CHAT_ID
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
    const tg = new TelegramConnector({ botToken: botToken || "" });

    for (const action of result.actions) {
      switch (action.type) {
        case "admin_alert":
        case "escalate":
          if (botToken && adminChatId) {
            await tg.sendAdminAlert({
              customerId,
              customerName: "Unknown", // avoid PII; wire to CRM/profile later
              churnRisk: result.signals.churnRisk,
              sentimentEma: result.signals.sentimentEma,
              channel: event?.channel ?? "unknown",
              textPreviewRedacted: (event?.text ?? "").slice(0, 200),
            });
          }
          break;
        case "crm_sync":
          if (crm) {
            const profile = await store.getCustomerProfile(customerId);
            await crm.upsertContact(profile);
          }
          break;
        case "pivot_to_sales":
          if (crm) {
            await crm.createDeal(customerId);
          }
          break;
      }
    }

    return result;
  },
  {
    connection: QUEUE_CONNECTION,
  },
);

worker.on("failed", async (job: Job | undefined, err: Error) => {
  await audit.write({
    at: new Date().toISOString(),
    actor: "system",
    action: "trigger_job_failed",
    resourceType: "bullmq_job",
    resourceId: String(job?.id ?? "unknown"),
    details: { error: err.message },
  });
});

// Start worker process
console.log("[worker] BullMQ trigger worker started");
