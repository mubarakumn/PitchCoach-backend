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

  const onProgress = ({ jobId: jid, data }) => {
    if (jid === jobId) {
      res.write(`event: progress\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    }
  };

  const onComplete = ({ jobId: jid }) => {
    if (jid === jobId) {
      res.write(`event: complete\n`);
      res.write(`data: "done"\n\n`);
      res.end();
    }
  };

  taskQueueEvents.on("progress", onProgress);
  taskQueueEvents.on("completed", onComplete);

  req.on("close", () => {
    taskQueueEvents.off("progress", onProgress);
    taskQueueEvents.off("completed", onComplete);
  });
});

export default router;
