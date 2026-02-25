import { describe, it, expect } from "vitest";
import { StubLlmClient } from "./llm.js";

describe("StubLlmClient", () => {
  it("streams a response that includes the last user message", async () => {
    const client = new StubLlmClient();
    const tokens: string[] = [];
    for await (const chunk of client.streamChat({
      messages: [
        { role: "user", content: "first message" },
        { role: "assistant", content: "ack" },
        { role: "user", content: "latest message" },
      ],
    })) {
      tokens.push(chunk.token);
    }

    const response = tokens.join("");
    expect(response).toContain('You said: "latest message"');
    expect(response.startsWith("Acknowledged.")).toBe(true);
    expect(tokens.every((t) => t.length <= 24)).toBe(true);
  });
});
