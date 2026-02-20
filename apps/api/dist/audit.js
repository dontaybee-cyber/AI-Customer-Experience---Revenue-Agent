/**
 * SOC2-oriented audit logging (MVP)
 * - Avoid logging raw PII. Log hashed identifiers and redacted text only.
 * - In production: write to append-only store (DB table, SIEM) with retention policies.
 */
export class ConsoleAuditLogger {
    async write(event) {
        // eslint-disable-next-line no-console
        console.log(JSON.stringify({ audit: event }));
    }
}
//# sourceMappingURL=audit.js.map