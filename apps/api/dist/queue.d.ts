import { Queue } from "bullmq";
export declare const triggerQueue: Queue<any, any, string, any, any, string>;
export type TriggerJobName = "evaluate_triggers";
export interface EvaluateTriggersJob {
    name: TriggerJobName;
    data: {
        customerId: string;
        event: any;
        recentMessages: any[];
    };
}
//# sourceMappingURL=queue.d.ts.map