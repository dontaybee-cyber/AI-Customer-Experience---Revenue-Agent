/**
 * In-memory store for MVP smoke testing.
 * Replace with Postgres + pgvector implementation.
 */
export class InMemoryContinuityStore {
    identityToCustomerId = new Map();
    profiles = new Map();
    messagesByCustomer = new Map();
    summariesByCustomer = new Map();
    ticketsByCustomer = new Map();
    semanticByCustomer = new Map();
    sentimentEmaByCustomer = new Map();
    constructor(seed) {
        if (seed) {
            for (const ident of seed.identities) {
                this.identityToCustomerId.set(this.key(ident.channel, ident.externalUserId), seed.customerId);
            }
            this.profiles.set(seed.customerId, { id: seed.customerId });
        }
    }
    key(channel, externalUserId) {
        return `${channel}:${externalUserId}`;
    }
    async resolveCustomerId(input) {
        return this.identityToCustomerId.get(this.key(input.channel, input.externalUserId)) ?? null;
    }
    async getCustomerProfile(customerId) {
        return this.profiles.get(customerId) ?? { id: customerId };
    }
    async getRecentMessages(input) {
        const all = this.messagesByCustomer.get(input.customerId) ?? [];
        const filtered = input.conversationId ? all.filter((m) => m.conversationId === input.conversationId) : all;
        return filtered.slice(-input.limit);
    }
    async getLatestSummaries(input) {
        const all = this.summariesByCustomer.get(input.customerId) ?? [];
        return all.slice(-input.limit);
    }
    async semanticSearch(input) {
        const all = this.semanticByCustomer.get(input.customerId) ?? [];
        // MVP: return most recent; replace with vector similarity.
        return all.slice(-input.limit).reverse();
    }
    async getOpenTickets(customerId) {
        return (this.ticketsByCustomer.get(customerId) ?? []).filter((t) => t.status !== "closed");
    }
    // TriggerEngineStore
    async getSentimentEma(customerId) {
        return this.sentimentEmaByCustomer.get(customerId) ?? null;
    }
    async setSentimentEma(customerId, value) {
        this.sentimentEmaByCustomer.set(customerId, value);
    }
    // Helpers for orchestrator demo
    ensureCustomer(input) {
        this.identityToCustomerId.set(this.key(input.channel, input.externalUserId), input.customerId);
        if (!this.profiles.has(input.customerId))
            this.profiles.set(input.customerId, { id: input.customerId });
    }
    appendMessage(msg) {
        const arr = this.messagesByCustomer.get(msg.customerId) ?? [];
        arr.push(msg);
        this.messagesByCustomer.set(msg.customerId, arr);
    }
}
//# sourceMappingURL=inMemoryStore.js.map