import type { ContinuityStore } from "@acx/memory";
import { getContext } from "@acx/memory";
import type { MessageRecord, InternalEvent, OrchestratorResult, OpenTicket } from "@acx/shared";
import type { TriggerEngineDeps } from "@acx/trigger-engine";

import type { AuditLogger } from "./audit.js";
import { hashIdentifier, redactPII } from "./pii.js";
import type { LlmClient, LlmMessage } from "./llm.js";
import { triggerQueue } from "./queue.js";

export interface OrchestratorDeps {
  continuityStore: ContinuityStore;
  triggerDeps: TriggerEngineDeps;
  llm: LlmClient;
  audit: AuditLogger;
}

export class Orchestrator {
  constructor(private deps: OrchestratorDeps) {}

  /**
   * Core request-response lifecycle:
   * - Normalize event already done upstream
   * - Resolve identity + fetch cross-channel context (recent + semantic + tickets)
   * - Generate response (streaming supported by caller)
   * - Evaluate triggers asynchronously (observer pattern)
   * - Emit audit logs without raw PII
   */
  async processEvent(event: InternalEvent): Promise<OrchestratorResult> {
    const at = new Date().toISOString();
    const externalIdHash = hashIdentifier(event.customerExternalId);

    await this.deps.audit.write({
      at,
      actor: "system",
      action: "event_received",
      resourceType: "internal_event",
      resourceId: event.id,
      details: {
        provider: event.provider,
        type: event.type,
        channel: event.channel,
        customerExternalIdHash: externalIdHash
      }
    });

    // For MVP: if identity is unknown, we fail closed in getContext().
    // Context injection requirements:
    // - recent messages (20)
    // - semantic hits (8)
    // - memory summaries (3)
    // - active ticket status (via store.getOpenTickets)
    const context = await getContext(this.deps.continuityStore, {
      channel: event.channel,
      externalUserId: event.customerExternalId,
      conversationId: event.conversationExternalId,
      userText: event.text ?? "",
      limits: { recentMessages: 20, semanticHits: 8, summaries: 3 }
    });

    // Build a compact prompt (avoid dumping raw history; keep it short for latency)
    const system: LlmMessage = {
      role: "system",
      content:
        "You are an omnichannel CX agent. Use the provided context to respond helpfully. " +
        "Do not reveal internal IDs. Do not request sensitive data. If user is angry, be concise and offer escalation."
    };

    const contextBlock = this.formatContextForPrompt(context.recentMessages, context.semanticMemories.map((m) => m.textRedacted), context.openTickets);

    const user: LlmMessage = {
      role: "user",
      content: `CONTEXT:\n${contextBlock}\n\nUSER:\n${event.text ?? ""}`
    };

    // Generate response (caller can stream; here we also build full text for webhook replies)
    let responseText = "";
    for await (const tok of this.deps.llm.streamChat({ messages: [system, user] })) {
      responseText += tok.token;
    }

    // Enqueue trigger evaluation (observer pattern) so response path stays fast.
    // Worker will run `evaluateTriggers()` and dispatch actions (escalate/pivot/crm_sync).
    await triggerQueue.add(
      "evaluate_triggers",
      {
        customerId: context.customerId,
        event: {
          id: event.id,
          provider: event.provider,
          type: event.type,
          channel: event.channel,
          occurredAt: event.occurredAt,
          customerExternalId: event.customerExternalId,
          conversationExternalId: event.conversationExternalId,
          text: event.text,
          metadata: event.metadata
        },
        recentMessages: context.recentMessages
      },
      {
        removeOnComplete: true,
        removeOnFail: 100
      }
    );

    // Response path does not wait for triggers.
    const triggerActions: OrchestratorResult["triggerActions"] = [];

    await this.deps.audit.write({
      at: new Date().toISOString(),
      actor: "system",
      action: "response_generated",
      resourceType: "internal_event",
      resourceId: event.id,
      details: {
        customerId: context.customerId,
        responsePreview: redactPII(responseText).slice(0, 200)
      }
    });

    return {
      eventId: event.id,
      customerId: context.customerId,
      responseText,
      triggerActions
    };
  }

  private formatContextForPrompt(recent: MessageRecord[], semantic: string[], openTickets: OpenTicket[]): string {
    const recentLines = recent
      .slice(-20)
      .map((m: MessageRecord) => `${m.direction === "in" ? "USER" : "AGENT"}(${m.channel}): ${m.contentRedacted}`)
      .join("\n");

    const semanticLines = semantic.slice(0, 8).map((t) => `- ${t}`).join("\n");

    const ticketLines = (openTickets ?? [])
      .slice(0, 5)
      .map((t: OpenTicket) => `- ${t.id} [${t.status}] priority=${t.priority} intent=${t.intent ?? "unknown"}`)
      .join("\n");

    return [
      "RECENT_MESSAGES:",
      recentLines || "(none)",
      "",
      "SEMANTIC_MEMORIES:",
      semanticLines || "(none)",
      "",
      "OPEN_TICKETS:",
      ticketLines || "(none)"
    ].join("\n");
  }
}
