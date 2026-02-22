import type { ContinuityStore } from "@acx/memory";
import type { InternalEvent, OrchestratorResult } from "@acx/shared";
import type { TriggerEngineDeps } from "@acx/trigger-engine";
import type { AuditLogger } from "./audit.js";
import type { LlmClient } from "./llm.js";
export interface OrchestratorDeps {
    continuityStore: ContinuityStore;
    triggerDeps: TriggerEngineDeps;
    llm: LlmClient;
    audit: AuditLogger;
}
export declare class Orchestrator {
    private deps;
    constructor(deps: OrchestratorDeps);
    /**
     * Core request-response lifecycle:
     * - Normalize event already done upstream
     * - Resolve identity + fetch cross-channel context (recent + semantic + tickets)
     * - Generate response (streaming supported by caller)
     * - Evaluate triggers asynchronously (observer pattern)
     * - Emit audit logs without raw PII
     */
    processEvent(event: InternalEvent): Promise<OrchestratorResult>;
    private formatContextForPrompt;
}
//# sourceMappingURL=orchestrator.d.ts.map