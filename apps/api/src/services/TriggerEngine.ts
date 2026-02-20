
import { Message } from '../types';

export class TriggerEngine {
  private buyingSignalKeywords: RegExp[];

  constructor() {
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

  detectBuyingSignals(message: Message): boolean {
    if (message.content) {
      for (const keyword of this.buyingSignalKeywords) {
        if (keyword.test(message.content)) {
          return true;
        }
      }
    }
    return false;
  }
}
