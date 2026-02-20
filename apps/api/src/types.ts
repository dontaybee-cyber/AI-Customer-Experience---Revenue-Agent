import type { Channel } from "../../../packages/shared/src/index.js";

export type Provider = "twilio" | "vapi" | "webchat";

export type InternalEventType =
  | "message.received"
  | "message.sent"
  | "call.transcript"
  | "ticket.updated"
  | "system.error";

export interface InternalEvent {
  id: string;
  provider: Provider;
  type: InternalEventType;
  channel: Channel;
  occurredAt: string; // ISO
  customerExternalId: string; // raw at runtime; do not persist unmasked
  conversationExternalId?: string;
  text?: string; // should be PII-redacted before persistence
  metadata?: Record<string, unknown>;
}

export interface OrchestratorResult {
  eventId: string;
  customerId: string;
  responseText?: string;
  triggerActions: Array<{ type: string; reason: string; payload?: Record<string, unknown> }>;
}
