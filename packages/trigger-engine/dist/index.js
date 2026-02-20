function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
}
/**
 * MVP sentiment scoring:
 * - keyword heuristic (fast, deterministic)
 * - replace with model later
 */
export function scoreSentiment(text) {
    const t = text.toLowerCase();
    const neg = ["angry", "upset", "terrible", "worst", "refund", "cancel", "hate", "broken", "sucks", "lawsuit", "chargeback"];
    const pos = ["thanks", "thank you", "great", "awesome", "perfect", "love", "amazing", "resolved", "works now"];
    let score = 0;
    for (const w of neg)
        if (t.includes(w))
            score -= 0.2;
    for (const w of pos)
        if (t.includes(w))
            score += 0.15;
    return clamp(score, -1, 1);
}
export function detectBuyingSignal(text) {
    const t = text.toLowerCase();
    return ["pricing", "upgrade", "plan", "demo", "quote", "enterprise", "seats", "integrations", "contract"].some((k) => t.includes(k));
}
export function computeChurnRisk(input) {
    const t = input.text.toLowerCase();
    let risk = 0;
    // sentiment contribution
    if (input.sentimentEma < -0.35)
        risk += 0.5;
    else if (input.sentimentEma < -0.2)
        risk += 0.3;
    else if (input.sentimentEma < -0.05)
        risk += 0.15;
    // explicit churn intents
    if (["cancel", "refund", "chargeback", "lawsuit"].some((k) => t.includes(k)))
        risk += 0.4;
    // repeat contact
    if (input.repeatContact24h)
        risk += 0.15;
    return clamp(risk, 0, 1);
}
/**
 * Evaluate signals and return actions.
 * Observer pattern: orchestrator can call this async and then dispatch actions (ticket, alert, CRM sync).
 */
export async function evaluateTriggers(deps, input) {
    const text = input.event.text ?? "";
    const sentimentScore = text ? scoreSentiment(text) : 0;
    const prevEma = (await deps.store.getSentimentEma(input.customerId)) ?? 0;
    const alpha = 0.35; // EMA smoothing
    const sentimentEma = clamp(alpha * sentimentScore + (1 - alpha) * prevEma, -1, 1);
    await deps.store.setSentimentEma(input.customerId, sentimentEma);
    const buyingSignal = text ? detectBuyingSignal(text) : false;
    const supportResolvedSignal = Boolean(input.supportResolved) || (text.toLowerCase().includes("thanks") && sentimentEma > -0.05);
    const churnRisk = text ? computeChurnRisk({ sentimentEma, text }) : 0;
    const actions = [];
    // Escalate rule
    if (sentimentEma < -0.35) {
        actions.push({
            type: "escalate",
            reason: `sentiment_ema ${sentimentEma.toFixed(2)} < -0.35`,
            payload: { sentimentEma, churnRisk }
        });
    }
    // Pivot rule
    if (buyingSignal && supportResolvedSignal) {
        actions.push({
            type: "pivot_to_sales",
            reason: "buying signal detected and support appears resolved",
            payload: { buyingSignal, supportResolvedSignal }
        });
    }
    // CRM sync (MVP: always sync on inbound message if adapter exists)
    if (deps.crm && input.event.type === "message.received") {
        actions.push({
            type: "crm_sync",
            reason: "inbound message received",
            payload: { sentimentEma, churnRisk, buyingSignal }
        });
    }
    return {
        signals: {
            sentimentScore,
            sentimentEma,
            churnRisk,
            buyingSignal,
            supportResolvedSignal
        },
        actions
    };
}
//# sourceMappingURL=index.js.map