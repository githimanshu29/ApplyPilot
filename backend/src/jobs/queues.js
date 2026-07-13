import { Queue } from "bullmq";
import redis from "../lib/redis.js";

// single queue for all pipeline runs
export const analysisQueue = new Queue("analysis", {
  connection: redis,
  defaultJobOptions: {
    attempts: 2, // retry once if it fails
    backoff: {
      type: "exponential",
      delay: 3000,
    },
    removeOnComplete: 50, // keep last 50 completed jobs
    removeOnFail: 20,
  },
});
