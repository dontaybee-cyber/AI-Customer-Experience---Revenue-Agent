import { describe, it, expect, vi } from "vitest";
import { PivotManager, AgentState } from "./PivotManager.js";
import { TriggerEngine } from "./TriggerEngine.js";
import type { PivotManagerDeps } from "./PivotManager.js";

const sampleMessage = {
  id: "msg_001",
  channel: "sms",
  identity: "+15551234567",
  content: "hello",
  timestamp: Date.now(),
  conversationId: "conv_001",
};

function makeTriggerEngine(result: boolean) {
  const engine = new TriggerEngine({ log: vi.fn() });
  engine.detectBuyingSignals = vi.fn().mockResolvedValue(result);
  return engine;
}

function makeDeps(overrides: Partial<PivotManagerDeps> = {}): PivotManagerDeps {
  return {
    triggerEngine: makeTriggerEngine(false),
    telegram: { sendMessage: vi.fn().mockResolvedValue(undefined) },
    audit: { write: vi.fn().mockResolvedValue(undefined) },
    ...overrides,
  } as unknown as PivotManagerDeps;
}

describe("services.PivotManager", () => {
  it("initial state is SUPPORT_TRIAGE", () => {
    const pm = new PivotManager(makeDeps());
    expect(pm.getState()).toBe(AgentState.SUPPORT_TRIAGE);
  });

  it("transitions to RESOLVED from SUPPORT_ACTIVE when resolutionScore > 0.9", async () => {
    const deps = makeDeps();
    const pm = new PivotManager(deps);
    (pm as unknown as { state: AgentState }).state = AgentState.SUPPORT_ACTIVE;
    await pm.handleMessage(sampleMessage, 0.95, -0.1);
    expect(pm.getState()).toBe(AgentState.RESOLVED);
    expect(deps.audit.write).toHaveBeenCalledWith(
      expect.objectContaining({ action: "state_transition" })
    );
  });

  it("transitions to SALES_QUALIFY and logs pivot events", async () => {
    const deps = makeDeps({
      triggerEngine: makeTriggerEngine(true),
    });
    const pm = new PivotManager(deps);
    await pm.handleMessage(sampleMessage, 0.95, 0.5);
    expect(pm.getState()).toBe(AgentState.SALES_QUALIFY);
    expect(deps.audit.write).toHaveBeenCalledWith(
      expect.objectContaining({ action: "pivot_to_sales" })
    );
    expect(deps.audit.write).toHaveBeenCalledWith(
      expect.objectContaining({ action: "generate_pivot_prompt" })
    );
  });

  it("sends hashed identity to telegram when admin chat id set", async () => {
    process.env.TELEGRAM_ADMIN_CHAT_ID = "admin_chat_123";
    const deps = makeDeps({
      triggerEngine: makeTriggerEngine(true),
    });
    const pm = new PivotManager(deps);
    await pm.handleMessage(sampleMessage, 0.95, 0.5);
    await new Promise((r) => setTimeout(r, 50));
    expect(deps.telegram.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        chatId: "admin_chat_123",
        text: expect.not.stringContaining("+15551234567"),
      })
    );
    delete process.env.TELEGRAM_ADMIN_CHAT_ID;
  });

  it("writes skip_admin_notification when TELEGRAM_ADMIN_CHAT_ID is not set", async () => {
    delete process.env.TELEGRAM_ADMIN_CHAT_ID;
    const deps = makeDeps({
      triggerEngine: makeTriggerEngine(true),
    });
    const pm = new PivotManager(deps);
    await pm.handleMessage(sampleMessage, 0.95, 0.5);
    await new Promise((r) => setTimeout(r, 20));
    expect(deps.audit.write).toHaveBeenCalledWith(
      expect.objectContaining({ action: "skip_admin_notification" })
    );
  });
});
