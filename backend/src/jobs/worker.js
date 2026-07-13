import "dotenv/config";
import { Worker } from "bullmq";
import redis from "../lib/redis.js";
import connectDB from "../lib/db.js";
import { getGraph } from "../agents/graph.js";
import { Application } from "../models/Application.js";
import { JDAnalysis } from "../models/JDAnalysis.js";
import { ResumeVersion } from "../models/ResumeVersion.js";
import { User } from "../models/User.js";

await connectDB();

/**
 * BullMQ Worker
 *
 * Runs the LangGraph pipeline as a background job.
 * Express route creates the job and returns immediately.
 * Worker picks it up, runs pipeline, emits Socket.io events.
 *
 * Socket.io instance is shared via global — worker and server
 * run in the same process when started with "npm run dev".
 * In production you'd use Redis pub/sub to bridge them.
 */
const worker = new Worker(
  "analysis",
  async (job) => {
    const { userId, applicationId, jdRaw, userProfile, socketId } = job.data;

    console.log(
      `[worker] processing job ${job.id} for application ${applicationId}`,
    );

    const io = global._io;

    function emit(event, data) {
      if (io && socketId) {
        io.to(socketId).emit(event, data);
      }
    }

    try {
      emit("pipeline:start", { applicationId });

      const graph = getGraph();

      // stream events as each node completes
      const result = await graph.invoke(
        {
          userId,
          applicationId,
          jdRaw,
          userProfile,
        },
        {
          callbacks: [
            {
              handleChainEnd: (output, runId, parentRunId, tags) => {
                // emit currentNode to frontend on each node completion
                if (output?.currentNode) {
                  emit("pipeline:node", {
                    node: output.currentNode,
                    applicationId,
                  });
                }
              },
            },
          ],
        },
      );

      emit("pipeline:complete", {
        applicationId,
        fitScore: result.fitScore,
        atsScore: result.resumeVersion?.atsScore,
        honestGapReport: result.honestGapReport,
      });

      console.log(`[worker] job ${job.id} completed`);
      return result;
    } catch (err) {
      console.error(`[worker] job ${job.id} failed:`, err.message);
      emit("pipeline:error", { applicationId, error: err.message });
      throw err;
    }
  },
  {
    connection: redis,
    concurrency: 3, // process up to 3 pipelines simultaneously
  },
);

worker.on("completed", (job) => {
  console.log(`[worker] ✓ job ${job.id} done`);
});

worker.on("failed", (job, err) => {
  console.error(`[worker] ✗ job ${job.id} failed:`, err.message);
});

console.log("[worker] ready and listening for jobs");
