export type Channel = "sms" | "voice" | "web" | "email" | "telegram";

export type Direction = "in" | "out";

export type ISODateString = string;

export type CustomerIdentityType = "phone" | "email" | "web" | "whatsapp" | "crm" | "telegram";

export interface CustomerIdentity {
  type: CustomerIdentityType;
  value: string; // raw value at runtime; store hashed in DB
}

export interface MessageRecord {
  id: string;
  customerId: string;
  conversationId: string;
  channel: Channel;
  direction: Direction;
  timestamp: ISODateString;
  contentRedacted: string;
  metadata?: Record<string, unknown>;
}

export interface MemorySummary {
  id: string;
  customerId: string;
  scope: "global" | "ticket" | "product";
  scopeId?: string;
  summaryText: string;
  updatedAt: ISODateString;
}

export interface SemanticMemoryHit {
  id: string;
  customerId: string;
  conversationId?: string;
  messageId?: string;
  textRedacted: string;
  score: number;
  createdAt: ISODateString;
}

export interface OpenTicket {
  id: string;
  customerId: string;
  status: "open" | "pending" | "closed";
  priority: "low" | "normal" | "high" | "urgent";
  intent?: string;
  assignedTeam?: string;
  slaDueAt?: ISODateString;
}

export interface CustomerProfile {
  id: string;
  primaryEmail?: string;
  primaryPhone?: string;
  crmContactId?: string;
  locale?: string;
  timezone?: string;
  consentFlags?: Record<string, boolean>;
}

export interface ContinuityContext {
  customerId: string;
  profile: CustomerProfile;
  recentMessages: MessageRecord[];
  summaries: MemorySummary[];
  semanticMemories: SemanticMemoryHit[];
  openTickets: OpenTicket[];
}
