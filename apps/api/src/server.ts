import type { Provider, TelegramMetadata } from "@acx/shared";
import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";

import { ConsoleAuditLogger } from "./infra/audit.js";
import { normalizeEvent } from "./normalizeEvent.js";
import { StubLlmClient } from "./llm.js";
import { Orchestrator } from "./domain/agent/orchestrator.js";
import { SupabaseContinuityStore } from "@acx/memory";
import { HubSpotAdapter } from "@acx/connectors";
import { TelegramConnector, escapeMarkdownV2 } from "@acx/connectors";
import voiceRoutes from "./routes/voice.js";

// Max webhook body: 64 KB — rejects oversized payloads early to prevent memory exhaustion.
const MAX_WEBHOOK_BODY_BYTES = 64 * 1024;

const app = Fastify({
  logger: true,
  bodyLimit: MAX_WEBHOOK_BODY_BYTES,
});

// Register the voice routes
app.register(voiceRoutes);

const audit = new ConsoleAuditLogger();
const llm = new StubLlmClient();
const continuityStore = new SupabaseContinuityStore();
const crmAdapter = new HubSpotAdapter(process.env.HUBSPOT_ACCESS_TOKEN || "");

const triggerDeps = {
  store: continuityStore,
  crm: crmAdapter,
};

const orchestrator = new Orchestrator({
  audit,
  llm,
  store: continuityStore,
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
interface WebhookParams {
  provider: string;
}

// ...

app.post("/webhooks/:provider", async (req: FastifyRequest, reply: FastifyReply) => {
  const { provider: rawProvider } = req.params as WebhookParams;
  const payload = req.body as unknown;

  const SUPPORTED_PROVIDERS: Provider[] = ["twilio", "vapi", "webchat", "telegram"];
  if (!SUPPORTED_PROVIDERS.includes(rawProvider as Provider)) {
    return reply.status(400).send({ error: `Unsupported provider: ${rawProvider}` });
  }

  const event = normalizeEvent({
    provider: rawProvider as Provider,
    payload,
    headers: req.headers as Record<string, string>,
  });

  const result = await orchestrator.run(event);

  // Direct response path for Telegram: send the LLM output back to the chat_id.
  if (event.provider === "telegram") {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = (event.metadata as { telegram: TelegramMetadata })?.telegram?.chat_id;

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
