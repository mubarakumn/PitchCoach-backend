import { Worker } from "bullmq";
import IORedis from "ioredis";
import mongoose from "mongoose";
import dotenv from "dotenv";

import { transcriptionService } from "../services/transcription/transcriptionService.js";
import Transcription from "../models/transcriptionModel.js";
import { feedbackQueue } from "../queues/transcriptionQueue.js"; 


dotenv.config();

// Redis connection
const connection = new IORedis({
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT,
  password: process.env.REDIS_PASSWORD,
});

// MongoDB connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected for worker"))
  .catch(err => console.error("Worker DB error:", err));

const worker = new Worker(
  "transcription-queue",
  async (job) => {
    const { fileId, transcriptionId, userId, fileUrl } = job.data;
  
    console.log(`Processing transcription job for file ${fileId}`);

let transcription = await Transcription.findById(transcriptionId);
if (!transcription) throw new Error(`Transcription ${transcriptionId} not found`);

    transcription.status = "processing";
    await transcription.save();
  try {
    const providerResponse = await transcriptionService.start({ fileUrl, fileId, userId });

    if (providerResponse.id) {
      transcription.status = "processing";
      transcription.provider = "assemblyai";
      transcription.metadata = { providerId: providerResponse.id };
      await transcription.save();
    } else if (providerResponse.text) {
      transcription.status = "completed";
      transcription.text = providerResponse.text;
      transcription.completedAt = new Date();
      await transcription.save();
    }
    // automatically queue feedback job
    if (transcription.text) {
      await feedbackQueue.add("feedback", { transcriptionId: transcription._id });
    }
  } catch (err) {
    transcription.status = "failed";
    transcription.errorMessage = err.message;
    await transcription.save();
    throw err;
  }
    console.log(`Transcription job completed for file ${fileId}`);
    return transcription;
  },
  { connection }
);

worker.on("completed", (job) => {
  console.log(`✅ Job ${job.id} completed`);
});

worker.on("failed", (job, err) => {
  console.error(`❌ Job ${job?.id} failed`, err);
});
