import { Worker } from "bullmq";

import { ConsoleAuditLogger } from "./audit.js";
import { triggerQueue } from "./queue.js";
import { InMemoryContinuityStore } from "./store/inMemoryStore.js";

import { evaluateTriggers } from "../../../packages/trigger-engine/src/index.js";
import { TelegramConnector } from "../../../packages/connectors/src/telegram.js";

/**
 * BullMQ worker for async trigger processing.
 * - Keeps orchestrator stateless and response path fast.
 * - In production: use Postgres-backed stores + real CRM adapters + alerting.
 */

const audit = new ConsoleAuditLogger();

// For MVP: use same in-memory store shape. In production, this would be a shared DB-backed store.
const store = new InMemoryContinuityStore({
  customerId: "cust_demo_001",
  identities: [
    { channel: "sms", externalUserId: "+15551234567" },
    { channel: "web", externalUserId: "web_demo_user" },
    { channel: "voice", externalUserId: "+15551234567" }
  ]
});

const worker = new Worker(
  triggerQueue.name,
  async (job) => {
    if (job.name !== "evaluate_triggers") return;

    const { customerId, event, recentMessages } = job.data as any;

    const result = await evaluateTriggers(
      { store },
      {
        customerId,
        event,
        recentMessages
      }
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
        actions: result.actions
      }
    });

    // Dispatch stubs:
    // - escalate: send to pager/slack
    // - pivot_to_sales: create lead/opportunity
    // - crm_sync: call CRM adapter
    // - admin_alert: send Telegram alert to TELEGRAM_ADMIN_CHAT_ID
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID;

    if (botToken && adminChatId) {
      const tg = new TelegramConnector({ botToken, adminChatId });

      // Alert on churn_risk > 0.7 OR sentiment_ema < -0.35 (both are represented by actions)
      const shouldAlert = result.actions.some((a) => a.type === "admin_alert" || a.type === "escalate");
      if (shouldAlert) {
        await tg.sendAdminAlert({
          customerId,
          customerName: "Unknown", // avoid PII; wire to CRM/profile later
          churnRisk: result.signals.churnRisk,
          sentimentEma: result.signals.sentimentEma,
          channel: event?.channel ?? "unknown",
          textPreviewRedacted: (event?.text ?? "").slice(0, 200)
        });
      }
    }

    return result;
  },
  {
    connection: (triggerQueue as any).opts.connection
  }
);

worker.on("failed", async (job, err) => {
  await audit.write({
    at: new Date().toISOString(),
    actor: "system",
    action: "trigger_job_failed",
    resourceType: "bullmq_job",
    resourceId: String(job?.id ?? "unknown"),
    details: { error: err.message }
  });
});
