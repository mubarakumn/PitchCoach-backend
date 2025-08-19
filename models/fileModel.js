// models/File.js
import mongoose from "mongoose";

const fileSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    fileType: { type: String, enum: ["audio", "video", "slides"], required: true },
    fileUrl: { type: String, required: true },
    publicId: { type: String, required: true },       // Cloudinary public_id
    resourceType: { type: String, default: "auto" },  // 'video' | 'image' | 'raw' | 'auto'
    format: { type: String },                          // mp4, mp3, pdf ...
    bytes: { type: Number },
    duration: { type: Number },                        // seconds (if A/V)
    originalFilename: { type: String },
    status: { type: String, enum: ["uploaded", "processing", "completed", "failed"], default: "uploaded", index: true },
  },
  { timestamps: true }
);

export default mongoose.model("File", fileSchema);
