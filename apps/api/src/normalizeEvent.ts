import type { Channel, InternalEvent, Provider } from "@acx/shared";
import { redactPII } from "./pii.js";

function isoNow() {
  return new Date().toISOString();
}

function asString(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

function requiredString(v: unknown, field: string): string {
  const s = asString(v);
  if (!s) throw new Error(`Missing required field: ${field}`);
  return s;
}

function inferChannelFromTwilio(payload: any): Channel {
  // Twilio SMS webhook typically includes SmsMessageSid; Voice includes CallSid.
  if (payload?.SmsMessageSid || payload?.MessageSid) return "sms";
  if (payload?.CallSid) return "voice";
  return "sms";
}

/**
 * Normalize inbound provider payloads into a unified InternalEvent schema.
 * This is the only place that should know provider-specific shapes.
 */
export function normalizeEvent(input: { provider: Provider; payload: unknown; headers?: Record<string, string | string[] | undefined> }): InternalEvent {
  const { provider } = input;

  if (provider === "twilio") {
    const p: any = input.payload ?? {};
    const channel = inferChannelFromTwilio(p);

    const from = requiredString(p.From, "From"); // phone
    const body = asString(p.Body) ?? asString(p.SpeechResult) ?? "";

    const id = asString(p.SmsMessageSid) ?? asString(p.MessageSid) ?? asString(p.CallSid) ?? `twilio_${Date.now()}`;

    return {
      id,
      provider,
      type: "message.received",
      channel,
      occurredAt: isoNow(),
      customerExternalId: from,
      conversationExternalId: asString(p.ConversationSid) ?? asString(p.CallSid),
      text: body ? redactPII(body) : undefined,
      metadata: {
        to: asString(p.To),
        accountSid: asString(p.AccountSid)
      }
    };
  }

  if (provider === "vapi") {
    // Vapi event shapes vary; we normalize the common fields.
    const p: any = input.payload ?? {};
    const id = asString(p.id) ?? asString(p.eventId) ?? `vapi_${Date.now()}`;
    const occurredAt = asString(p.timestamp) ?? isoNow();

    // Attempt to locate a stable external user id (phone/email) if present.
    const customerExternalId =
      asString(p.customer?.phone) ??
      asString(p.customer?.email) ??
      asString(p.phoneNumber) ??
      asString(p.from) ??
      "unknown";

    const transcript = asString(p.transcript) ?? asString(p.text) ?? "";

    return {
      id,
      provider,
      type: transcript ? "call.transcript" : "message.received",
      channel: "voice",
      occurredAt,
      customerExternalId,
      conversationExternalId: asString(p.callId) ?? asString(p.conversationId),
      text: transcript ? redactPII(transcript) : undefined,
      metadata: {
        rawType: asString(p.type),
        assistantId: asString(p.assistantId)
      }
    };
  }

  if (provider === "webchat") {
    const p: any = input.payload ?? {};
    const id = asString(p.id) ?? `web_${Date.now()}`;
    const occurredAt = asString(p.occurredAt) ?? isoNow();

    const customerExternalId = requiredString(p.userId ?? p.sessionId, "userId|sessionId");
    const text = requiredString(p.text, "text");

    return {
      id,
      provider,
      type: "message.received",
      channel: "web",
      occurredAt,
      customerExternalId,
      conversationExternalId: asString(p.conversationId),
      text: redactPII(text),
      metadata: {
        pageUrl: asString(p.pageUrl),
        userAgent: asString(p.userAgent)
      }
    };
  }

  if (provider === "telegram") {
    // Telegram Bot API webhook payload:
    // - message.text
    // - message.from.id (user_id)
    // - message.chat.id (chat_id)
    const p: any = input.payload ?? {};
    const msg: any = p.message ?? p.edited_message ?? p.channel_post ?? p.edited_channel_post;
    if (!msg) throw new Error("Telegram payload missing message");

    const text = asString(msg.text) ?? asString(msg.caption) ?? "";
    const fromId = msg.from?.id;
    const chatId = msg.chat?.id;

    if (fromId === undefined || fromId === null) throw new Error("Telegram payload missing message.from.id");
    if (chatId === undefined || chatId === null) throw new Error("Telegram payload missing message.chat.id");

    const id = asString(msg.message_id?.toString?.()) ?? `tg_${Date.now()}`;

    return {
      id,
      provider,
      type: "message.received",
      channel: "telegram",
      occurredAt: isoNow(),
      // Use a stable external identity string; store can map this to customerId.
      customerExternalId: `tg_user:${String(fromId)}`,
      conversationExternalId: `tg_chat:${String(chatId)}`,
      text: text ? redactPII(text) : undefined,
      metadata: {
        telegram: {
          user_id: fromId,
          chat_id: chatId,
          username: asString(msg.from?.username),
          first_name: asString(msg.from?.first_name),
          last_name: asString(msg.from?.last_name)
        }
      }
    };
  }

  throw new Error(`Unsupported provider: ${provider}`);
}
