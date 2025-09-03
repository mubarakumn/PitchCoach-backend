// src/workers/tasksWorker.js
import { Worker } from "bullmq";
import mongoose from "mongoose";
import dotenv from "dotenv";
import { connection, taskQueue } from "../queues/taskQueue.js";
import Transcription from "../models/transcriptionModel.js";
import { transcriptionService } from "../services/transcription/transcriptionService.js";
import { analyzeTranscription } from "../services/coachServices/coachServices.js";

dotenv.config();
await mongoose.connect(process.env.MONGO_URI);
console.log("✅ MongoDB connected (TasksWorker)");

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export const worker = new Worker(
  "tasks-queue",
  async (job) => {
    switch (job.name) {
      /**
       * =====================
       * 1. TRANSCRIPTION JOB
       * =====================
       */
      case "transcription": {
        const { fileId, transcriptionId, userId, fileUrl } = job.data;
        console.log(`🎙️ Starting transcription for file ${fileId}`);
        
        await job.updateProgress(5); // just started

        let t = await Transcription.findById(transcriptionId);
        if (!t) throw new Error(`Transcription ${transcriptionId} not found`);

        t.status = "processing";
        await t.save();

        try {

          await job.updateProgress(25); // file prepared

          // High-level transcribe call (handles polling internally)
          const result = await transcriptionService.transcribe(fileUrl);

          await job.updateProgress(70); // transcription underway

          if (result.status === "completed") {
            t.status = "completed";
            t.text = result.text;
            t.metadata = result.metadata;
            t.completedAt = new Date();
            await t.save();

            await job.updateProgress(100);

           // enqueue feedback job
          const feedbackJob = await taskQueue.add("feedback", {
            transcriptionId: t._id,
            text: t.text,
            userId,
            fileId,
          });

          console.log(`✅ Transcription ${t._id} completed. Feedback job ${feedbackJob.id} queued`);

          return { feedbackJobId: feedbackJob.id, transcriptionId: t._id, fileId };

          } else {
            t.status = "failed";
            t.errorMessage = result.error || "Unknown transcription failure";
            await t.save();
            throw new Error(result.error || "Transcription failed");
          }
        } catch (err) {
          t.status = "failed";
          t.errorMessage = err.message;
          await t.save();
          throw err;
        }
        break;
      }

      /**
       * =====================
       * 2. FEEDBACK JOB
       * =====================
       */
      case "feedback": {
        const { transcriptionId } = job.data;
        console.log(`🧑‍🏫 Starting feedback for transcription ${transcriptionId}`);

        await job.updateProgress(5); // just started

        const t = await Transcription.findById(transcriptionId);
        if (!t) throw new Error(`Transcription ${transcriptionId} not found`);

        try {

          await job.updateProgress(25); // job started

          t.feedbackStatus = "processing";
          await t.save();

          const result = await analyzeTranscription(transcriptionId);
         
          await job.updateProgress(70); // transcription analyzed

          if (result.success) {
            t.feedbackStatus = "completed";
            t.feedback = result.feedback;
            t.feedbackAdvice = result.advice;
            await t.save();

            await job.updateProgress(100); // job done
            
            console.log(`✅ Feedback completed for ${transcriptionId}`);
          
          } else {
            t.feedbackStatus = "failed";
            t.errorMessage = result.error;
            await t.save();
            throw new Error(result.error || "Feedback failed");
          }
        } catch (err) {
          t.feedbackStatus = "failed";
          t.errorMessage = err.message;
          await t.save();
          throw err;
        }
        break;
      }

      default:
        console.log(`⚠️ Unrecognized job name: ${job.name}`);
    }
  },
  {
    connection,
    concurrency: 4, // handles multiple jobs in parallel
  }
);

worker.on("completed", (job) => {
  console.log(`🎉 Job ${job.name} (${job.id}) completed`);
});

worker.on("failed", (job, err) => {
  console.error(`❌ Job ${job?.name} (${job?.id}) failed:`, err);
});

console.log("🚀 TasksWorker ready");
