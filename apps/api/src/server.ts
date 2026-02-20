import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";

import { ConsoleAuditLogger } from "./audit.js";
import { normalizeEvent } from "./normalizeEvent.js";
import { StubLlmClient } from "./llm.js";
import { Orchestrator } from "./orchestrator.js";
import { InMemoryContinuityStore } from "./store/inMemoryStore.js";
import { TelegramConnector, escapeMarkdownV2 } from "../../../packages/connectors/src/telegram.js";

const app = Fastify({
  logger: true
});

const audit = new ConsoleAuditLogger();
const llm = new StubLlmClient();

// Seed a demo customer identity so getContext() can resolve it.
const store = new InMemoryContinuityStore({
  customerId: "cust_demo_001",
  identities: [
    { channel: "sms", externalUserId: "+15551234567" },
    { channel: "web", externalUserId: "web_demo_user" },
    { channel: "voice", externalUserId: "+15551234567" }
  ]
});

const orchestrator = new Orchestrator({
  continuityStore: store,
  triggerDeps: { store },
  llm,
  audit
});

app.get("/health", async () => ({ ok: true }));

/**
 * Webhook endpoints (MVP)
 * - POST /webhooks/twilio
 * - POST /webhooks/vapi
 * - POST /webhooks/webchat
 *
 * Each normalizes payload -> InternalEvent -> orchestrator.processEvent()
 */
app.post("/webhooks/:provider", async (req: FastifyRequest, reply: FastifyReply) => {
  const provider = req.params as any;
  const payload = req.body as unknown;

  const event = normalizeEvent({
    provider: provider.provider,
    payload,
    headers: req.headers as any
  });

  const result = await orchestrator.processEvent(event);

  // Direct response path for Telegram: send the LLM output back to the chat_id.
  if (event.provider === "telegram") {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = (event.metadata as any)?.telegram?.chat_id;

    if (botToken && chatId && result.responseText) {
      const tg = new TelegramConnector({ botToken });
      // Use MarkdownV2 by default; escape to avoid formatting errors.
      await tg.sendMessage({
        chatId,
        parseMode: "MarkdownV2",
        text: escapeMarkdownV2(result.responseText)
      });
    }
  }

  // For Twilio SMS, you would return TwiML. For MVP, return JSON.
  return reply.send(result);
});

app.listen({ port: Number(process.env.PORT ?? 3001), host: "0.0.0.0" });
