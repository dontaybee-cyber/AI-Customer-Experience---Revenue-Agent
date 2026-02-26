import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";

const serverMocks = vi.hoisted(() => {
  const routes = {
    get: new Map<string, (req?: unknown, reply?: unknown) => Promise<unknown> | unknown>(),
    post: new Map<string, (req: unknown, reply: unknown) => Promise<unknown> | unknown>(),
  };

  const app = {
    register: vi.fn(),
    get: vi.fn(
      (path: string, handler: (req?: unknown, reply?: unknown) => Promise<unknown> | unknown) => {
        routes.get.set(path, handler);
      },
    ),
    post: vi.fn(
      (path: string, handler: (req: unknown, reply: unknown) => Promise<unknown> | unknown) => {
        routes.post.set(path, handler);
      },
    ),
    listen: vi.fn(),
  };

  const fastifyFactory = vi.fn(() => app);

  const normalizeEvent = vi.fn();
  const run = vi.fn().mockResolvedValue({
    eventId: "evt_1",
    customerId: "cust_1",
    responseText: "hello",
    triggerActions: [],
  });

  const telegramInstances: Array<{
    sendMessage: ReturnType<typeof vi.fn>;
    opts: { botToken: string };
  }> = [];

  class TelegramConnector {
    public sendMessage = vi.fn().mockResolvedValue(undefined);
    public opts: { botToken: string };
    constructor(opts: { botToken: string }) {
      this.opts = opts;
      telegramInstances.push(this);
    }
  }

  const escapeMarkdownV2 = vi.fn((text: string) => `escaped:${text}`);

  class HubSpotAdapter {
    public token: string;
    constructor(token: string) {
      this.token = token;
    }
  }

  class SupabaseContinuityStore {}

  class ConsoleAuditLogger {
    async write() {
      return;
    }
  }

  class Orchestrator {
    public run = run;
    constructor() {}
  }

  return {
    routes,
    app,
    fastifyFactory,
    normalizeEvent,
    run,
    telegramInstances,
    TelegramConnector,
    escapeMarkdownV2,
    HubSpotAdapter,
    SupabaseContinuityStore,
    ConsoleAuditLogger,
    Orchestrator,
  };
});

vi.mock("fastify", () => ({
  default: serverMocks.fastifyFactory,
}));

vi.mock("./normalizeEvent.js", () => ({
  normalizeEvent: serverMocks.normalizeEvent,
}));

vi.mock("./domain/agent/orchestrator.js", () => ({
  Orchestrator: serverMocks.Orchestrator,
}));

vi.mock("@acx/connectors", () => ({
  HubSpotAdapter: serverMocks.HubSpotAdapter,
  TelegramConnector: serverMocks.TelegramConnector,
  escapeMarkdownV2: serverMocks.escapeMarkdownV2,
}));

vi.mock("@acx/memory", () => ({
  SupabaseContinuityStore: serverMocks.SupabaseContinuityStore,
}));

vi.mock("./infra/audit.js", () => ({
  ConsoleAuditLogger: serverMocks.ConsoleAuditLogger,
}));

type ReplyStub = {
  statusCode: number;
  payload?: unknown;
  status: (code: number) => ReplyStub;
  send: (payload?: unknown) => ReplyStub;
};

function createReply(): ReplyStub {
  const reply: ReplyStub = {
    statusCode: 200,
    status(code: number) {
      reply.statusCode = code;
      return reply;
    },
    send(payload?: unknown) {
      reply.payload = payload;
      return reply;
    },
  };
  return reply;
}

beforeAll(async () => {
  await import("./server.js");
});

beforeEach(() => {
  serverMocks.normalizeEvent.mockReset();
  serverMocks.run.mockReset();
  serverMocks.escapeMarkdownV2.mockClear();
  serverMocks.telegramInstances.length = 0;
});

describe("server bootstrap", () => {
  it("registers routes and listens", () => {
    expect(serverMocks.fastifyFactory).toHaveBeenCalledWith(
      expect.objectContaining({ logger: true, bodyLimit: 64 * 1024 }),
    );
    expect(serverMocks.app.register).toHaveBeenCalled();
    expect(serverMocks.app.listen).toHaveBeenCalledWith(
      expect.objectContaining({ host: "0.0.0.0" }),
    );
    expect(serverMocks.routes.get.has("/health")).toBe(true);
    expect(serverMocks.routes.post.has("/webhooks/:provider")).toBe(true);
  });

  it("health endpoint returns ok", async () => {
    const handler = serverMocks.routes.get.get("/health");
    const result = await handler?.();
    expect(result).toEqual({ ok: true });
  });
});

describe("webhook handler", () => {
  it("rejects unsupported providers", async () => {
    const handler = serverMocks.routes.post.get("/webhooks/:provider");
    const reply = createReply();
    await handler?.({ params: { provider: "unknown" }, body: {}, headers: {} }, reply);
    expect(reply.statusCode).toBe(400);
    expect(reply.payload).toEqual({ error: "Unsupported provider: unknown" });
    expect(serverMocks.normalizeEvent).not.toHaveBeenCalled();
  });

  it("returns orchestrator result for supported provider", async () => {
    const handler = serverMocks.routes.post.get("/webhooks/:provider");
    const reply = createReply();
    const event = {
      id: "evt_1",
      provider: "webchat",
      type: "message.received",
      channel: "web",
      occurredAt: "2026-01-01T00:00:00.000Z",
      customerExternalId: "user_1",
      conversationExternalId: "conv_1",
      text: "hi",
      metadata: {},
    };

    serverMocks.normalizeEvent.mockReturnValueOnce(event);
    serverMocks.run.mockResolvedValueOnce({
      eventId: "evt_1",
      customerId: "cust_1",
      responseText: "ok",
      triggerActions: [],
    });

    await handler?.(
      { params: { provider: "webchat" }, body: { hello: "world" }, headers: {} },
      reply,
    );
    expect(serverMocks.normalizeEvent).toHaveBeenCalled();
    expect(serverMocks.run).toHaveBeenCalledWith(event);
    expect(reply.payload).toEqual({
      eventId: "evt_1",
      customerId: "cust_1",
      responseText: "ok",
      triggerActions: [],
    });
  });

  it("sends telegram response when credentials are present", async () => {
    process.env.TELEGRAM_BOT_TOKEN = "bot_token";
    const handler = serverMocks.routes.post.get("/webhooks/:provider");
    const reply = createReply();
    const event = {
      id: "evt_2",
      provider: "telegram",
      type: "message.received",
      channel: "telegram",
      occurredAt: "2026-01-01T00:00:00.000Z",
      customerExternalId: "tg_user:1",
      conversationExternalId: "tg_chat:2",
      text: "Hello *world*",
      metadata: { telegram: { chat_id: "chat_1" } },
    };

    serverMocks.normalizeEvent.mockReturnValueOnce(event);
    serverMocks.run.mockResolvedValueOnce({
      eventId: "evt_2",
      customerId: "cust_2",
      responseText: "Hello *world*",
      triggerActions: [],
    });

    await handler?.({ params: { provider: "telegram" }, body: {}, headers: {} }, reply);

    const tg = serverMocks.telegramInstances[0];
    expect(tg?.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        chatId: "chat_1",
        parseMode: "MarkdownV2",
        text: "escaped:Hello *world*",
      }),
    );

    delete process.env.TELEGRAM_BOT_TOKEN;
  });
});
