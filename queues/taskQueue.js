import { Queue, QueueEvents } from "bullmq";
import IORedis from "ioredis";
import dotenv from "dotenv";

dotenv.config();

export const connection = new IORedis({
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT,
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: null, // BullMQ requirement
});

export const taskQueue = new Queue("tasks-queue", { connection });
export const taskQueueEvents = new QueueEvents("tasks-queue", { connection });

taskQueueEvents.on("progress", ({ jobId, data }) => {
  console.log(`📊 Job ${jobId} progress:`, data);
});

taskQueueEvents.on("completed", ({ jobId, returnvalue }) => {
  console.log(`✅ Job ${jobId} completed`, returnvalue);
});

taskQueueEvents.on("failed", ({ jobId, failedReason }) => {
  console.log(`❌ Job ${jobId} failed:`, failedReason);
});