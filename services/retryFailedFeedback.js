import mongoose from "mongoose";
import dotenv from "dotenv";
import Transcription from "../models/transcriptionModel.js";
import { analyzeTranscription } from "./coachServices/coachServices.js";

dotenv.config();

async function retryFailedFeedback() {
  await mongoose.connect(process.env.MONGO_URI);

  const failed = await Transcription.find({ feedbackStatus: "failed" });
  console.log(`Found ${failed.length} failed feedbacks`);

  // const t = {
  //   _id:"68b3faf447499479321c8424"
  // }
  for (const t of failed) {
    try {
      console.log(`Retrying feedback for transcription ${t._id}`);
      const result = await analyzeTranscription(t._id);
      console.log("✅ Success:", result.status, "for", t._id);
    } catch (err) {
      console.error("❌ Still failed for", t._id, err.message);
    }
  }

  await mongoose.disconnect();
}

retryFailedFeedback();
