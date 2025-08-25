import OpenAI from "openai";
import dotenv from "dotenv";
import Transcription from "../../models/transcriptionModel.js";

dotenv.config();

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM_PROMPT = `
You are an expert public-speaking coach and presentation analyst. 
STRICT RULE: Always begin your response with a valid JSON object that matches the schema below, with no surrounding text, no Markdown fences, no labels. After the JSON, output a single plain-text paragraph of advice.

Schema:
{
  "summary": "...",
  "metrics": { "fillerWordsCount": 0, "paceWordsPerMinute": null, "longPauses": 0, "totalWords": 0 },
  "scores": { "clarity": 0-100, "confidence": 0-100, "engagement": 0-100, "structure": 0-100, "language": 0-100 },
  "strengths": ["..."],
  "improvements": ["..."],
  "suggestions": ["..."],
  "highlightedExamples": [ { "type": "...", "text": "...", "context": "..." } ]
}
`;

function safeJsonParse(rawText) {
  const jsonMatch = rawText.match(/^\s*({[\s\S]*?})\s*(?:\n|$)/);
  if (!jsonMatch) return null;
  try {
    return JSON.parse(jsonMatch[1]);
  } catch {
    const start = rawText.indexOf("{");
    const last = rawText.lastIndexOf("}");
    if (start !== -1 && last !== -1 && last > start) {
      try {
        return JSON.parse(rawText.slice(start, last + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

export async function analyzeTranscription(transcriptionId, opts = {}) {
  const transcription = await Transcription.findById(transcriptionId);
  if (!transcription) throw new Error("Transcription not found");
  if (!transcription.text?.trim()) throw new Error("No transcription text to analyze");

  const duration = transcription.duration || opts.duration || null;
  const metaNote = duration ? `\n\nMetadata: durationSeconds=${duration}` : "";

  const userPrompt = `
Analyze the following transcript and produce structured feedback as JSON per the system instructions.
Transcript:
""" 
${transcription.text}
"""
${metaNote}
`;

  let response;
  try {
    response = await client.responses.create({
      model: process.env.COACH_MODEL || "gpt-4o",
      input: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.2,
      max_output_tokens: 1200,
    });
  } catch (err) {
    transcription.feedbackStatus = "failed";
    transcription.metadata = { ...(transcription.metadata || {}), coachError: err.message };
    await transcription.save();
    return { success: false, status: "failed", error: err.message };
  }

  const rawText = response.output_text || null;
  if (!rawText) {
    transcription.feedbackStatus = "failed";
    await transcription.save();
    return { success: false, status: "failed", error: "Empty AI response" };
  }

  const parsedJson = safeJsonParse(rawText);
  if (!parsedJson) {
    transcription.feedback = { raw: rawText };
    transcription.feedbackStatus = "failed";
    transcription.metadata = { ...(transcription.metadata || {}), coachRaw: rawText };
    await transcription.save();
    return { success: false, status: "failed", error: "JSON parse failed", rawText };
  }

  // Extract human advice (text after JSON)
  const advice = rawText.replace(/^[\s\S]*?}\s*/, "").trim();

  transcription.feedback = parsedJson;
  transcription.feedbackAdvice = advice;
  transcription.feedbackStatus = "completed";
  transcription.completedAt = new Date();
  transcription.metadata = {
    ...(transcription.metadata || {}),
    coachModel: process.env.COACH_MODEL || "gpt-4o",
    coachRaw: rawText,
  };
  await transcription.save();

  return { success: true, status: "completed", feedback: parsedJson, advice, rawText };
}
