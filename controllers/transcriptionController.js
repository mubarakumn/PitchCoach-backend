// controllers/transcriptionController.js
import Transcription from "../models/transcriptionModel.js";
import File from "../models/fileModel.js";

/**
 * Get transcription for a file
 */
export const getFileTranscription = async (req, res) => {
  try {
    const file = await File.findOne({ _id: req.params.id, user: req.user.id }).lean();
    if (!file) {
      return res.status(404).json({ error: "File not found" });
    }

    const transcription = await Transcription.findOne({ fileId: file._id, userId: req.user.id }).lean();
    if (!transcription) {
      return res.status(404).json({ error: "Transcription not found" });
    }

    res.json(transcription);
  } catch (err) {
    console.error("getFileTranscription error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

/**
 * Get AI feedback for a file (after transcription completes)
 */
export const getFileFeedback = async (req, res) => {
  try {
    const file = await File.findOne({ _id: req.params.id, user: req.user.id }).lean();
    if (!file) {
      return res.status(404).json({ error: "File not found" });
    }

    const transcription = await Transcription.findOne({ fileId: file._id, userId: req.user.id }).lean();
    if (!transcription) {
      return res.status(404).json({ error: "Transcription not found" });
    }

    if (transcription.status !== "completed") {
      return res.status(400).json({ error: "Transcription not ready yet" });
    }

    if (!transcription.feedback) {
      return res.status(404).json({ error: "Feedback not generated yet" });
    }

    res.json({
      transcriptionId: transcription._id,
      feedback: transcription.feedback,
    });
  } catch (err) {
    console.error("getFileFeedback error:", err);
    res.status(500).json({ error: "Server error" });
  }
};
