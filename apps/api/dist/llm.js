/**
 * LLM integration (MVP)
 * - Designed for streaming responses.
 * - This is a stub that returns a fast deterministic response.
 *
 * Replace with OpenAI/Anthropic/etc. streaming client.
 */
export class StubLlmClient {
    async *streamChat(input) {
        const lastUser = [...input.messages].reverse().find((m) => m.role === "user")?.content ?? "";
        const response = `Acknowledged. I have your cross-channel context. You said: "${lastUser.slice(0, 120)}"`;
        // stream in chunks
        for (const chunk of response.match(/.{1,24}/g) ?? []) {
            yield { token: chunk };
            await new Promise((r) => setTimeout(r, 10));
        }
    }
}
//# sourceMappingURL=llm.js.map