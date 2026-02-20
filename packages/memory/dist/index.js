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
export async function getContext(store, input) {
    const recentMessagesLimit = input.limits?.recentMessages ?? 20;
    const summariesLimit = input.limits?.summaries ?? 3;
    const semanticHitsLimit = input.limits?.semanticHits ?? 8;
    const customerId = await store.resolveCustomerId({
        channel: input.channel,
        externalUserId: input.externalUserId
    });
    if (!customerId) {
        // In MVP, we fail closed. In production, you'd create a customer + identity mapping here.
        throw new Error("Unknown customer identity; cannot establish continuity context.");
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
//# sourceMappingURL=index.js.map