// routes/progressRoutes.js
import express from "express";
import { taskQueueEvents } from "../queues/taskQueue.js";

const router = express.Router();

// SSE endpoint
router.get("/progress/:jobId", async (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const jobId = req.params.jobId;

  // 🔹 Progress updates
  const onProgress = ({ jobId: jid, data }) => {
    if (jid === jobId) {
      res.write(`event: progress\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    }
  };

  // 🔹 Job completed
  const onComplete = ({ jobId: jid, returnvalue }) => {
    if (jid === jobId) {
      res.write(`event: complete\n`);
      res.write(`data: ${JSON.stringify(returnvalue)}\n\n`);
      res.end();
    }
  };

  // 🔹 Job failed
  const onFailed = ({ jobId: jid, failedReason }) => {
    if (jid === jobId) {
      res.write(`event: failed\n`);
      res.write(`data: ${JSON.stringify({ error: failedReason })}\n\n`);
      res.end();
    }
  };

  taskQueueEvents.on("progress", onProgress);
  taskQueueEvents.on("completed", onComplete);
  taskQueueEvents.on("failed", onFailed);

  // Cleanup on disconnect
  req.on("close", () => {
    taskQueueEvents.off("progress", onProgress);
    taskQueueEvents.off("completed", onComplete);
    taskQueueEvents.off("failed", onFailed);
  });
});

export default router;
