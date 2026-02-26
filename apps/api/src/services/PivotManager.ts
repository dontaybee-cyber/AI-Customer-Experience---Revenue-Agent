import type { AuditLogger } from "../infra/audit.js";
import { createAuditLogger } from "../infra/audit.js";
import { hashIdentifier } from "../infra/pii.js";
import { TriggerEngine } from "./TriggerEngine.js";
import type { Message } from "../types.js";
import { TelegramConnector } from "@acx/connectors";
import { type AuditEvent } from "../infra/audit.js";

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
}

// App-level salt — same as orchestrator; keep consistent across modules.
const PIVOT_HASH_SALT = process.env.AUDIT_HASH_SALT ?? "acx-audit-v1";

function createDefaultDeps(): PivotManagerDeps {
  return {
    triggerEngine: new TriggerEngine(),
    telegram: TelegramConnector.fromEnv(),
    audit: createAuditLogger(),
  };
}

export class PivotManager {
  private state: AgentState;

  constructor(private deps: PivotManagerDeps = createDefaultDeps()) {
    this.state = AgentState.SUPPORT_TRIAGE;
  }

  public getState(): AgentState {
    return this.state;
  }

  public async handleMessage(message: Message, resolutionScore: number, sentimentEma: number) {
    const buyingSignalDetected = await this.deps.triggerEngine.detectBuyingSignals(message);

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
    buyingSignalDetected: boolean,
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
      this.deps.audit.write({
        at: new Date().toISOString(),
        actor: "agent",
        action: "state_transition",
        resourceType: "conversation",
        resourceId: message.conversationId,
        details: {
          fromState: this.state,
          toState: newState,
        },
      });
      this.state = newState;

      if (newState === AgentState.SALES_QUALIFY) {
        this.logPivotEvent(message);
        void this.notifyAdmin(message);
        this.pivotPromptAdapter(message);
      }
    }
  }

  private logPivotEvent(message: Message) {
    const event: AuditEvent = {
      at: new Date().toISOString(),
      actor: "agent",
      action: "pivot_to_sales",
      resourceType: "conversation",
      resourceId: message.conversationId,
      details: {
        customerId: message.identity,
        messageId: message.id,
      },
    };
    this.deps.audit.write(event);
  }

  private async notifyAdmin(message: Message): Promise<void> {
    const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
    if (!adminChatId) {
      void this.deps.audit.write({
        at: new Date().toISOString(),
        actor: "system",
        action: "skip_admin_notification",
        resourceType: "conversation",
        resourceId: message.conversationId,
        details: {
          reason: "TELEGRAM_ADMIN_CHAT_ID not set",
        },
      });
      return;
    }
    const identityHash = await hashIdentifier(message.identity, PIVOT_HASH_SALT);
    await this.deps.telegram.sendMessage({
      chatId: adminChatId,
      text: `Pivot to sales for identity hash: ${identityHash}`,
    });
  }

  private pivotPromptAdapter(message: Message): { newSystemPrompt: string } {
    const newSystemPrompt = `Glad we got that fixed! Since you mentioned team scaling, would you like to see how our enterprise plan handles that?`;
    this.deps.audit.write({
      at: new Date().toISOString(),
      actor: "agent",
      action: "generate_pivot_prompt",
      resourceType: "conversation",
      resourceId: message.conversationId,
    });
    return { newSystemPrompt };
  }
}
