import { describe, it, expect } from "vitest";
import { normalizeEvent } from "./normalizeEvent.js";

describe("normalizeEvent - twilio", () => {
  it("normalizes SMS payload correctly", () => {
    const result = normalizeEvent({
      provider: "twilio",
      payload: {
        SmsMessageSid: "SM123",
        From: "+15551234567",
        To: "+15559876543",
        Body: "Hello",
        AccountSid: "AC123",
      },
    });
    expect(result.channel).toBe("sms");
    expect(result.type).toBe("message.received");
    expect(result.provider).toBe("twilio");
    expect(result.customerExternalId).toBe("+15551234567");
  });

  it("infers voice channel from CallSid", () => {
    const result = normalizeEvent({
      provider: "twilio",
      payload: { CallSid: "CA123", From: "+15551234567" },
    });
    expect(result.channel).toBe("voice");
  });

  it("throws when From is missing", () => {
    expect(() =>
      normalizeEvent({ provider: "twilio", payload: { SmsMessageSid: "SM123" } })
    ).toThrow("Missing required field: From");
  });

  it("redacts PII in body text", () => {
    const result = normalizeEvent({
      provider: "twilio",
      payload: {
        SmsMessageSid: "SM123",
        From: "+15551234567",
        Body: "my email is user@example.com",
      },
    });
    expect(result.text).toContain("[REDACTED_EMAIL]");
  });
});

describe("normalizeEvent - vapi", () => {
  it("sets type to call.transcript when transcript present", () => {
    const result = normalizeEvent({
      provider: "vapi",
      payload: {
        id: "vapi_001",
        transcript: "Hello I need help",
        callId: "call_abc",
      },
    });
    expect(result.type).toBe("call.transcript");
    expect(result.channel).toBe("voice");
  });

  it("sets type to message.received when no transcript", () => {
    const result = normalizeEvent({
      provider: "vapi",
      payload: { id: "vapi_002" },
    });
    expect(result.type).toBe("message.received");
  });

  it("falls back to vapi_ prefixed id when id missing", () => {
    const result = normalizeEvent({
      provider: "vapi",
      payload: { transcript: "hello" },
    });
    expect(result.id).toMatch(/^vapi_/);
  });
});

describe("normalizeEvent - webchat", () => {
  it("normalizes webchat payload correctly", () => {
    const result = normalizeEvent({
      provider: "webchat",
      payload: {
        id: "web_001",
        userId: "user_abc",
        text: "I need support",
        conversationId: "conv_xyz",
      },
    });
    expect(result.channel).toBe("web");
    expect(result.type).toBe("message.received");
    expect(result.customerExternalId).toBe("user_abc");
  });

  it("throws when userId and sessionId both missing", () => {
    expect(() =>
      normalizeEvent({
        provider: "webchat",
        payload: { text: "hello" },
      })
    ).toThrow();
  });

  it("redacts phone number in text", () => {
    const result = normalizeEvent({
      provider: "webchat",
      payload: { userId: "u1", text: "call me at 555-867-5309" },
    });
    expect(result.text).toContain("[REDACTED_PHONE]");
  });
});

describe("normalizeEvent - telegram", () => {
  it("normalizes telegram message correctly", () => {
    const result = normalizeEvent({
      provider: "telegram",
      payload: {
        message: {
          message_id: 42,
          text: "Hello bot",
          from: { id: 99, username: "testuser", first_name: "Test" },
          chat: { id: 100 },
        },
      },
    });
    expect(result.channel).toBe("telegram");
    expect(result.customerExternalId).toBe("tg_user:99");
    expect(result.conversationExternalId).toBe("tg_chat:100");
  });

  it("throws when message object is missing", () => {
    expect(() =>
      normalizeEvent({ provider: "telegram", payload: {} })
    ).toThrow("Telegram payload missing message");
  });

  it("throws when from.id is missing", () => {
    expect(() =>
      normalizeEvent({
        provider: "telegram",
        payload: {
          message: {
            message_id: 1,
            text: "hi",
            from: {},
            chat: { id: 1 },
          },
        },
      })
    ).toThrow();
  });
});

describe("normalizeEvent - unsupported provider", () => {
  it("throws for unknown provider", () => {
    expect(() =>
      normalizeEvent({ provider: "unknown" as never, payload: {} })
    ).toThrow("Unsupported provider: unknown");
  });
});
