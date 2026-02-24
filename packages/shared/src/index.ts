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

export interface VapiCall {
    id: string;
    // other props
}
  
export interface VapiCustomer {
    number: string;
    // other props
}

export interface VapiRequestMessage {
    type: 'assistant-request';
    call: VapiCall;
    customer: VapiCustomer;
}
  
export interface VapiRequest {
    message: VapiRequestMessage;
}
  
export interface VapiEndReportMessage {
      type: 'end-of-call-report';
      summary: string;
      transcript: string;
      recordingUrl: string;
      customer?: VapiCustomer;
      // other props
}
  
export interface VapiEndReport {
      message: VapiEndReportMessage;
}
  
export interface VapiResponse {
    assistant: {
      model: {
        provider: 'openai';
        model: 'gpt-3.5-turbo';
        messages: [
          {
            role: 'system';
            content: string;
          }
        ];
      };
      firstMessage?: string;
    };
}

export interface TelegramMetadata {
  chat_id: number;
  user_id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
}

export type InternalEventType =
  | "message.received"
  | "message.sent"
  | "call.transcript"
  | "ticket.updated"
  | "system.error";

export interface InternalEvent {
  id: string;
  type: InternalEventType;
  channel: Channel;
  provider: Provider;
  occurredAt: string; // ISO
  customerExternalId: string; // phone/email/web id (raw at runtime; do not persist unmasked)
  conversationExternalId?: string;
  text?: string; // redacted text preferred
  metadata?: Record<string, unknown> | { telegram: TelegramMetadata };
}

export interface CRMAdapter {
  upsertContact(profile: CustomerProfile): Promise<string>;
  createTicket(ticket: OpenTicket): Promise<string>;
  logEngagement(customerId: string, activity: string): Promise<void>;
  createDeal(customerId: string, dealStage?: string): Promise<string>;
}

export type Provider = "twilio" | "vapi" | "webchat" | "telegram";

export interface TriggerAction {
    type: "escalate" | "pivot_to_sales" | "crm_sync" | "admin_alert";
    reason: string;
    payload?: Record<string, unknown>;
}

export interface OrchestratorResult {
    eventId: string;
    customerId: string;
    responseText: string;
    triggerActions: TriggerAction[];
}

export interface ContinuityStore {
    resolveCustomerId(input: { channel: Channel; externalUserId: string }): Promise<string | null>;
    createCustomerAndIdentity(input: { channel: Channel; externalUserId: string }): Promise<CustomerProfile>;
    getCustomerProfile(customerId: string): Promise<CustomerProfile>;
    updateCustomerProfile(customerId: string, updates: Partial<CustomerProfile>): Promise<CustomerProfile>;
    getRecentMessages(input: {
      customerId: string;
      conversationId?: string;
      limit: number;
    }): Promise<MessageRecord[]>;
    getLatestSummaries(input: { customerId: string; limit: number }): Promise<MemorySummary[]>;
    semanticSearch(input: {
      customerId: string;
      query: string;
      limit: number;
    }): Promise<SemanticMemoryHit[]>;
    getOpenTickets(customerId: string): Promise<OpenTicket[]>;
    saveEmbedding(
      messageId: string,
      customerId: string,
      conversationId: string,
      textRedacted: string,
      embedding: number[],
    ): Promise<void>;
    getMessagesWithoutEmbeddings(): Promise<MessageRecord[]>;
    getSentimentEma(customerId: string): Promise<number | null>;
    setSentimentEma(customerId: string, value: number): Promise<void>;
  }
