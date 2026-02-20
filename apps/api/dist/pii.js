/**
 * SOC2-oriented PII handling (MVP)
 * - Redact common PII patterns before persistence/logging.
 * - Keep raw identifiers only in-memory for routing/response.
 *
 * Replace with a stronger solution (e.g., Microsoft Presidio) later.
 */
const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE_RE = /\b(\+?\d{1,3}[-.\s]?)?(\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}\b/g;
const CC_RE = /\b(?:\d[ -]*?){13,19}\b/g;
export function redactPII(text) {
    return text.replace(EMAIL_RE, "[REDACTED_EMAIL]").replace(PHONE_RE, "[REDACTED_PHONE]").replace(CC_RE, "[REDACTED_CARD]");
}
/**
 * Hash identifiers for storage/lookup without persisting raw values.
 * NOTE: For MVP we use a non-cryptographic placeholder. Replace with crypto.subtle SHA-256 + salt.
 */
export function hashIdentifier(value) {
    let h = 2166136261;
    for (let i = 0; i < value.length; i++) {
        h ^= value.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return `fnv1a_${(h >>> 0).toString(16)}`;
}
//# sourceMappingURL=pii.js.map