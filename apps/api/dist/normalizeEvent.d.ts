import type { InternalEvent, Provider } from "./types.js";
/**
 * Normalize inbound provider payloads into a unified InternalEvent schema.
 * This is the only place that should know provider-specific shapes.
 */
export declare function normalizeEvent(input: {
    provider: Provider;
    payload: unknown;
    headers?: Record<string, string | string[] | undefined>;
}): InternalEvent;
//# sourceMappingURL=normalizeEvent.d.ts.map