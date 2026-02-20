import { Queue } from "bullmq";

export const triggerQueue = new Queue("acx-triggers", {
  connection: {
    url: process.env.REDIS_URL ?? "redis://localhost:6379"
  }
});

export type TriggerJobName = "evaluate_triggers";

export interface EvaluateTriggersJob {
  name: TriggerJobName;
  data: {
    customerId: string;
    event: any;
    recentMessages: any[];
  };
}
