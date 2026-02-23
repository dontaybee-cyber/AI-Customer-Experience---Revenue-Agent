
import { TriggerEngine } from "./TriggerEngine.js";
import type { Message } from "../types.js";
import { TelegramConnector } from "@acx/connectors";
import { ConsoleAuditLogger, type AuditEvent } from "../audit.js";

export enum AgentState {
  SUPPORT_TRIAGE = 'SUPPORT_TRIAGE',
  SUPPORT_ACTIVE = 'SUPPORT_ACTIVE',
  RESOLVED = 'RESOLVED',
  SALES_QUALIFY = 'SALES_QUALIFY',
  SALES_HANDOFF = 'SALES_HANDOFF',
}

export class PivotManager {
  private triggerEngine: TriggerEngine;
  private state: AgentState;
  private telegramConnector: TelegramConnector;
  private auditLogger: ConsoleAuditLogger;

  constructor() {
    this.triggerEngine = new TriggerEngine();
    this.state = AgentState.SUPPORT_TRIAGE;
    this.telegramConnector = TelegramConnector.fromEnv();
    this.auditLogger = new ConsoleAuditLogger();
  }

  public getState(): AgentState {
    return this.state;
  }

  public async handleMessage(
    message: Message,
    resolutionScore: number,
    sentimentEma: number
  ) {
    const buyingSignalDetected = await this.triggerEngine.detectBuyingSignals(
      message
    );

    if (this.state === AgentState.SUPPORT_ACTIVE && resolutionScore > 0.9) {
      this.transitionTo(AgentState.RESOLVED, message);
    }

    if (this.conditionEngine(resolutionScore, sentimentEma, buyingSignalDetected)) {
      this.transitionTo(AgentState.SALES_QUALIFY, message);
    }
  }

  private conditionEngine(
    resolutionScore: number,
    sentimentEma: number,
    buyingSignalDetected: boolean
  ): boolean {
    const isResolved = resolutionScore > 0.9;
    const isPositiveSentiment = sentimentEma > 0;

    // Guardrails
    if (!isResolved || !isPositiveSentiment) {
      return false;
    }

    return buyingSignalDetected;
  }

  private transitionTo(newState: AgentState, message: Message) {
    if (this.state !== newState) {
      console.log(`Transitioning from ${this.state} to ${newState}`);
      this.state = newState;

      if (newState === AgentState.SALES_QUALIFY) {
        this.logPivotEvent(message);
        this.notifyAdmin(message);
        this.pivotPromptAdapter(message);
      }
    }
  }

  private logPivotEvent(message: Message) {
    const event: AuditEvent = {
      at: new Date().toISOString(),
      actor: 'agent',
      action: 'pivot_to_sales',
      resourceType: 'conversation',
      resourceId: message.conversationId,
      details: {
        customerId: message.identity,
        messageId: message.id,
      },
    };
    this.auditLogger.write(event);
  }

  private notifyAdmin(message: Message) {
    const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
    if (adminChatId) {
      this.telegramConnector.sendMessage({
        chatId: adminChatId,
        text: `Pivot to sales occurred for identity: ${message.identity}`,
      });
    } else {
      console.log('TELEGRAM_ADMIN_CHAT_ID not set. Skipping notification.');
    }
  }

  private pivotPromptAdapter(message: Message): { newSystemPrompt: string } {
    const newSystemPrompt = `Glad we got that fixed! Since you mentioned team scaling, would you like to see how our enterprise plan handles that?`;
    // In a real implementation, this would update the LLM's system prompt.
    console.log(`New system prompt: "${newSystemPrompt}"`);
    return { newSystemPrompt };
  }
}
