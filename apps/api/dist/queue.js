import { Queue } from "bullmq";
export const triggerQueue = new Queue("acx-triggers", {
    connection: {
        url: process.env.REDIS_URL ?? "redis://localhost:6379"
    }
});
//# sourceMappingURL=queue.js.map