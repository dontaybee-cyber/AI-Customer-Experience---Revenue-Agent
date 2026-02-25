import { describe, it, expect, vi } from "vitest";
import { ConsoleAuditLogger, createAuditLogger } from "./audit.js";
import type { AuditEvent } from "./audit.js";

const sampleEvent: AuditEvent = {
  at: "2026-01-01T00:00:00.000Z",
  actor: "system",
  action: "test_action",
  resourceType: "test_resource",
  resourceId: "res_123",
  details: { key: "value" },
};

describe("ConsoleAuditLogger", () => {
  it("writes a JSON string containing the audit event to console.log", async () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const logger = new ConsoleAuditLogger();
    await logger.write(sampleEvent);
    expect(spy).toHaveBeenCalledOnce();
    const written = spy.mock.calls[0][0] as string;
    const parsed = JSON.parse(written) as { audit: AuditEvent };
    expect(parsed.audit.action).toBe("test_action");
    expect(parsed.audit.actor).toBe("system");
    spy.mockRestore();
  });
});

describe("createAuditLogger", () => {
  it("returns an object with a write method", () => {
    const logger = createAuditLogger();
    expect(typeof logger.write).toBe("function");
  });
});
