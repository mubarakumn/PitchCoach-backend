import dotenv from "dotenv";
import Transcription from "../../models/transcriptionModel.js";
import { GoogleGenerativeAI } from "@google/generative-ai"; // Gemini

dotenv.config();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ---- Local Metrics Calculation ----
function calculateLocalMetrics(text, durationSeconds) {
  const words = text.trim().split(/\s+/);
  const totalWords = words.length;

  const fillerWords = ["um", "uh", "like", "you know", "so", "actually", "basically"];
  let fillerCount = 0;
  words.forEach(w => {
    if (fillerWords.includes(w.toLowerCase())) fillerCount++;
  });

  const paceWPM = durationSeconds ? Math.round((totalWords / durationSeconds) * 60) : null;

  const sentences = text.split(/[.!?]/).filter(s => s.trim().length > 0);
  const avgSentenceLength = sentences.length ? Math.round(totalWords / sentences.length) : 0;

  return {
    totalWords,
    fillerWordsCount: fillerCount,
    paceWordsPerMinute: paceWPM,
    longPauses: 0,
    avgSentenceLength,
  };
}

// ---- Coaching Prompt ----
function buildSystemPrompt(metrics) {
  return `
You are an expert public-speaking and pitch coach. 

RULES:
- Always begin with a valid JSON object that follows the schema (below).
- After the JSON, write a short motivational coaching paragraph.
- Always highlight at least 2 strengths before weaknesses.
- Always include 2–3 practice exercises.
- Use encouragement to boost confidence.

Schema:
{
  "summary": "...",
  "metrics": ${JSON.stringify(metrics)},
  "scores": { "clarity": 0-100, "confidence": 0-100, "engagement": 0-100, "structure": 0-100, "persuasiveness": 0-100, "energy": 0-100 },
  "strengths": ["..."],
  "improvements": ["..."],
  "suggestions": ["..."],
  "practiceExercises": [ { "title": "...", "description": "...", "goal": "..." } ],
  "encouragement": "...",
  "progressTracking": { "focusAreas": ["..."], "nextGoals": [ { "metric": "...", "target": 0 } ] },
  "highlightedExamples": [ { "type": "...", "text": "...", "context": "..." } ]
}
  `;
}

async function tryGemini(userPrompt, systemPrompt) {
  const model = genAI.getGenerativeModel({ model: "gemini-pro" });
  const result = await model.generateContent([systemPrompt, userPrompt]);
  return result.response.text();
}

// ---- Main Analyzer ----
export async function analyzeTranscription(transcriptionId, opts = {}) {
  const transcription = await Transcription.findById(transcriptionId);
  if (!transcription) throw new Error("Transcription not found");
  if (!transcription.text?.trim()) throw new Error("No transcription text to analyze");

  const duration = transcription.duration || opts.duration || null;
  const metrics = calculateLocalMetrics(transcription.text, duration);

  const systemPrompt = buildSystemPrompt(metrics);
  const userPrompt = `
Analyze this transcript for presentation skills and provide coaching feedback.
Transcript:
"""
${transcription.text}
"""
`;

  let rawText;
  try {
    rawText = await tryGemini(userPrompt, systemPrompt);
  } catch (err) {
    console.error("Gemini error:", err.message);
    transcription.feedbackStatus = "failed";
    await transcription.save();
    return { success: false, status: "failed", error: err.message };
  }

  if (!rawText) {
    transcription.feedbackStatus = "failed";
    await transcription.save();
    return { success: false, status: "failed", error: "Empty Gemini response" };
  }

  const jsonMatch = rawText.match(/^\s*({[\s\S]*?})\s*(?:\n|$)/);
  let parsedJson = null;
  if (jsonMatch) {
    try {
      parsedJson = JSON.parse(jsonMatch[1]);
    } catch (err) {
      console.error("JSON parse failed:", err.message);
    }
  }

  const advice = rawText.replace(/^[\s\S]*?}\s*/, "").trim();

  transcription.feedback = parsedJson || {};
  transcription.feedbackAdvice = advice;
  transcription.feedbackStatus = "completed";
  transcription.completedAt = new Date();
  transcription.metadata = {
    ...(transcription.metadata || {}),
    coachModel: "Gemini Pro",
    coachRaw: rawText,
  };
  await transcription.save();

  return { success: true, status: "completed", feedback: parsedJson, advice, rawText };
}
