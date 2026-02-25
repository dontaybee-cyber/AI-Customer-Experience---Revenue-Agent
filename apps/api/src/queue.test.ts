import { describe, it, expect, vi, beforeEach } from "vitest";

const queueMocks = vi.hoisted(() => {
  const queueInstances: Array<{ name: string; options: unknown }> = [];

  class Queue {
    public name: string;
    public options: unknown;
    constructor(name: string, options: unknown) {
      this.name = name;
      this.options = options;
      queueInstances.push({ name, options });
    }
  }

  return { queueInstances, Queue };
});

vi.mock("bullmq", () => ({
  Queue: queueMocks.Queue,
}));

describe("queue", () => {
  beforeEach(() => {
    queueMocks.queueInstances.length = 0;
    vi.resetModules();
  });

  it("uses REDIS_URL when provided", async () => {
    process.env.REDIS_URL = "redis://example:6379";
    const mod = await import("./queue.js");
    expect(mod.QUEUE_CONNECTION.url).toBe("redis://example:6379");
    expect(queueMocks.queueInstances[0]?.name).toBe("acx-triggers");
    const options = queueMocks.queueInstances[0]?.options as { connection: { url: string } };
    expect(options.connection.url).toBe("redis://example:6379");
    delete process.env.REDIS_URL;
  });

  it("falls back to localhost when REDIS_URL is missing", async () => {
    delete process.env.REDIS_URL;
    const mod = await import("./queue.js");
    expect(mod.QUEUE_CONNECTION.url).toBe("redis://localhost:6379");
  });
});
