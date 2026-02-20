import type { ContinuityStore } from "../../../../packages/memory/src/index.js";
import type { Channel, CustomerProfile, MemorySummary, MessageRecord, OpenTicket, SemanticMemoryHit } from "../../../../packages/shared/src/index.js";
import type { TriggerEngineStore } from "../../../../packages/trigger-engine/src/index.js";
/**
 * In-memory store for MVP smoke testing.
 * Replace with Postgres + pgvector implementation.
 */
export declare class InMemoryContinuityStore implements ContinuityStore, TriggerEngineStore {
    private identityToCustomerId;
    private profiles;
    private messagesByCustomer;
    private summariesByCustomer;
    private ticketsByCustomer;
    private semanticByCustomer;
    private sentimentEmaByCustomer;
    constructor(seed?: {
        customerId: string;
        identities: Array<{
            channel: Channel;
            externalUserId: string;
        }>;
    });
    private key;
    resolveCustomerId(input: {
        channel: Channel;
        externalUserId: string;
    }): Promise<string | null>;
    getCustomerProfile(customerId: string): Promise<CustomerProfile>;
    getRecentMessages(input: {
        customerId: string;
        conversationId?: string;
        limit: number;
    }): Promise<MessageRecord[]>;
    getLatestSummaries(input: {
        customerId: string;
        limit: number;
    }): Promise<MemorySummary[]>;
    semanticSearch(input: {
        customerId: string;
        query: string;
        limit: number;
    }): Promise<SemanticMemoryHit[]>;
    getOpenTickets(customerId: string): Promise<OpenTicket[]>;
    getSentimentEma(customerId: string): Promise<number | null>;
    setSentimentEma(customerId: string, value: number): Promise<void>;
    ensureCustomer(input: {
        customerId: string;
        channel: Channel;
        externalUserId: string;
    }): void;
    appendMessage(msg: MessageRecord): void;
}
//# sourceMappingURL=inMemoryStore.d.ts.map