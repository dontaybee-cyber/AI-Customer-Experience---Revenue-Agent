import { describe, it, expect, vi } from "vitest";
import { TriggerEngine } from "./TriggerEngine.js";

function makeEngine(log = vi.fn()) {
  return new TriggerEngine({ log });
}

describe("services.TriggerEngine.detectBuyingSignals", () => {
  it("returns true for keyword: pricing", async () => {
    const engine = makeEngine();
    expect(await engine.detectBuyingSignals({ content: "pricing details please" })).toBe(true);
  });

  it("returns false for empty content", async () => {
    const engine = makeEngine();
    expect(await engine.detectBuyingSignals({ content: "" })).toBe(false);
  });

  it("uses LLM fallback and logs for upgrade keyword", async () => {
    const log = vi.fn();
    const engine = makeEngine(log);
    const result = await engine.detectBuyingSignals({ content: "we want to upgrade" });
    expect(result).toBe(true);
    expect(log).toHaveBeenCalledWith(expect.stringContaining("[MOCK]"));
  });
});
