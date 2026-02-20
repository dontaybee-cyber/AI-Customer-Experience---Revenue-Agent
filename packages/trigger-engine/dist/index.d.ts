import type { Channel, MessageRecord } from "../../shared/src/index.js";
export type InternalEventType = "message.received" | "message.sent" | "call.transcript" | "ticket.updated" | "system.error";
export interface InternalEvent {
    id: string;
    type: InternalEventType;
    channel: Channel;
    occurredAt: string;
    customerExternalId: string;
    conversationExternalId?: string;
    text?: string;
    metadata?: Record<string, unknown>;
}
export interface SignalSnapshot {
    sentimentScore: number;
    sentimentEma: number;
    churnRisk: number;
    buyingSignal: boolean;
    supportResolvedSignal: boolean;
}
export interface TriggerAction {
    type: "escalate" | "pivot_to_sales" | "crm_sync";
    reason: string;
    payload?: Record<string, unknown>;
}
export interface TriggerEngineStore {
    getSentimentEma(customerId: string): Promise<number | null>;
    setSentimentEma(customerId: string, value: number): Promise<void>;
}
export interface CrmAdapter {
    upsertContact(input: {
        customerId: string;
        properties: Record<string, unknown>;
    }): Promise<void>;
    upsertTicket(input: {
        customerId: string;
        properties: Record<string, unknown>;
    }): Promise<void>;
    upsertOpportunity?(input: {
        customerId: string;
        properties: Record<string, unknown>;
    }): Promise<void>;
}
export interface TriggerEngineDeps {
    store: TriggerEngineStore;
    crm?: CrmAdapter;
}
export interface EvaluateInput {
    customerId: string;
    event: InternalEvent;
    recentMessages: MessageRecord[];
    supportResolved?: boolean;
}
/**
 * MVP sentiment scoring:
 * - keyword heuristic (fast, deterministic)
 * - replace with model later
 */
export declare function scoreSentiment(text: string): number;
export declare function detectBuyingSignal(text: string): boolean;
export declare function computeChurnRisk(input: {
    sentimentEma: number;
    text: string;
    repeatContact24h?: boolean;
}): number;
/**
 * Evaluate signals and return actions.
 * Observer pattern: orchestrator can call this async and then dispatch actions (ticket, alert, CRM sync).
 */
export declare function evaluateTriggers(deps: TriggerEngineDeps, input: EvaluateInput): Promise<{
    signals: SignalSnapshot;
    actions: TriggerAction[];
}>;
//# sourceMappingURL=index.d.ts.map