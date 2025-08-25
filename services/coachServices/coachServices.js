import OpenAI from "openai";
import dotenv from "dotenv";
import Transcription from "../../models/transcriptionModel.js";

dotenv.config();

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function calculateLocalMetrics(text, durationSeconds) {
  const words = text.trim().split(/\s+/);
  const totalWords = words.length;

  // Filler words
  const fillerWords = ["um", "uh", "like", "you know", "so", "actually", "basically"];
  let fillerCount = 0;
  words.forEach(w => {
    if (fillerWords.includes(w.toLowerCase())) fillerCount++;
  });

  // Pace (words per minute)
  const paceWPM = durationSeconds ? Math.round((totalWords / durationSeconds) * 60) : null;

  return {
    fillerWordsCount: fillerCount,
    paceWordsPerMinute: paceWPM,
    totalWords,
    longPauses: 0, // could be updated if you capture timestamps
  };
}

export async function analyzeTranscription(transcriptionId, opts = {}) {
  const transcription = await Transcription.findById(transcriptionId);
  if (!transcription) throw new Error("Transcription not found");
  if (!transcription.text?.trim()) throw new Error("No transcription text to analyze");

  const duration = transcription.duration || opts.duration || null;
  const metrics = calculateLocalMetrics(transcription.text, duration);

  const SYSTEM_PROMPT = `
  You are an expert public speaking and pitch coach. 
  RULES:
  - Always start with a valid JSON object (schema given).
  - After the JSON, give a short motivational coaching paragraph.
  - Always highlight at least 2 strengths first.
  - Always provide 2-3 specific practice exercises for confidence building.
  
  Schema:
  {
    "summary": "...",
    "metrics": ${JSON.stringify(metrics)},
    "scores": { "clarity": 0-100, "confidence": 0-100, "engagement": 0-100, "structure": 0-100, "language": 0-100 },
    "strengths": ["..."],
    "improvements": ["..."],
    "suggestions": ["..."],
    "highlightedExamples": [ { "type": "...", "text": "...", "context": "..." } ]
  }
  `;

  const userPrompt = `
  Analyze this transcript for presentation skills and provide feedback.
  Transcript:
  """
  ${transcription.text}
  """
  `;

  let response;
  try {
    response = await client.responses.create({
      model: process.env.COACH_MODEL || "gpt-4o", // try gpt-4o first
      input: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.3,
      max_output_tokens: 1000,
    });
  } catch (err) {
    // fallback to gpt-3.5
    response = await client.responses.create({
      model: "gpt-3.5-turbo",
      input: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.3,
      max_output_tokens: 1000,
    });
  }

  const rawText = response.output_text || null;
  if (!rawText) {
    transcription.feedbackStatus = "failed";
    await transcription.save();
    return { success: false, status: "failed", error: "Empty AI response" };
  }

  // Extract JSON
  const jsonMatch = rawText.match(/^\s*({[\s\S]*?})\s*(?:\n|$)/);
  let parsedJson = null;
  if (jsonMatch) {
    try {
      parsedJson = JSON.parse(jsonMatch[1]);
    } catch (err) {
      parsedJson = null;
    }
  }

  // Extract advice (after JSON)
  const advice = rawText.replace(/^[\s\S]*?}\s*/, "").trim();

  transcription.feedback = parsedJson || {};
  transcription.feedbackAdvice = advice;
  transcription.feedbackStatus = "completed";
  transcription.completedAt = new Date();
  transcription.metadata = {
    ...(transcription.metadata || {}),
    coachModel: response.model,
    coachRaw: rawText,
  };
  await transcription.save();

  return { success: true, status: "completed", feedback: parsedJson, advice, rawText };
}
