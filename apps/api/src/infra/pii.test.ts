import { describe, it, expect } from "vitest";
import { redactPII, hashIdentifier } from "./pii.js";

describe("redactPII", () => {
  it("redacts email addresses", () => {
    const result = redactPII("contact me at user@example.com please");
    expect(result).toBe("contact me at [REDACTED_EMAIL] please");
  });

  it("redacts phone numbers", () => {
    const result = redactPII("call me at 555-867-5309");
    expect(result).toContain("[REDACTED_PHONE]");
  });

  it("redacts credit card numbers", () => {
    const result = redactPII("my card is 4111 1111 1111 1111");
    expect(result).toContain("[REDACTED_CARD]");
  });

  it("passes clean text through unchanged", () => {
    const result = redactPII("hello how are you today");
    expect(result).toBe("hello how are you today");
  });

  it("redacts multiple PII items in one string", () => {
    const result = redactPII("email user@test.com phone 555-867-5309");
    expect(result).toContain("[REDACTED_EMAIL]");
    expect(result).toContain("[REDACTED_PHONE]");
  });
});

describe("hashIdentifier", () => {
  it("returns a 64-character hex string", async () => {
    const result = await hashIdentifier("user@example.com", "test-salt");
    expect(result).toHaveLength(64);
    expect(result).toMatch(/^[0-9a-f]+$/);
  });

  it("produces the same output for the same input and salt", async () => {
    const a = await hashIdentifier("user@example.com", "test-salt");
    const b = await hashIdentifier("user@example.com", "test-salt");
    expect(a).toBe(b);
  });

  it("produces different output for different salts", async () => {
    const a = await hashIdentifier("user@example.com", "salt-one");
    const b = await hashIdentifier("user@example.com", "salt-two");
    expect(a).not.toBe(b);
  });

  it("produces different output for different values", async () => {
    const a = await hashIdentifier("user-one@example.com", "salt");
    const b = await hashIdentifier("user-two@example.com", "salt");
    expect(a).not.toBe(b);
  });
});
