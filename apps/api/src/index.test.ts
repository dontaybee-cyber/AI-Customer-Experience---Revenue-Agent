import { describe, it, expect, vi, beforeEach } from "vitest";

let api: typeof import("./index.js");

vi.mock("@acx/connectors", () => ({
  TelegramConnector: class TelegramConnector {
    static fromEnv() {
      return new TelegramConnector();
    }
    sendMessage = vi.fn().mockResolvedValue(undefined);
  },
}));

beforeEach(async () => {
  vi.resetModules();
  api = await import("./index.js");
});

describe("api index exports", () => {
  it("re-exports services modules", () => {
    expect(api.TriggerEngine).toBeDefined();
    expect(api.PivotManager).toBeDefined();
  });
});
