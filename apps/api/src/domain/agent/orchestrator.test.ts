import { describe, it, expect, vi } from "vitest";
import { Orchestrator } from "./orchestrator.js";
import type { OrchestratorDeps } from "./orchestrator.js";
import type { InternalEvent } from "@acx/shared";

vi.mock("../../queue.js", () => ({
  triggerQueue: { add: vi.fn().mockResolvedValue(undefined) },
  QUEUE_CONNECTION: { url: "redis://localhost:6379" },
}));

const sampleEvent: InternalEvent = {
  id: "evt_001",
  provider: "webchat",
  type: "message.received",
  channel: "web",
  occurredAt: "2026-01-01T00:00:00.000Z",
  customerExternalId: "user_abc",
  conversationExternalId: "conv_xyz",
  text: "I need help with my order",
  metadata: {},
};

function makeDeps(): OrchestratorDeps {
  return {
    audit: { write: vi.fn().mockResolvedValue(undefined) },
    llm: {
      streamChat: async function* () {
        yield { token: "Hello " };
        yield { token: "world" };
      },
    },
    store: {
      getCustomerByExternalId: vi.fn().mockResolvedValue({ id: "cust_123" }),
      getOpenTickets: vi.fn().mockResolvedValue([]),
      getRecentMessages: vi.fn().mockResolvedValue([]),
    } as unknown as OrchestratorDeps["store"],
  };
}

// Mock getContext from @acx/memory
vi.mock("@acx/memory", () => ({
  getContext: vi.fn().mockResolvedValue({
    customerId: "cust_123",
    recentMessages: [],
    semanticMemories: [],
    openTickets: [],
  }),
  SupabaseContinuityStore: vi.fn().mockImplementation(() => ({})),
}));

describe("Orchestrator.run", () => {
  it("calls audit.write twice (event_received + response_generated)", async () => {
    const deps = makeDeps();
    const orchestrator = new Orchestrator(deps);
    await orchestrator.run(sampleEvent);
    expect(deps.audit.write).toHaveBeenCalledTimes(2);
  });

  it("first audit write has action event_received", async () => {
    const deps = makeDeps();
    const orchestrator = new Orchestrator(deps);
    await orchestrator.run(sampleEvent);
    expect(deps.audit.write).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ action: "event_received" })
    );
  });

  it("second audit write has action response_generated", async () => {
    const deps = makeDeps();
    const orchestrator = new Orchestrator(deps);
    await orchestrator.run(sampleEvent);
    expect(deps.audit.write).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ action: "response_generated" })
    );
  });

  it("assembles full LLM response text", async () => {
    const deps = makeDeps();
    const orchestrator = new Orchestrator(deps);
    const result = await orchestrator.run(sampleEvent);
    expect(result.responseText).toBe("Hello world");
  });

  it("returns correct eventId and customerId", async () => {
    const deps = makeDeps();
    const orchestrator = new Orchestrator(deps);
    const result = await orchestrator.run(sampleEvent);
    expect(result.eventId).toBe("evt_001");
    expect(result.customerId).toBe("cust_123");
  });

  it("returns empty triggerActions array", async () => {
    const deps = makeDeps();
    const orchestrator = new Orchestrator(deps);
    const result = await orchestrator.run(sampleEvent);
    expect(result.triggerActions).toEqual([]);
  });

  it("stores a string (not a Promise) in customerExternalIdHash", async () => {
    const deps = makeDeps();
    const orchestrator = new Orchestrator(deps);
    await orchestrator.run(sampleEvent);
    const firstCall = (deps.audit.write as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(typeof firstCall.details.customerExternalIdHash).toBe("string");
    expect(firstCall.details.customerExternalIdHash).toHaveLength(64);
  });
});
