import type { ContinuityStore } from "../../../../packages/memory/src/index.js";
import type { Channel, CustomerProfile, MemorySummary, MessageRecord, OpenTicket, SemanticMemoryHit } from "../../../../packages/shared/src/index.js";
import type { TriggerEngineStore } from "../../../../packages/trigger-engine/src/index.js";

/**
 * In-memory store for MVP smoke testing.
 * Replace with Postgres + pgvector implementation.
 */
export class InMemoryContinuityStore implements ContinuityStore, TriggerEngineStore {
  private identityToCustomerId = new Map<string, string>();
  private profiles = new Map<string, CustomerProfile>();
  private messagesByCustomer = new Map<string, MessageRecord[]>();
  private summariesByCustomer = new Map<string, MemorySummary[]>();
  private ticketsByCustomer = new Map<string, OpenTicket[]>();
  private semanticByCustomer = new Map<string, SemanticMemoryHit[]>();
  private sentimentEmaByCustomer = new Map<string, number>();

  constructor(seed?: { customerId: string; identities: Array<{ channel: Channel; externalUserId: string }> }) {
    if (seed) {
      for (const ident of seed.identities) {
        this.identityToCustomerId.set(this.key(ident.channel, ident.externalUserId), seed.customerId);
      }
      this.profiles.set(seed.customerId, { id: seed.customerId });
    }
  }

  private key(channel: Channel, externalUserId: string) {
    return `${channel}:${externalUserId}`;
  }

  async resolveCustomerId(input: { channel: Channel; externalUserId: string }): Promise<string | null> {
    return this.identityToCustomerId.get(this.key(input.channel, input.externalUserId)) ?? null;
  }

  async getCustomerProfile(customerId: string): Promise<CustomerProfile> {
    return this.profiles.get(customerId) ?? { id: customerId };
  }

  async getRecentMessages(input: { customerId: string; conversationId?: string; limit: number }): Promise<MessageRecord[]> {
    const all = this.messagesByCustomer.get(input.customerId) ?? [];
    const filtered = input.conversationId ? all.filter((m) => m.conversationId === input.conversationId) : all;
    return filtered.slice(-input.limit);
  }

  async getLatestSummaries(input: { customerId: string; limit: number }): Promise<MemorySummary[]> {
    const all = this.summariesByCustomer.get(input.customerId) ?? [];
    return all.slice(-input.limit);
  }

  async semanticSearch(input: { customerId: string; query: string; limit: number }): Promise<SemanticMemoryHit[]> {
    const all = this.semanticByCustomer.get(input.customerId) ?? [];
    // MVP: return most recent; replace with vector similarity.
    return all.slice(-input.limit).reverse();
  }

  async getOpenTickets(customerId: string): Promise<OpenTicket[]> {
    return (this.ticketsByCustomer.get(customerId) ?? []).filter((t) => t.status !== "closed");
  }

  // TriggerEngineStore
  async getSentimentEma(customerId: string): Promise<number | null> {
    return this.sentimentEmaByCustomer.get(customerId) ?? null;
  }

  async setSentimentEma(customerId: string, value: number): Promise<void> {
    this.sentimentEmaByCustomer.set(customerId, value);
  }

  // Helpers for orchestrator demo
  ensureCustomer(input: { customerId: string; channel: Channel; externalUserId: string }) {
    this.identityToCustomerId.set(this.key(input.channel, input.externalUserId), input.customerId);
    if (!this.profiles.has(input.customerId)) this.profiles.set(input.customerId, { id: input.customerId });
  }

  appendMessage(msg: MessageRecord) {
    const arr = this.messagesByCustomer.get(msg.customerId) ?? [];
    arr.push(msg);
    this.messagesByCustomer.set(msg.customerId, arr);
  }
}
