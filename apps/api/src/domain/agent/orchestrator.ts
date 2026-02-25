// src/domain/agent/orchestrator.ts
import type { AuditLogger } from "../../infra/audit.js";
import { createAuditLogger } from "../../infra/audit.js";
import { hashIdentifier, redactPII } from "../../infra/pii.js";
import { triggerQueue } from "../../queue.js";
import { StubLlmClient } from "../../llm.js";
import { getContext, SupabaseContinuityStore } from "@acx/memory";
import type { ContinuityStore } from "@acx/memory";
import type {
  InternalEvent,
  MessageRecord,
  OrchestratorResult,
  OpenTicket,
} from "@acx/shared";
import type { LlmClient, LlmMessage } from "../../llm.js";

// App-level salt for audit-log identifier hashing.
// Non-secret; prevents cross-app rainbow tables.
const AUDIT_HASH_SALT = process.env.AUDIT_HASH_SALT ?? "acx-audit-v1";

export interface OrchestratorDeps {
  audit: AuditLogger;
  llm: LlmClient;
  store: ContinuityStore;
}

function createDefaultDeps(): OrchestratorDeps {
  return {
    audit: createAuditLogger(),
    llm: new StubLlmClient(),
    store: new SupabaseContinuityStore(),
  };
}

export class Orchestrator {
  private readonly audit: AuditLogger;
  private readonly llm: LlmClient;
  private readonly store: ContinuityStore;

  constructor(deps: OrchestratorDeps = createDefaultDeps()) {
    this.audit = deps.audit;
    this.llm = deps.llm;
    this.store = deps.store;
  }

  public async run(event: InternalEvent): Promise<OrchestratorResult> {
    const at = new Date().toISOString();

    // Hash before writing to audit log — never store raw PII.
    const externalIdHash = await hashIdentifier(
      event.customerExternalId,
      AUDIT_HASH_SALT
    );

    await this.audit.write({
      at,
      actor: "system",
      action: "event_received",
      resourceType: "internal_event",
      resourceId: event.id,
      details: {
        provider: event.provider,
        type: event.type,
        channel: event.channel,
        customerExternalIdHash: externalIdHash,
      },
    });

    // Fetch cross-channel context: recent messages, semantic hits, summaries, tickets.
    const context = await getContext(this.store, {
      channel: event.channel,
      externalUserId: event.customerExternalId,
      conversationId: event.conversationExternalId,
      userText: event.text ?? "",
      limits: { recentMessages: 20, semanticHits: 8, summaries: 3 },
    });

    const system: LlmMessage = {
      role: "system",
      content:
        "You are an omnichannel CX agent. Use the provided context to respond helpfully. " +
        "Do not reveal internal IDs. Do not request sensitive data. " +
        "If user is angry, be concise and offer escalation.",
    };

    const contextBlock = this.formatContextForPrompt(
      context.recentMessages,
      context.semanticMemories.map((m) => m.textRedacted),
      context.openTickets
    );

    const user: LlmMessage = {
      role: "user",
      content: `CONTEXT:\n${contextBlock}\n\nUSER:\n${event.text ?? ""}`,
    };

    // Collect full response before returning — never stream to external surfaces.
    let responseText = "";
    for await (const tok of this.llm.streamChat({ messages: [system, user] })) {
      responseText += tok.token;
    }

    // Enqueue trigger evaluation asynchronously — keeps response path fast.
    await triggerQueue.add(
      "evaluate_triggers",
      {
        customerId: context.customerId,
        event,
        recentMessages: context.recentMessages,
      },
      { removeOnComplete: true, removeOnFail: 100 }
    );

    await this.audit.write({
      at: new Date().toISOString(),
      actor: "system",
      action: "response_generated",
      resourceType: "internal_event",
      resourceId: event.id,
      details: {
        customerId: context.customerId,
        responsePreview: redactPII(responseText).slice(0, 200),
      },
    });

    return {
      eventId: event.id,
      customerId: context.customerId,
      responseText,
      triggerActions: [],
    };
  }

  private formatContextForPrompt(
    recent: MessageRecord[],
    semantic: string[],
    openTickets: OpenTicket[]
  ): string {
    const recentLines = recent
      .slice(-20)
      .map(
        (m: MessageRecord) =>
          `${m.direction === "in" ? "USER" : "AGENT"}(${m.channel}): ${m.contentRedacted}`
      )
      .join("\n");

    const semanticLines = semantic
      .slice(0, 8)
      .map((t) => `- ${t}`)
      .join("\n");

    const ticketLines = (openTickets ?? [])
      .slice(0, 5)
      .map(
        (t: OpenTicket) =>
          `- ${t.id} [${t.status}] priority=${t.priority} intent=${t.intent ?? "unknown"}`
      )
      .join("\n");

    return [
      "RECENT_MESSAGES:",
      recentLines || "(none)",
      "",
      "SEMANTIC_MEMORIES:",
      semanticLines || "(none)",
      "",
      "OPEN_TICKETS:",
      ticketLines || "(none)",
    ].join("\n");
  }
}