import { Worker } from "bullmq";
import { ConsoleAuditLogger } from "./audit.js";
import { triggerQueue } from "./queue.js";
import { InMemoryContinuityStore } from "./store/inMemoryStore.js";
import { evaluateTriggers } from "../../../packages/trigger-engine/src/index.js";
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
const worker = new Worker(triggerQueue.name, async (job) => {
    if (job.name !== "evaluate_triggers")
        return;
    const { customerId, event, recentMessages } = job.data;
    const result = await evaluateTriggers({ store }, {
        customerId,
        event,
        recentMessages
    });
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
    return result;
}, {
    connection: triggerQueue.opts.connection
});
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
//# sourceMappingURL=worker.js.map