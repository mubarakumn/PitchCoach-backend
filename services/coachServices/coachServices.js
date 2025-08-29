import dotenv from "dotenv";
import Transcription from "../../models/transcriptionModel.js";

// Load API keys from env
dotenv.config();

// Import clients
import OpenAI from "openai";          // OpenAI (gpt-3.5 fallback)
import Anthropic from "@anthropic-ai/sdk"; // Claude Sonnet 4
import { GoogleGenerativeAI } from "@google/generative-ai"; // Gemini

// Clients setup
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const anthropic = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });
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

  // Avg sentence length
  const sentences = text.split(/[.!?]/).filter(s => s.trim().length > 0);
  const avgSentenceLength = sentences.length ? Math.round(totalWords / sentences.length) : 0;

  return {
    totalWords,
    fillerWordsCount: fillerCount,
    paceWordsPerMinute: paceWPM,
    longPauses: 0, // requires timestamps for accuracy
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

// ---- Try different providers ----
async function tryClaude(userPrompt, systemPrompt) {
  const msg = await anthropic.messages.create({
    model: "claude-3-5-sonnet-20240620",
    max_tokens: 1000,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });
  return msg.content[0].text;
}

async function tryGemini(userPrompt, systemPrompt) {
  const model = genAI.getGenerativeModel({ model: "gemini-pro" });
  const result = await model.generateContent([systemPrompt, userPrompt]);
  return result.response.text();
}

async function tryOpenAI(userPrompt, systemPrompt) {
  const resp = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ],
    temperature: 0.3,
    max_tokens: 1000,
  });
  return resp.choices[0].message.content;
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

  let rawText = null;
  let usedModel = null;

  try {
    rawText = await tryGemini(userPrompt, systemPrompt);
    usedModel = "Gemini Pro";
  } catch (err1) {
    try {
      rawText = await tryClaude(userPrompt, systemPrompt);
      usedModel = "Claude Sonnet 4";
    } catch (err2) {
      rawText = await tryOpenAI(userPrompt, systemPrompt);
      usedModel = "gpt-3.5-turbo";
    }
  }

  if (!rawText) {
    transcription.feedbackStatus = "failed";
    await transcription.save();
    return { success: false, status: "failed", error: "Empty AI response" };
  }

  // Parse JSON part
  const jsonMatch = rawText.match(/^\s*({[\s\S]*?})\s*(?:\n|$)/);
  let parsedJson = null;
  if (jsonMatch) {
    try {
      parsedJson = JSON.parse(jsonMatch[1]);
    } catch {
      parsedJson = null;
    }
  }

  const advice = rawText.replace(/^[\s\S]*?}\s*/, "").trim();

  transcription.feedback = parsedJson || {};
  transcription.feedbackAdvice = advice;
  transcription.feedbackStatus = "completed";
  transcription.completedAt = new Date();
  transcription.metadata = {
    ...(transcription.metadata || {}),
    coachModel: usedModel,
    coachRaw: rawText,
  };
  await transcription.save();

  return { success: true, status: "completed", feedback: parsedJson, advice, rawText };
}
