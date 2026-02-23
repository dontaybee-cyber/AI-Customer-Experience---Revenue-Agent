import type {
    Channel,
    ContinuityContext,
    CustomerProfile,
    MemorySummary,
    MessageRecord,
    OpenTicket,
    SemanticMemoryHit,
  } from "../../shared/src/index.js";
import { SupabaseContinuityStore } from "./supabaseStore.js";

export interface ContinuityStore {
    resolveCustomerId(input: { channel: Channel; externalUserId: string }): Promise<string | null>;
    createCustomerAndIdentity(input: { channel: Channel; externalUserId: string }): Promise<CustomerProfile>;
    getCustomerProfile(customerId: string): Promise<CustomerProfile>;
    updateCustomerProfile(customerId: string, updates: Partial<CustomerProfile>): Promise<CustomerProfile>;
    getRecentMessages(input: {
        customerId: string;
        conversationId?: string;
        limit: number;
    }): Promise<MessageRecord[]>;
    getLatestSummaries(input: { customerId: string; limit: number }): Promise<MemorySummary[]>;
    semanticSearch(input: {
        customerId: string;
        query: string;
        limit: number;
      }): Promise<SemanticMemoryHit[]>;
    getOpenTickets(customerId: string): Promise<OpenTicket[]>;
}

export interface GetContextInput {
  channel: Channel;
  externalUserId: string;
  conversationId?: string;
  userText: string;
  limits?: {
    recentMessages?: number;
    summaries?: number;
    semanticHits?: number;
  };
}

/**
 * Contextual Continuity Engine
 * - Resolves identity across channels to a stable customerId
 * - Fetches recent messages (exact history)
 * - Fetches latest summaries (compressed memory)
 * - Fetches semantic memories (cross-channel recall)
 * - Fetches open tickets (operational context)
 *
 * Designed for <2s response path: all calls should be indexed + fast; heavy work async.
 */
export async function getContext(store: ContinuityStore, input: GetContextInput): Promise<ContinuityContext> {
  const recentMessagesLimit = input.limits?.recentMessages ?? 20;
  const summariesLimit = input.limits?.summaries ?? 3;
  const semanticHitsLimit = input.limits?.semanticHits ?? 8;

  let customerId = await store.resolveCustomerId({
    channel: input.channel,
    externalUserId: input.externalUserId
  });

  if (!customerId) {
    const newCustomer = await store.createCustomerAndIdentity({
        channel: input.channel,
        externalUserId: input.externalUserId,
    });
    customerId = newCustomer.id;
  }

  const [profile, recentMessages, summaries, semanticMemories, openTickets] = await Promise.all([
    store.getCustomerProfile(customerId),
    store.getRecentMessages({ customerId, conversationId: input.conversationId, limit: recentMessagesLimit }),
    store.getLatestSummaries({ customerId, limit: summariesLimit }),
    store.semanticSearch({ customerId, query: input.userText, limit: semanticHitsLimit }),
    store.getOpenTickets(customerId)
  ]);

  return {
    customerId,
    profile,
    recentMessages,
    summaries,
    semanticMemories,
    openTickets
  };
}

type CrmUpsertFunction = (profile: CustomerProfile) => Promise<string>;

export async function resolveVapiIdentity(
    store: ContinuityStore,
    upsertContact: CrmUpsertFunction,
    phoneNumber: string
): Promise<string> {
    
    let customerId = await store.resolveCustomerId({
        channel: 'voice', 
        externalUserId: phoneNumber
    });

    if (customerId) {
        return customerId;
    }

    const newCustomer = await store.createCustomerAndIdentity({
        channel: 'voice',
        externalUserId: phoneNumber
    });
    customerId = newCustomer.id;

    const profile: CustomerProfile = {
        ...newCustomer,
        primaryPhone: phoneNumber,
    };

    try {
        const crmContactId = await upsertContact(profile);
        await store.updateCustomerProfile(customerId, { crmContactId });
    } catch (error) {
        console.error("Failed to upsert contact to CRM", error);
    }
    
    return customerId;
}

export { SupabaseContinuityStore };

