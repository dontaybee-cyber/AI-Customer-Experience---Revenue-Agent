import type { AuditLogger } from "../../infra/audit.js";
import { createAuditLogger } from "../../infra/audit.js";
import type { AuditEvent } from "../../infra/audit.js";
import { hashIdentifier } from "../../infra/pii.js";
import { TriggerEngine } from "../../infra/TriggerEngine.js";
import type { TelegramConnector } from "@acx/connectors";
import { TelegramConnector as TelegramConnectorImpl } from "@acx/connectors";

// App-level salt for audit-log identifier hashing.
// Non-secret; prevents cross-app rainbow tables.
const PIVOT_HASH_SALT = process.env.AUDIT_HASH_SALT ?? "acx-audit-v1";

interface Message {
  id: string;
  channel: string;
  identity: string;
  content: string;
  timestamp: number;
  conversationId: string;
}

export enum AgentState {
  SUPPORT_TRIAGE = "SUPPORT_TRIAGE",
  SUPPORT_ACTIVE = "SUPPORT_ACTIVE",
  RESOLVED = "RESOLVED",
  SALES_QUALIFY = "SALES_QUALIFY",
  SALES_HANDOFF = "SALES_HANDOFF",
}

export interface PivotManagerDeps {
  triggerEngine: TriggerEngine;
  telegram: TelegramConnector;
  audit: AuditLogger;
  log: (msg: string) => void;
}

function createDefaultDeps(): PivotManagerDeps {
  return {
    triggerEngine: new TriggerEngine(),
    telegram: TelegramConnectorImpl.fromEnv(),
    audit: createAuditLogger(),
    log: (msg) => console.log(msg),
  };
}

export class PivotManager {
  private state: AgentState = AgentState.SUPPORT_TRIAGE;

  constructor(private deps: PivotManagerDeps = createDefaultDeps()) {}

  public getState(): AgentState {
    return this.state;
  }

  public async handleMessage(message: Message, resolutionScore: number, sentimentEma: number): Promise<void> {
    const buyingSignalDetected = await this.deps.triggerEngine.detectBuyingSignals(message);

    if (this.state === AgentState.SUPPORT_ACTIVE && resolutionScore > 0.9) {
      this.transitionTo(AgentState.RESOLVED, message);
    }

    if (this.conditionEngine(resolutionScore, sentimentEma, buyingSignalDetected)) {
      this.transitionTo(AgentState.SALES_QUALIFY, message);
    }
  }

  private conditionEngine(resolutionScore: number, sentimentEma: number, buyingSignalDetected: boolean): boolean {
    const isResolved = resolutionScore > 0.9;
    const isPositiveSentiment = sentimentEma > 0;
    if (!isResolved || !isPositiveSentiment) {
      return false;
    }
    return buyingSignalDetected;
  }

  private transitionTo(newState: AgentState, message: Message): void {
    if (this.state === newState) {
      return;
    }

    this.deps.log(`Transitioning from ${this.state} to ${newState}`);
    this.state = newState;

    if (newState === AgentState.SALES_QUALIFY) {
      this.logPivotEvent(message);
      void this.notifyAdmin(message); // fire-and-forget
      this.pivotPromptAdapter(message);
    }
  }

  private async notifyAdmin(message: Message): Promise<void> {
    const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
    if (!adminChatId) {
      this.deps.log("TELEGRAM_ADMIN_CHAT_ID not set. Skipping admin notification.");
      return;
    }

    const identityHash = await hashIdentifier(message.identity, PIVOT_HASH_SALT);
    await this.deps.telegram.sendMessage({
      chatId: adminChatId,
      text: `Pivot to sales for identity hash: ${identityHash}`,
    });
  }

  private logPivotEvent(message: Message): void {
    const event: AuditEvent = {
      at: new Date().toISOString(),
      actor: "agent",
      action: "pivot_to_sales",
      resourceType: "conversation",
      resourceId: message.conversationId,
      details: { customerId: message.identity, messageId: message.id },
    };
    this.deps.audit.write(event); // fire-and-forget
  }

  private pivotPromptAdapter(message: Message): { newSystemPrompt: string } {
    const newSystemPrompt = `Glad we got that fixed! Since you mentioned team scaling, would you like to see how our enterprise plan handles that?`;
    this.deps.log(`New system prompt generated for conversation: ${message.conversationId}`);
    return { newSystemPrompt };
  }
}
