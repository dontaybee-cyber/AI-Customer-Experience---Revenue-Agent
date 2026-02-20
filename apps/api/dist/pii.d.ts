/**
 * SOC2-oriented PII handling (MVP)
 * - Redact common PII patterns before persistence/logging.
 * - Keep raw identifiers only in-memory for routing/response.
 *
 * Replace with a stronger solution (e.g., Microsoft Presidio) later.
 */
export declare function redactPII(text: string): string;
/**
 * Hash identifiers for storage/lookup without persisting raw values.
 * NOTE: For MVP we use a non-cryptographic placeholder. Replace with crypto.subtle SHA-256 + salt.
 */
export declare function hashIdentifier(value: string): string;
//# sourceMappingURL=pii.d.ts.map