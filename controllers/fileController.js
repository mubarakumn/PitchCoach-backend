
import express from "express";
import crypto from "crypto";
import cloudinary from "../config/cloudinary.js";
import File from "../models/fileModel.js";
import Transcription from "../models/transcriptionModel.js";
import { taskQueue } from "../queues/taskQueue.js";

import { z } from "zod";

/** 2) Create file record (client sends Cloudinary response here) */
const createFileBody = z.object({
  fileType: z.enum(["audio", "video", "slides"]),
  public_id: z.string(),
  secure_url: z.string().url(),
  resource_type: z.string().optional(),      // 'video' for audio/video, 'image' or 'raw' for pdf
  format: z.string().optional(),
  bytes: z.number().optional(),
  duration: z.number().optional(),
  original_filename: z.string().optional(),
});


export const uploadToken = async (req, res) => {
  try {
    const timestamp = Math.round(Date.now() / 1000);
    const folder = "uploads";
    const public_id = `${req.user.id}_${timestamp}`; // tie id to user

    // IMPORTANT: sign exactly the params you’ll send (alphabetical by key)
    const stringToSign = `folder=${folder}&public_id=${public_id}&timestamp=${timestamp}${process.env.CLOUDINARY_API_SECRET}`;
    const signature = crypto.createHash("sha1").update(stringToSign).digest("hex");

    res.json({
      success: true,
      signature,
      timestamp,
      folder,
      public_id,
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
      apiKey: process.env.CLOUDINARY_API_KEY,
    });
  } catch (err) {
    console.error("uploadToken error:", err);
    res.status(500).json({ error: "Failed to generate upload token" });
  }
}

export const createFiles = async (req, res) => {
  const parsed = createFileBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
  }

  const {
    fileType, public_id, secure_url, resource_type = "auto", format, bytes, duration, original_filename,
  } = parsed.data;

  try {
    // Optional: enforce allowed types server-side
    if (fileType === "slides" && !["pdf", "ppt", "pptx"].includes((format || "").toLowerCase())) {
      // allow anyway if you want – adjust to your needs
      return res.status(400).json({ error: "Invalid slides format" });
    }

    const file = await File.create({
      user: req.user.id,
      fileType,
      publicId: public_id,
      fileUrl: secure_url,
      resourceType: resource_type,
      format,
      bytes,
      duration,
      originalFilename: original_filename,
      status: "uploaded",
    });

    // Create transcription record (pending state)
    const transcription = await Transcription.create({
      fileId: file._id,
      userId: req.user.id,
      provider: "assemblyai", 
      status: "pending",
    });

    // Link back to file
    file.transcriptionId = transcription._id;
    await file.save();

    // 👉 add job to ONE queue
    await taskQueue.add("transcription", {
      fileId: file._id,
      transcriptionId: transcription._id,
      userId: req.user.id,
      fileUrl: secure_url,
    });

    res.status(201).json({
      message: "File uploaded. Transcription job queued.",
      file,
      transcription,
    });

  } catch (err) {
    console.error("create file error:", err);
    res.status(500).json({ error: "Failed to save file" });
  }
}

export const listFiles = async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page || "1", 10));
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit || "12", 10)));
  const skip = (page - 1) * limit;

  try {
    const [items, total] = await Promise.all([
      File.find({ user: req.user.id }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      File.countDocuments({ user: req.user.id }),
    ]);
    res.json({ items, page, limit, total, pages: Math.ceil(total / limit) });
  } catch (err) {
    console.error("list files error:", err);
    res.status(500).json({ error: "Failed to list files" });
  }
}

export const getOneFile = async (req, res) => {
  const f = await File.findOne({ _id: req.params.id, user: req.user.id }).lean();
  if (!f) return res.status(404).json({ error: "Not found" });
  res.json(f);
}

export const deleteFile = async (req, res) => {
  const f = await File.findOne({ _id: req.params.id, user: req.user.id });
  if (!f) return res.status(404).json({ error: "Not found" });

  try {
    // Prefer the actual resourceType saved
    await cloudinary.uploader.destroy(f.publicId, { resource_type: f.resourceType || "auto", invalidate: true });
  } catch (e) {
    // If resource_type mismatch, a second attempt with 'image' or 'video' may be needed.
    console.warn("Cloudinary destroy warning:", e?.message || e);
  }

  await f.deleteOne();
  res.json({ success: true });
}
