import { describe, it, expect, vi, beforeEach } from "vitest";
import type { FastifyInstance } from "fastify";

let voiceRoutes: typeof import("./voice.js").default;

const memoryMocks = vi.hoisted(() => {
  const getContext = vi.fn();
  class SupabaseContinuityStore {}
  return { getContext, SupabaseContinuityStore };
});

const connectorMocks = vi.hoisted(() => {
  const vapiInstances: Array<{ formatAssistantResponse: ReturnType<typeof vi.fn> }> = [];
  class VapiConnector {
    public formatAssistantResponse = vi.fn().mockReturnValue({ assistant: { firstMessage: "ok" } });
    constructor() {
      vapiInstances.push(this);
    }
  }
  class HubSpotAdapter {
    public token: string;
    constructor(token: string) {
      this.token = token;
    }
  }
  return { vapiInstances, VapiConnector, HubSpotAdapter };
});

vi.mock("@acx/memory", () => ({
  getContext: memoryMocks.getContext,
  SupabaseContinuityStore: memoryMocks.SupabaseContinuityStore,
}));

vi.mock("@acx/connectors", () => ({
  VapiConnector: connectorMocks.VapiConnector,
  HubSpotAdapter: connectorMocks.HubSpotAdapter,
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

describe("voiceRoutes", () => {
  const routes = new Map<string, (req: { body: unknown }, reply: ReplyStub) => Promise<unknown>>();
  const fastify = {
    post: vi.fn(
      (path: string, handler: (req: { body: unknown }, reply: ReplyStub) => Promise<unknown>) => {
        routes.set(path, handler);
      },
    ),
    log: { error: vi.fn(), info: vi.fn() },
  } as unknown as FastifyInstance;

  beforeEach(async () => {
    routes.clear();
    memoryMocks.getContext.mockReset();
    connectorMocks.vapiInstances.length = 0;
    vi.resetModules();
    ({ default: voiceRoutes } = await import("./voice.js"));
    await voiceRoutes(fastify, {});
  });

  it("returns 400 when customer number is missing", async () => {
    const handler = routes.get("/voice/vapi-request");
    const reply = createReply();
    await handler?.({ body: { message: { customer: {} } } }, reply);
    expect(reply.statusCode).toBe(400);
    expect(reply.payload).toBe("Customer number is required.");
  });

  it("returns formatted assistant response for vapi-request", async () => {
    memoryMocks.getContext.mockResolvedValue({ customerId: "cust_1" });
    const handler = routes.get("/voice/vapi-request");
    const reply = createReply();
    await handler?.({ body: { message: { customer: { number: "+15551234567" } } } }, reply);
    expect(reply.statusCode).toBe(200);
    expect(reply.payload).toEqual({ assistant: { firstMessage: "ok" } });
    expect(connectorMocks.vapiInstances[0]?.formatAssistantResponse).toHaveBeenCalled();
  });

  it("returns fallback response when vapi-request throws", async () => {
    memoryMocks.getContext.mockRejectedValue(new Error("boom"));
    const handler = routes.get("/voice/vapi-request");
    const reply = createReply();
    await handler?.({ body: { message: { customer: { number: "+15551234567" } } } }, reply);
    const payload = reply.payload as { assistant?: { firstMessage?: string } };
    expect(payload.assistant?.firstMessage).toBe("Hello, how can I help you today?");
  });

  it("handles vapi-end-report successfully", async () => {
    const handler = routes.get("/voice/vapi-end-report");
    const reply = createReply();
    await handler?.(
      {
        body: {
          message: {
            summary: "summary",
            transcript: "transcript",
            recordingUrl: "http://recording",
            customer: { number: "+15551230000" },
          },
        },
      },
      reply,
    );
    expect(reply.statusCode).toBe(200);
    expect(fastify.log.info as ReturnType<typeof vi.fn>).toHaveBeenCalled();
  });

  it("returns 500 when vapi-end-report throws", async () => {
    const handler = routes.get("/voice/vapi-end-report");
    const reply = createReply();
    await handler?.({ body: undefined }, reply);
    expect(reply.statusCode).toBe(500);
    expect(fastify.log.error as ReturnType<typeof vi.fn>).toHaveBeenCalled();
  });
});
