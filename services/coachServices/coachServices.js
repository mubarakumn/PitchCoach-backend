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

CRITICAL RULES:
1. Respond ONLY in the exact format shown below.
2. Do NOT add Markdown fences like \`\`\`json.
3. The <JSON> block MUST contain a valid JSON object following the schema.
4. The <ADVICE> block MUST contain ONLY motivational text paragraphs.
5. NEVER wrap <JSON> inside <ADVICE>.
6. NEVER repeat <ADVICE> more than once.
7. If you cannot follow the format, return an empty <JSON>{}</JSON> and <ADVICE>...</ADVICE> anyway.

Your output must look EXACTLY like this:

<JSON>
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
</JSON>

<ADVICE>
Write 1–2 short motivational paragraphs here.
</ADVICE>
  `;
}

async function tryGemini(userPrompt, systemPrompt) {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
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
  // console.log("Raw Gemini response:", rawText);

  // ---- Normalize Gemini response ----
  let cleanText = rawText
    .replace(/```json|```/gi, "") // remove markdown fences
    .replace(/^\s*<\/?ADVICE>/i, "") // strip stray opening/closing ADVICE at start
    .replace(/<ADVICE>([\s\S]*?)$/, "<ADVICE>$1</ADVICE>") // ensure closing tag
    .replace(/<ADVICE>([\s\S]*?)<ADVICE>/gi, "<ADVICE>$1</ADVICE>") // collapse multiple ADVICE
    .replace(/<ADVICE>\s*<JSON>/gi, "<JSON>") // move JSON out if wrapped in ADVICE
    .replace(/<\/JSON>\s*<\/ADVICE>/gi, "</JSON>\n\n<ADVICE>");

  // ---- Extract JSON ----
  let parsedJson = null;
  const jsonMatch = cleanText.match(/<JSON>\s*([\s\S]*?)\s*<\/JSON>/i);
  if (jsonMatch) {
    try {
      parsedJson = JSON.parse(jsonMatch[1]);
    } catch (err) {
      console.error("JSON parse failed:", err.message, jsonMatch[1].slice(0,200));
    }
  }

  // ---- Extract ADVICE ----
  let advice = "";
  const adviceMatch = cleanText.match(/<ADVICE>\s*([\s\S]*?)\s*<\/ADVICE>/i);
  if (adviceMatch) {
    advice = adviceMatch[1].trim();
  } else if (parsedJson?.encouragement) {
    advice = parsedJson.encouragement; // fallback
  }

  // console.log("Extracted JSON:", parsedJson);
  // console.log("Extracted Advice:", advice);

  // ---- Save to DB ----
  transcription.feedback = parsedJson || {};
  transcription.feedbackAdvice = advice;
  transcription.feedbackStatus = "completed";
  transcription.completedAt = new Date();
  transcription.metadata = {
    ...(transcription.metadata || {}),
    coachModel: "Gemini 1.5 Flash",
    coachRaw: rawText,
  };
  await transcription.save();

  return { success: true, status: "completed", feedback: parsedJson, advice, rawText };
}
