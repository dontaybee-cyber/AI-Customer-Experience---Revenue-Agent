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

/**
 * Factory for Dependency Injection
 */
export function createAuditLogger(): AuditLogger {
  return new ConsoleAuditLogger();
}
