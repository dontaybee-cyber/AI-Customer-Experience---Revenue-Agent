
import { TriggerEngine } from './TriggerEngine';
import { Message } from '../types';
import { TelegramConnector } from '../../../packages/connectors/src/telegram';

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

  constructor() {
    this.triggerEngine = new TriggerEngine();
    this.state = AgentState.SUPPORT_TRIAGE;
    this.telegramConnector = TelegramConnector.fromEnv();
  }

  public getState(): AgentState {
    return this.state;
  }

  public handleMessage(message: Message, sentiment: number, issueResolved: boolean) {
    const buyingSignalDetected = this.triggerEngine.detectBuyingSignals(message);

    if (this.state === AgentState.RESOLVED && sentiment >= 0 && buyingSignalDetected) {
      this.transitionTo(AgentState.SALES_QUALIFY, message);
    } else if (issueResolved) {
        this.transitionTo(AgentState.RESOLVED, message);
    }
  }

  private transitionTo(newState: AgentState, message: Message) {
    if (this.state !== newState) {
      console.log(`Transitioning from ${this.state} to ${newState}`);
      this.state = newState;

      if (newState === AgentState.SALES_QUALIFY) {
        this.notifyAdmin(message);
      }
    }
  }

  private notifyAdmin(message: Message) {
    const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
    if (adminChatId) {
      this.telegramConnector.sendMessage({
        chatId: adminChatId,
        text: `Pivot to sales occurred for identity: ${message.identity}`,
      });
    } else {
        console.log("TELEGRAM_ADMIN_CHAT_ID not set. Skipping notification.");
    }
  }
}
