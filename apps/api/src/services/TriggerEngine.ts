export interface TriggerEngineDeps {
  log: (msg: string) => void;
}

function createDefaultDeps(): TriggerEngineDeps {
  return { log: (msg) => console.warn(msg) };
}

export class TriggerEngine {
  private buyingSignalKeywords: RegExp[];

  constructor(private deps: TriggerEngineDeps = createDefaultDeps()) {
    this.buyingSignalKeywords = [
      /how much does this cost/i,
      /pricing/i,
      /does this work for teams of (\d+)/i,
      /scalability/i,
      /does this work with/i,
      /integration/i,
      /can I see a walkthrough/i,
      /demo/i,
    ];
  }

  public async detectBuyingSignals(message: { content: string }): Promise<boolean> {
    if (!message.content) {
      return false;
    }

    for (const keyword of this.buyingSignalKeywords) {
      if (keyword.test(message.content)) {
        return true;
      }
    }

    return this.detectBuyingSignalsWithLLM(message);
  }

  /**
   * @deprecated — mock implementation, replace with real LLM call
   */
  private async detectBuyingSignalsWithLLM(message: { content: string }): Promise<boolean> {
    this.deps.log(`[MOCK] Using LLM to detect buying signals for message: "${message.content}"`);
    const lowerCaseContent = message.content.toLowerCase();
    const mockKeywords = ["upgrade", "team", "enterprise", "feature compatibility"];

    return mockKeywords.some((keyword) => lowerCaseContent.includes(keyword));
  }
}
