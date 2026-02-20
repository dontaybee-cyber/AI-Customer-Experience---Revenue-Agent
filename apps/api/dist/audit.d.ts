/**
 * SOC2-oriented audit logging (MVP)
 * - Avoid logging raw PII. Log hashed identifiers and redacted text only.
 * - In production: write to append-only store (DB table, SIEM) with retention policies.
 */
export type AuditActor = "system" | "agent" | "human";
export interface AuditEvent {
    at: string;
    actor: AuditActor;
    action: string;
    resourceType: string;
    resourceId?: string;
    details?: Record<string, unknown>;
}
export interface AuditLogger {
    write(event: AuditEvent): Promise<void>;
}
export declare class ConsoleAuditLogger implements AuditLogger {
    write(event: AuditEvent): Promise<void>;
}
//# sourceMappingURL=audit.d.ts.map