import { describe, it, expect, vi } from "vitest";
import { PivotManager, AgentState } from "./PivotManager.js";
import type { PivotManagerDeps } from "./PivotManager.js";

const sampleMessage = {
  id: "msg_001",
  channel: "sms",
  identity: "+15551234567",
  content: "hello",
  timestamp: Date.now(),
  conversationId: "conv_001",
};

function makeDeps(overrides: Partial<PivotManagerDeps> = {}): PivotManagerDeps {
  return {
    triggerEngine: { detectBuyingSignals: vi.fn().mockResolvedValue(false) },
    telegram: { sendMessage: vi.fn().mockResolvedValue(undefined), fromEnv: vi.fn() },
    audit: { write: vi.fn().mockResolvedValue(undefined) },
    log: vi.fn(),
    ...overrides,
  } as unknown as PivotManagerDeps;
}

describe("PivotManager", () => {
  it("initial state is SUPPORT_TRIAGE", () => {
    const pm = new PivotManager(makeDeps());
    expect(pm.getState()).toBe(AgentState.SUPPORT_TRIAGE);
  });

  it("does not transition when resolutionScore is low", async () => {
    const pm = new PivotManager(makeDeps());
    await pm.handleMessage(sampleMessage, 0.5, 0.5);
    expect(pm.getState()).toBe(AgentState.SUPPORT_TRIAGE);
  });

  it("transitions to RESOLVED from SUPPORT_ACTIVE when resolutionScore > 0.9", async () => {
    const deps = makeDeps();
    const pm = new PivotManager(deps);
    // Manually set state to SUPPORT_ACTIVE
    (pm as unknown as { state: AgentState }).state = AgentState.SUPPORT_ACTIVE;
    await pm.handleMessage(sampleMessage, 0.95, -0.1);
    expect(pm.getState()).toBe(AgentState.RESOLVED);
  });

  it("transitions to SALES_QUALIFY when conditions met", async () => {
    const deps = makeDeps({
      triggerEngine: { detectBuyingSignals: vi.fn().mockResolvedValue(true) },
    } as unknown as Partial<PivotManagerDeps>);
    const pm = new PivotManager(deps);
    await pm.handleMessage(sampleMessage, 0.95, 0.5);
    expect(pm.getState()).toBe(AgentState.SALES_QUALIFY);
  });

  it("does not transition to SALES_QUALIFY when sentimentEma <= 0", async () => {
    const deps = makeDeps({
      triggerEngine: { detectBuyingSignals: vi.fn().mockResolvedValue(true) },
    } as unknown as Partial<PivotManagerDeps>);
    const pm = new PivotManager(deps);
    await pm.handleMessage(sampleMessage, 0.95, -0.1);
    expect(pm.getState()).not.toBe(AgentState.SALES_QUALIFY);
  });

  it("calls audit.write with action pivot_to_sales on SALES_QUALIFY transition", async () => {
    const deps = makeDeps({
      triggerEngine: { detectBuyingSignals: vi.fn().mockResolvedValue(true) },
    } as unknown as Partial<PivotManagerDeps>);
    const pm = new PivotManager(deps);
    await pm.handleMessage(sampleMessage, 0.95, 0.5);
    expect(deps.audit.write).toHaveBeenCalledWith(
      expect.objectContaining({ action: "pivot_to_sales" })
    );
  });

  it("sends hashed identity to telegram when admin chat id set", async () => {
    process.env.TELEGRAM_ADMIN_CHAT_ID = "admin_chat_123";
    const deps = makeDeps({
      triggerEngine: { detectBuyingSignals: vi.fn().mockResolvedValue(true) },
    } as unknown as Partial<PivotManagerDeps>);
    const pm = new PivotManager(deps);
    await pm.handleMessage(sampleMessage, 0.95, 0.5);
    // Allow fire-and-forget to settle
    await new Promise((r) => setTimeout(r, 50));
    expect(deps.telegram.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        chatId: "admin_chat_123",
        text: expect.not.stringContaining("+15551234567"),
      })
    );
    delete process.env.TELEGRAM_ADMIN_CHAT_ID;
  });

  it("logs when TELEGRAM_ADMIN_CHAT_ID is not set", async () => {
    delete process.env.TELEGRAM_ADMIN_CHAT_ID;
    const deps = makeDeps({
      triggerEngine: { detectBuyingSignals: vi.fn().mockResolvedValue(true) },
    } as unknown as Partial<PivotManagerDeps>);
    const pm = new PivotManager(deps);
    await pm.handleMessage(sampleMessage, 0.95, 0.5);
    await new Promise((r) => setTimeout(r, 50));
    expect(deps.log).toHaveBeenCalledWith(
      expect.stringContaining("TELEGRAM_ADMIN_CHAT_ID not set")
    );
  });
});
