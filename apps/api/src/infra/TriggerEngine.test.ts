import { describe, it, expect, vi } from "vitest";
import { TriggerEngine } from "./TriggerEngine.js";

function makeEngine(log = vi.fn()) {
  return new TriggerEngine({ log });
}

describe("TriggerEngine.detectBuyingSignals", () => {
  it("returns true for keyword: pricing", async () => {
    const engine = makeEngine();
    expect(await engine.detectBuyingSignals({ content: "what is your pricing" })).toBe(true);
  });

  it("returns true for keyword: demo", async () => {
    const engine = makeEngine();
    expect(await engine.detectBuyingSignals({ content: "can I see a demo" })).toBe(true);
  });

  it("returns true for keyword: integration", async () => {
    const engine = makeEngine();
    expect(await engine.detectBuyingSignals({ content: "does this work with our integration" })).toBe(true);
  });

  it("returns true for keyword: scalability", async () => {
    const engine = makeEngine();
    expect(await engine.detectBuyingSignals({ content: "I have questions about scalability" })).toBe(true);
  });

  it("returns false for unrelated message", async () => {
    const engine = makeEngine();
    expect(await engine.detectBuyingSignals({ content: "hello there how are you" })).toBe(false);
  });

  it("returns false for empty content", async () => {
    const engine = makeEngine();
    expect(await engine.detectBuyingSignals({ content: "" })).toBe(false);
  });

  it("LLM fallback returns true for: upgrade", async () => {
    const log = vi.fn();
    const engine = makeEngine(log);
    const result = await engine.detectBuyingSignals({ content: "we want to upgrade our plan" });
    expect(result).toBe(true);
    expect(log).toHaveBeenCalledWith(expect.stringContaining("[MOCK]"));
  });

  it("LLM fallback returns true for: enterprise", async () => {
    const engine = makeEngine();
    expect(await engine.detectBuyingSignals({ content: "we are an enterprise customer" })).toBe(true);
  });

  it("LLM fallback returns false for non-buying message", async () => {
    const log = vi.fn();
    const engine = makeEngine(log);
    const result = await engine.detectBuyingSignals({ content: "thank you for your help" });
    expect(result).toBe(false);
    expect(log).toHaveBeenCalledWith(expect.stringContaining("[MOCK]"));
  });
});
