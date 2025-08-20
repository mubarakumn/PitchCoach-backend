import mongoose from "mongoose";

const transcriptionSchema = new mongoose.Schema(
  {
    fileId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "File",
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    provider: {
      type: String,
      enum: ["openai", "assemblyai", "azure", "google"],
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "processing", "completed", "failed"],
      default: "pending",
    },
    text: {
      type: String,
    },
    language: {
      type: String,
      default: "en",
    },
    confidence: {
      type: Number,
    },
    errorMessage: {
      type: String,
    },
    metadata: {
      type: Object, // store provider-specific metadata (timestamps, etc.)
    },
    feedback: {
    type: Object,
    default: null, // will store structured feedback JSON
    },
    feedbackAdvice: {
      type: String,
      default: null,
    },
    feedbackStatus: {
    type: String,
    enum: ["pending", "completed", "failed"],
    default: "pending",
    },
    completedAt: { type: Date },
    duration: {
      type: Number, // in seconds
    },

  },
  { timestamps: true }
);

transcriptionSchema.index({ userId: 1, fileId: 1 });


export default mongoose.model("Transcription", transcriptionSchema);
