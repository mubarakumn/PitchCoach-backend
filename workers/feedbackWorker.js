import { Worker } from "bullmq";
import IORedis from "ioredis";
import mongoose from "mongoose";
import dotenv from "dotenv";
import { analyzeTranscription } from "../services/coachService.js";

dotenv.config();

// Redis
const connection = new IORedis({
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT,
  password: process.env.REDIS_PASSWORD,
});

// MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected for feedback worker"))
  .catch(err => console.error("Worker DB error:", err));

const worker = new Worker(
  "feedback-queue",
  async (job) => {
    const { transcriptionId } = job.data;
    console.log(`Processing feedback job for transcription ${transcriptionId}`);
    return await analyzeTranscription(transcriptionId);
  },
  { connection }
);

worker.on("completed", (job) => {
  console.log(`✅ Feedback job ${job.id} completed`);
});
worker.on("failed", (job, err) => {
  console.error(`❌ Feedback job ${job?.id} failed`, err);
});
