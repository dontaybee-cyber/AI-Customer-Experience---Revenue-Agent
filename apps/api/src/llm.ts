/**
 * LLM integration (MVP)
 * - Designed for streaming responses.
 * - This is a stub that returns a fast deterministic response.
 *
 * Replace with OpenAI/Anthropic/etc. streaming client.
 */

import OpenAI from "openai";

export interface LlmMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface StreamToken {
  token: string;
}

export interface LlmClient {
  streamChat(input: { messages: LlmMessage[] }): AsyncIterable<StreamToken>;
}

export class StubLlmClient implements LlmClient {
  async *streamChat(input: { messages: LlmMessage[] }): AsyncIterable<StreamToken> {
    const lastUser = [...input.messages].reverse().find((m) => m.role === "user")?.content ?? "";
    const response = `Acknowledged. I have your cross-channel context. You said: "${lastUser.slice(0, 120)}"`;
    // stream in chunks
    for (const chunk of response.match(/.{1,24}/g) ?? []) {
      yield { token: chunk };
      await new Promise((r) => setTimeout(r, 10));
    }
  }
}

// Max tokens per response — keeps costs predictable within $0-$20 budget.
const MAX_TOKENS = 500;

export class OpenAiLlmClient implements LlmClient {
  private readonly client: OpenAI;
  private readonly model: string;

  constructor(apiKey: string, model = "gpt-4o-mini") {
    this.client = new OpenAI({ apiKey });
    this.model = model;
  }

  async *streamChat(input: { messages: LlmMessage[] }): AsyncIterable<StreamToken> {
    const stream = await this.client.chat.completions.create({
      model: this.model,
      max_tokens: MAX_TOKENS,
      stream: true,
      messages: input.messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    });

    for await (const chunk of stream) {
      const token = chunk.choices[0]?.delta?.content;
      if (token) {
        yield { token };
      }
    }
  }
}
