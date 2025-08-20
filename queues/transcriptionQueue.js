import { Queue } from "bullmq";
import IORedis from "ioredis";
import dotenv from "dotenv";

dotenv.config();

const connection = new IORedis({
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT,
  password: process.env.REDIS_PASSWORD,
});

export const transcriptionQueue = new Queue("transcription-queue", { connection });
export const feedbackQueue = new Queue("feedback-queue", { connection });


export async function addTranscriptionJob(fileId, transcriptionId, userId, fileUrl) {
  await transcriptionQueue.add(
    "transcribe",
    { fileId, transcriptionId, userId, fileUrl },
    {
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 },
      removeOnComplete: true,
      removeOnFail: false,
    }
  );
}

