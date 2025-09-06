import express from "express";
import Feedback from "../models/feedbackModel.js";
import { protect } from "../middlewares/auth.js"; 

const router = express.Router();

// POST /api/feedback
router.post("/", protect, async (req, res) => {
  try {
    const { context, rating, message } = req.body;
    const userId = req.user.id; // from JWT

    if (!context || !rating) {
      return res.status(400).json({ error: "context and rating are required" });
    }

    const feedback = await Feedback.findOneAndUpdate(
      { userId, context },
      { rating, message, createdAt: new Date() },
      { upsert: true, new: true } // insert or update
    );

    res.json({ success: true, feedback });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/feedback
router.get("/", async (req, res) => {
  try {
    const userId = req.user.id; 
    const feedbacks = await Feedback.find();
    res.json({ feedbacks });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
