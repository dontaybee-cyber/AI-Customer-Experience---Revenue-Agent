import type { AuditLogger } from '../infra/audit.js';
import { createAuditLogger } from '../infra/audit.js';
import type { Message } from "../types.js";

export interface TriggerEngineDeps {
  audit: AuditLogger;
}

function createDefaultDeps(): TriggerEngineDeps {
  return { audit: createAuditLogger() };
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

  async detectBuyingSignals(message: Message): Promise<boolean> {
    if (message.content) {
      for (const keyword of this.buyingSignalKeywords) {
        if (keyword.test(message.content)) {
          return true;
        }
      }
      // If no keywords are found, use LLM for intent recognition
      return this.detectBuyingSignalsWithLLM(message);
    }
    return false;
  }

  /**
   * @deprecated Mock implementation. Replace with a real LLM call.
   */
  private async detectBuyingSignalsWithLLM(message: Message): Promise<boolean> {
    void this.deps.audit.write({
      at: new Date().toISOString(),
      actor: 'agent',
      action: 'detect_buying_signals_with_llm',
      resourceType: 'message',
      resourceId: message.id,
      details: {
        customerId: message.identity,
        messagePreview: message.content.slice(0, 100),
        mock: true,
      },
    });
    // Mock LLM call to check for buying intent.
    // In a real implementation, this would call a language model to classify the message content.
    const buyingIntents = ["upgrade", "team", "enterprise", "feature compatibility"];
    const lowerCaseContent = message.content.toLowerCase();
    return buyingIntents.some(intent => lowerCaseContent.includes(intent));
  }
}
