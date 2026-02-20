/**
 * LLM integration (MVP)
 * - Designed for streaming responses.
 * - This is a stub that returns a fast deterministic response.
 *
 * Replace with OpenAI/Anthropic/etc. streaming client.
 */
export interface LlmMessage {
    role: "system" | "user" | "assistant";
    content: string;
}
export interface StreamToken {
    token: string;
}
export interface LlmClient {
    streamChat(input: {
        messages: LlmMessage[];
    }): AsyncIterable<StreamToken>;
}
export declare class StubLlmClient implements LlmClient {
    streamChat(input: {
        messages: LlmMessage[];
    }): AsyncIterable<StreamToken>;
}
//# sourceMappingURL=llm.d.ts.map