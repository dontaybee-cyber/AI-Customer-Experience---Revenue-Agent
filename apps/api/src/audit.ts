/**
 * SOC2-oriented audit logging (MVP)
 * - Avoid logging raw PII. Log hashed identifiers and redacted text only.
 * - In production: write to append-only store (DB table, SIEM) with retention policies.
 */

export type AuditActor = "system" | "agent" | "human";

export interface AuditEvent {
  at: string; // ISO
  actor: AuditActor;
  action: string;
  resourceType: string;
  resourceId?: string;
  details?: Record<string, unknown>;
}

export interface AuditLogger {
  write(event: AuditEvent): Promise<void>;
}

export class ConsoleAuditLogger implements AuditLogger {
  async write(event: AuditEvent): Promise<void> {
    // eslint-disable-next-line no-console
    console.log(JSON.stringify({ audit: event }));
  }
}
