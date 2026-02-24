import type { InternalEvent, MessageRecord } from "@acx/shared";
import { Queue } from "bullmq";

// Shared connection config — imported by worker.ts to avoid `as any` access on queue internals.
export const QUEUE_CONNECTION = {
  url: process.env.REDIS_URL ?? "redis://localhost:6379",
} as const;

export const triggerQueue = new Queue("acx-triggers", {
  connection: QUEUE_CONNECTION,
});

export type TriggerJobName = "evaluate_triggers";

export interface EvaluateTriggersJob {
  name: TriggerJobName;
  data: {
    customerId: string;
    event: InternalEvent;
    recentMessages: MessageRecord[];
  };
}
