import mongoose from "mongoose";

const FeedbackSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  context: { type: String, required: true }, // e.g. "file:123", "feature:upload"
  rating: { type: Number, min: 1, max: 5 },
  message: { type: String },
  createdAt: { type: Date, default: Date.now }
});

// Optional: prevent duplicate feedback per context
FeedbackSchema.index({ userId: 1, context: 1 }, { unique: true });

export default mongoose.model("Feedback", FeedbackSchema);