import { describe, it, expect, vi, beforeEach } from "vitest";

const workerMocks = vi.hoisted(() => {
  const workers: Array<{
    name: string;
    processor: (job: unknown) => Promise<unknown>;
    options: unknown;
    handlers: Record<string, (job: unknown, err: Error) => Promise<void>>;
  }> = [];

  class Worker {
    public name: string;
    public processor: (job: unknown) => Promise<unknown>;
    public options: unknown;
    public handlers: Record<string, (job: unknown, err: Error) => Promise<void>> = {};

    constructor(name: string, processor: (job: unknown) => Promise<unknown>, options: unknown) {
      this.name = name;
      this.processor = processor;
      this.options = options;
      workers.push(this);
    }

    on(event: string, handler: (job: unknown, err: Error) => Promise<void>) {
      this.handlers[event] = handler;
    }
  }

  class Queue {
    public name: string;
    public options: unknown;
    constructor(name: string, options: unknown) {
      this.name = name;
      this.options = options;
    }
  }

  return { workers, Worker, Queue };
});

const triggerMocks = vi.hoisted(() => ({
  evaluateTriggers: vi.fn(),
}));

const memoryMocks = vi.hoisted(() => {
  const storeInstances: Array<{ getCustomerProfile: ReturnType<typeof vi.fn> }> = [];
  class SupabaseContinuityStore {
    public getCustomerProfile = vi.fn().mockResolvedValue({ id: "profile_123" });
    constructor() {
      storeInstances.push(this);
    }
  }
  return { storeInstances, SupabaseContinuityStore };
});

const connectorMocks = vi.hoisted(() => {
  const telegramInstances: Array<{
    sendAdminAlert: ReturnType<typeof vi.fn>;
    opts: { botToken: string };
  }> = [];
  const hubspotInstances: Array<{
    upsertContact: ReturnType<typeof vi.fn>;
    createDeal: ReturnType<typeof vi.fn>;
    token: string;
  }> = [];

  class TelegramConnector {
    public sendAdminAlert = vi.fn().mockResolvedValue(undefined);
    public opts: { botToken: string };
    constructor(opts: { botToken: string }) {
      this.opts = opts;
      telegramInstances.push(this);
    }
  }

  class HubSpotAdapter {
    public upsertContact = vi.fn().mockResolvedValue(undefined);
    public createDeal = vi.fn().mockResolvedValue(undefined);
    public token: string;
    constructor(token: string) {
      this.token = token;
      hubspotInstances.push(this);
    }
  }

  return { telegramInstances, hubspotInstances, TelegramConnector, HubSpotAdapter };
});

const auditMocks = vi.hoisted(() => {
  const writes: Array<unknown> = [];
  class ConsoleAuditLogger {
    async write(event: unknown) {
      writes.push(event);
    }
  }
  return { writes, ConsoleAuditLogger };
});

vi.mock("bullmq", () => ({
  Worker: workerMocks.Worker,
  Queue: workerMocks.Queue,
}));

vi.mock("@acx/trigger-engine", () => ({
  evaluateTriggers: triggerMocks.evaluateTriggers,
}));

vi.mock("@acx/memory", () => ({
  SupabaseContinuityStore: memoryMocks.SupabaseContinuityStore,
}));

vi.mock("@acx/connectors", () => ({
  TelegramConnector: connectorMocks.TelegramConnector,
  HubSpotAdapter: connectorMocks.HubSpotAdapter,
}));

vi.mock("./infra/audit.js", () => ({
  ConsoleAuditLogger: auditMocks.ConsoleAuditLogger,
}));

type TriggerJobData = {
  customerId: string;
  event: { channel?: string; text?: string };
  recentMessages: unknown[];
};

function makeJob(name: string, data: TriggerJobData) {
  return { id: "job_1", name, data };
}

describe("worker", () => {
  beforeEach(() => {
    workerMocks.workers.length = 0;
    connectorMocks.telegramInstances.length = 0;
    connectorMocks.hubspotInstances.length = 0;
    memoryMocks.storeInstances.length = 0;
    auditMocks.writes.length = 0;
    triggerMocks.evaluateTriggers.mockReset();
    vi.resetModules();
  });

  it("ignores jobs that are not evaluate_triggers", async () => {
    triggerMocks.evaluateTriggers.mockResolvedValue({
      signals: { churnRisk: 0.1, sentimentEma: 0.1 },
      actions: [],
    });

    await import("./worker.js");
    const worker = workerMocks.workers[0];
    const result = await worker.processor(
      makeJob("noop", { customerId: "cust_1", event: {}, recentMessages: [] }),
    );

    expect(result).toBeUndefined();
    expect(triggerMocks.evaluateTriggers).not.toHaveBeenCalled();
  });

  it("processes evaluate_triggers and dispatches actions", async () => {
    triggerMocks.evaluateTriggers.mockResolvedValue({
      signals: { churnRisk: 0.2, sentimentEma: 0.7 },
      actions: [{ type: "admin_alert" }, { type: "crm_sync" }, { type: "pivot_to_sales" }],
    });

    process.env.TELEGRAM_BOT_TOKEN = "bot_token";
    process.env.TELEGRAM_ADMIN_CHAT_ID = "admin_chat";

    await import("./worker.js");
    const worker = workerMocks.workers[0];
    const result = await worker.processor(
      makeJob("evaluate_triggers", {
        customerId: "cust_1",
        event: { channel: "web", text: "hi" },
        recentMessages: [],
      }),
    );

    expect(result).toEqual(
      expect.objectContaining({ actions: expect.any(Array), signals: expect.any(Object) }),
    );
    expect(connectorMocks.telegramInstances[0]?.sendAdminAlert).toHaveBeenCalled();
    expect(connectorMocks.hubspotInstances[0]?.upsertContact).toHaveBeenCalled();
    expect(connectorMocks.hubspotInstances[0]?.createDeal).toHaveBeenCalled();
    expect(memoryMocks.storeInstances[0]?.getCustomerProfile).toHaveBeenCalledWith("cust_1");
    expect(
      auditMocks.writes.some((e) => (e as { action?: string }).action === "trigger_job_processed"),
    ).toBe(true);

    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_ADMIN_CHAT_ID;
  });

  it("writes audit record when a job fails", async () => {
    await import("./worker.js");
    const worker = workerMocks.workers[0];
    const err = new Error("boom");

    const handler = worker.handlers.failed;
    await handler?.({ id: "job_2" }, err);

    expect(
      auditMocks.writes.some((e) => (e as { action?: string }).action === "trigger_job_failed"),
    ).toBe(true);
  });
});
