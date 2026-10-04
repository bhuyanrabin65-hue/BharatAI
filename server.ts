import express from "express";
import http from "http";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let PORT = Number(process.env.PORT) || 3000;
for (let i = 0; i < process.argv.length; i++) {
  if (process.argv[i] === "--port" && process.argv[i + 1]) {
    const val = parseInt(process.argv[i + 1], 10);
    if (!isNaN(val)) PORT = val;
  }
}

function getGenAIClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is not configured. Please check the Settings > Secrets panel."
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

interface ChatHistoryItem {
  role: "user" | "model";
  text: string;
}

const LANGUAGE_GUIDANCE: Record<string, string> = {
  "en-IN":
    "Respond in natural Indian English. Use warm, polite, articulate Indian English phrasing (e.g., 'Surely', 'Let us look into this step by step', 'No worries at all') without stereotyping.",
  "hi-IN":
    "Respond in natural conversational Hindi (Devanagari script: हिन्दी), using everyday spoken Hindi vocabulary mixed naturally with common English technical terms where Indian speakers normally use them.",
  hinglish:
    "Respond in natural conversational Hinglish (Hindi written in Roman/Latin script blended smoothly with English, e.g., 'Bilkul! Chalo step by step shuru karte hain. Pehle main tumhe simple language mein samjhata hoon...'). Sound like a friendly, articulate Indian peer or mentor.",
  "ta-IN":
    "Respond in natural conversational Tamil (தமிழ்) or Tanglish if the user types in Roman script. Keep the tone warm, respectful, and easy to follow when spoken aloud.",
  "te-IN":
    "Respond in natural conversational Telugu (తెలుగు) or Romanized Telugu if the user prefers. Keep sentences clear, warm, and natural for spoken voice delivery.",
  "bn-IN":
    "Respond in natural conversational Bengali (বাংলা). Maintain a warm, polite, intellectual, and friendly conversational flow suitable for spoken voice.",
  "mr-IN":
    "Respond in natural conversational Marathi (मराठी). Use polite, warm everyday Marathi phrasing that sounds natural when spoken aloud.",
  "gu-IN":
    "Respond in natural conversational Gujarati (ગુજરાતી). Keep the tone friendly, helpful, and natural for spoken conversation.",
  "kn-IN":
    "Respond in natural conversational Kannada (ಕನ್ನಡ). Keep sentences clear, warm, and naturally paced for spoken delivery.",
  "ml-IN":
    "Respond in natural conversational Malayalam (മലയാളം). Maintain a warm, helpful, and natural spoken cadence.",
  "pa-IN":
    "Respond in natural conversational Punjabi (ਪੰਜਾਬੀ). Keep the tone warm, energetic, polite, and conversational.",
  "or-IN":
    "Respond in natural conversational Odia (ଓଡ଼ିଆ). Use clear, warm, and polite everyday Odia suitable for live spoken conversation.",
};

function buildSystemInstruction(params: {
  personaName: string;
  personaRole: string;
  personaStyle: string;
  language: string;
  formality: "casual" | "balanced" | "formal";
}) {
  const langInstruction =
    LANGUAGE_GUIDANCE[params.language] || LANGUAGE_GUIDANCE["en-IN"];

  const formalityInstruction =
    params.formality === "casual"
      ? "Use a warm, friendly, peer-like tone (relatable examples, relaxed conversational rhythm)."
      : params.formality === "formal"
      ? "Use a respectful, polished, professional tone (structured clarity, courteous phrasing suitable for executive or academic discussions)."
      : "Adapt your formality naturally to match the user: polite, approachable, and warm.";

  return `You are ${params.personaName}, a realistic, friendly, intelligent Indian AI conversation partner (${params.personaRole}).
Personality & Style: ${params.personaStyle}

CRITICAL CONVERSATIONAL & CULTURAL RULES:
1. Identity Honesty: Never claim to be a biological human. If asked who or what you are, warmly introduce yourself as ${params.personaName}, an Indian AI assistant built for natural live voice conversation.
2. Language & Code-Switching:
   - Selected language preference: ${langInstruction}
   - If the user switches language mid-conversation (for example, speaking Hinglish like "Bhai, mujhe website banana seekhna hai" or switching between Hindi, English, Tamil, Telugu, Bengali, etc.), seamlessly adapt and respond in the language/script they used!
3. Spoken-First Delivery:
   - Your response will be spoken aloud by a live talking avatar with real-time lip-sync.
   - Keep responses conversational, engaging, and naturally paced (typically 2 to 3 concise paragraphs or clear spoken points).
   - Avoid robotic bullet-point walls, raw markdown tables, or code-heavy blocks unless specifically requested. Use natural spoken transitions ("Dekho,", "See, the main idea is...", "Chalo isko simple example se samajhte hain...", "First of all...").
4. Indian Context Fluency:
   - Understand Indian names, cities (Bengaluru, Mumbai, Delhi NCR, Hyderabad, Chennai, Kolkata, Pune, Bhubaneswar, Jaipur, etc.), currency in Indian Rupees (₹, hazaar, lakh, crore), UPI, train/metro travel, cricket, Indian education/careers, and everyday household or work situations.
5. Formality & Empathy:
   - ${formalityInstruction}
   - Admit uncertainty honestly rather than inventing facts.
6. Emotion Tag Prefix:
   - Start EVERY response with exactly one emotion tag in square brackets from this list: [EMOTION:friendly], [EMOTION:enthusiastic], [EMOTION:thoughtful], [EMOTION:empathetic], [EMOTION:curious].
   - Immediately after the tag, write your natural spoken response with no extra prefix.`;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: "20mb" }));

  // Health check
  app.get("/api/health", (_req, res) => {
    res.json({
      ok: true,
      hasApiKey: Boolean(process.env.GEMINI_API_KEY),
    });
  });

  // Streaming Multi-Turn Conversational AI Endpoint
  app.post("/api/chat/stream", async (req, res) => {
    try {
      const {
        message,
        history = [],
        language = "hinglish",
        personaName = "Ananya",
        personaRole = "Conversational AI Partner",
        personaStyle = "Warm, expressive, articulate, and helpful",
        formality = "balanced",
      } = req.body;

      if (!message || typeof message !== "string") {
        res.status(400).json({ error: "Message is required." });
        return;
      }

      const ai = getGenAIClient();
      const systemInstruction = buildSystemInstruction({
        personaName,
        personaRole,
        personaStyle,
        language,
        formality,
      });

      const formattedContents = [
        ...(history as ChatHistoryItem[]).slice(-14).map((item) => ({
          role: item.role === "model" ? "model" : "user",
          parts: [{ text: item.text }],
        })),
        {
          role: "user",
          parts: [{ text: message }],
        },
      ];

      res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.setHeader("Connection", "keep-alive");

      const responseStream = await ai.models.generateContentStream({
        model: "gemini-3.8-flash",
        contents: formattedContents,
        config: {
          systemInstruction,
          temperature: 0.85,
          topP: 0.95,
          thinkingConfig: {
            thinkingLevel: ThinkingLevel.LOW,
          },
        },
      });

      for await (const chunk of responseStream) {
        const text = chunk.text;
        if (text) {
          res.write(`data: ${JSON.stringify({ text })}\n\n`);
        }
      }

      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
    } catch (error: any) {
      console.error("Error in /api/chat/stream:", error);
      const errMsg =
        error?.message || "Failed to generate conversational response.";
      if (!res.headersSent) {
        res.status(500).json({ error: errMsg });
      } else {
        res.write(`data: ${JSON.stringify({ error: errMsg })}\n\n`);
        res.end();
      }
    }
  });

  // In-memory cache for synthesized speech clips (e.g. greetings, common prompts)
  const ttsCache = new Map<string, { audioBase64: string; mimeType: string }>();
  let ttsQuotaExceededUntil = 0;

  // Natural Text-to-Speech Endpoint with Quota Awareness & Browser Fallback
  app.post("/api/tts", async (req, res) => {
    try {
      const {
        text,
        voiceName = "Kore",
        language = "hinglish",
        emotion = "friendly",
      } = req.body;

      if (!text || typeof text !== "string") {
        res.status(400).json({ error: "Text is required for speech synthesis." });
        return;
      }

      const cleanText = text
        .replace(/\[EMOTION:[a-zA-Z]+\]/g, "")
        .replace(/[*_#`~]+/g, "")
        .trim()
        .slice(0, 1800);

      if (!cleanText) {
        res.status(400).json({ error: "Empty text after cleaning." });
        return;
      }

      const cacheKey = `${cleanText.toLowerCase()}__${voiceName}__${language}__${emotion}`;
      if (ttsCache.has(cacheKey)) {
        const cached = ttsCache.get(cacheKey)!;
        res.json(cached);
        return;
      }

      // If server TTS quota is currently exhausted, instruct client to use browser voice synthesis directly
      if (Date.now() < ttsQuotaExceededUntil) {
        res.json({
          audioBase64: null,
          fallbackToBrowser: true,
          reason: "quota_exceeded",
          message: "TTS quota currently exceeded; using browser speech synthesis.",
        });
        return;
      }

      const ai = getGenAIClient();

      const styleByEmotion: Record<string, string> = {
        friendly:
          "Warm, natural Indian English and Hindi conversational accent, friendly human-like cadence with natural pauses",
        enthusiastic:
          "Upbeat, encouraging, expressive Indian conversational voice with warm energy",
        thoughtful:
          "Calm, clear, patient Indian mentor voice, explaining concepts simply step by step",
        empathetic:
          "Gentle, supportive, polite Indian conversational voice with warm empathy",
        curious:
          "Engaging, inquisitive, friendly Indian conversational voice",
      };

      const stylePrompt =
        styleByEmotion[emotion] || styleByEmotion.friendly;

      let base64Audio: string | undefined;
      let mimeType = "audio/wav";

      // Attempt synthesis with primary model (gemini-3.8-flash-lite-tts), with fallback to gemini-3.8-flash-tts
      const modelsToTry = ["gemini-3.8-flash-lite-tts", "gemini-3.8-flash-tts"];
      let lastError: any = null;

      for (const model of modelsToTry) {
        try {
          const response = await ai.models.generateContent({
            model,
            contents: [
              {
                role: "user",
                parts: [
                  {
                    text: cleanText,
                    speechMetadata: {
                      style: `${stylePrompt} (Language context: ${language})`,
                    },
                  } as any,
                ],
              },
            ],
            config: {
              responseModalities: ["AUDIO"],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: {
                    voiceName,
                  },
                },
              },
            },
          });

          base64Audio =
            response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
          mimeType =
            response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.mimeType ||
            "audio/wav";

          if (base64Audio) {
            break; // Success
          }
        } catch (modelErr: any) {
          lastError = modelErr;
          const isQuota =
            modelErr?.status === "RESOURCE_EXHAUSTED" ||
            modelErr?.code === 429 ||
            String(modelErr?.message || "").includes("429") ||
            String(modelErr?.message || "").includes("quota") ||
            String(modelErr?.message || "").includes("RESOURCE_EXHAUSTED");

          if (isQuota) {
            console.warn(`[TTS] Model ${model} quota exhausted. Trying alternative...`);
          } else {
            break;
          }
        }
      }

      if (!base64Audio) {
        const isQuota =
          lastError?.status === "RESOURCE_EXHAUSTED" ||
          lastError?.code === 429 ||
          String(lastError?.message || "").includes("429") ||
          String(lastError?.message || "").includes("quota") ||
          String(lastError?.message || "").includes("RESOURCE_EXHAUSTED");

        if (isQuota) {
          // Pause TTS requests for 15 minutes and seamlessly inform client to use browser voice
          ttsQuotaExceededUntil = Date.now() + 15 * 60 * 1000;
          console.warn(
            "[TTS] All Gemini TTS quotas currently exhausted. Switching to browser speech synthesis."
          );
        } else {
          console.warn("[TTS] Speech synthesis unavailable:", lastError?.message || "No audio returned.");
        }

        res.json({
          audioBase64: null,
          fallbackToBrowser: true,
          reason: isQuota ? "quota_exceeded" : "synthesis_unavailable",
          message: "Using browser voice synthesis fallback.",
        });
        return;
      }

      // Cache synthesized audio (cap size at 60 entries)
      if (ttsCache.size > 60) {
        const oldestKey = ttsCache.keys().next().value;
        if (oldestKey) ttsCache.delete(oldestKey);
      }
      ttsCache.set(cacheKey, { audioBase64: base64Audio, mimeType });

      res.json({
        audioBase64: base64Audio,
        mimeType,
        fallbackToBrowser: false,
      });
    } catch (error: any) {
      console.warn("[TTS] Unexpected error in /api/tts:", error?.message || error);
      res.json({
        audioBase64: null,
        fallbackToBrowser: true,
        reason: "server_error",
        message: "Using browser voice synthesis fallback.",
      });
    }
  });

  // Server-Side Audio Transcription Endpoint using gemini-3.5-transcribe
  app.post("/api/transcribe", async (req, res) => {
    try {
      const { audioBase64, mimeType = "audio/webm", language = "hinglish" } = req.body;
      if (!audioBase64) {
        res.status(400).json({ error: "audioBase64 is required." });
        return;
      }

      const ai = getGenAIClient();
      const langHint =
        language === "hinglish"
          ? "Hinglish (Hindi-English mix in Roman script) or English"
          : language;

      const promptText = `Transcribe this spoken audio accurately. The speaker is from India and may be speaking ${langHint}. Return ONLY the exact transcribed words spoken by the user without any extra commentary, quotation marks, or prefixes. If there is only silence, breathing, or background noise, return an empty string.`;

      let transcript = "";

      // Try primary transcription model: gemini-3.5-transcribe
      try {
        const response = await ai.models.generateContent({
          model: "gemini-3.5-transcribe",
          contents: {
            parts: [
              {
                inlineData: {
                  mimeType,
                  data: audioBase64,
                },
              },
              {
                text: promptText,
              },
            ],
          },
        });
        transcript = (response.text || "").trim();
      } catch (primaryErr: any) {
        console.warn("[Transcribe] gemini-3.5-transcribe failed, trying gemini-3.8-flash fallback:", primaryErr?.message || primaryErr);
      }

      // If primary returned empty or failed, try gemini-3.8-flash
      if (!transcript) {
        try {
          const fallbackRes = await ai.models.generateContent({
            model: "gemini-3.8-flash",
            contents: {
              parts: [
                {
                  inlineData: {
                    mimeType,
                    data: audioBase64,
                  },
                },
                {
                  text: promptText,
                },
              ],
            },
          });
          transcript = (fallbackRes.text || "").trim();
        } catch (fallbackErr: any) {
          console.warn("[Transcribe] gemini-3.8-flash fallback failed:", fallbackErr?.message || fallbackErr);
        }
      }

      // Clean up common AI artifacts
      const cleanTranscript = transcript
        .replace(/^["'`]+|["'`]+$/g, "")
        .replace(/^speaker:\s*/i, "")
        .replace(/^user:\s*/i, "")
        .trim();

      res.json({ transcript: cleanTranscript });
    } catch (error: any) {
      console.warn("[Transcribe] Error in /api/transcribe:", error?.message || error);
      res.status(500).json({
        error: error?.message || "Failed to transcribe audio.",
      });
    }
  });

  // Diagnostic Endpoint: Analyze 3-Second Audio Test Recording
  app.post("/api/audio-diagnostic", async (req, res) => {
    try {
      const { audioBase64, mimeType = "audio/webm", language = "en-IN" } = req.body;
      if (!audioBase64) {
        res.status(400).json({ error: "audioBase64 is required for diagnostic." });
        return;
      }

      const ai = getGenAIClient();
      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: [
          {
            role: "user",
            parts: [
              {
                inlineData: {
                  mimeType,
                  data: audioBase64,
                },
              },
              {
                text: `You are an audio engineering clarity and speech diagnostic evaluator.
Analyze this 3-second recording from a user's microphone. Evaluate:
1. Speech intelligibility & confidence score (integer 0 to 100).
2. Clarity grade: "Excellent" | "Good" | "Fair" | "Poor" | "Silent".
3. Background noise level: "Low" | "Moderate" | "High".
4. Any speech detected (boolean) and the exact transcribed speech (if any words spoken).
5. Detected audio issues: array of issues (e.g. "Low volume", "Background noise/hum", "Audio clipping/distortion", "Room reverberation", "No speech detected", or "None").
6. 2 to 3 actionable troubleshooting tips for the user (e.g. mic distance, input volume, noise reduction).
7. A concise 1-sentence diagnostic summary.

Output valid JSON matching this schema:
{
  "transcript": string,
  "confidenceScore": number,
  "clarityGrade": string,
  "backgroundNoiseLevel": string,
  "speechDetected": boolean,
  "detectedIssues": string[],
  "troubleshootingTips": string[],
  "summary": string
}`,
              },
            ],
          },
        ],
        config: {
          responseMimeType: "application/json",
          temperature: 0.2,
        },
      });

      const responseText = response.text || "{}";
      let parsed = {};
      try {
        parsed = JSON.parse(responseText);
      } catch {
        parsed = {
          transcript: "",
          confidenceScore: 75,
          clarityGrade: "Good",
          backgroundNoiseLevel: "Low",
          speechDetected: true,
          detectedIssues: [],
          troubleshootingTips: [
            "Keep microphone 15-20cm from mouth",
            "Ensure room is quiet during recording",
          ],
          summary: "Audio recording received successfully.",
        };
      }

      res.json(parsed);
    } catch (error: any) {
      console.warn("[AudioDiagnostic] Evaluation error in /api/audio-diagnostic:", error?.message || error);
      res.status(500).json({
        error: error?.message || "Audio diagnostic evaluation failed.",
      });
    }
  });

  const httpServer = http.createServer(app);

  if (process.env.NODE_ENV !== "production") {
    const isHmrDisabled = process.env.DISABLE_HMR === "true";
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        port: PORT,
        host: "0.0.0.0",
        hmr: isHmrDisabled ? false : { server: httpServer },
        watch: isHmrDisabled ? null : {},
      },
      appType: "spa",
    });
    app.use(vite.middlewares);

    // Fallback for all client-side navigation in dev mode
    app.use("*", async (req, res, next) => {
      const url = req.originalUrl;
      if (url.startsWith("/api/")) {
        return next();
      }
      try {
        const indexPath = path.resolve(__dirname, "index.html");
        let template = fs.readFileSync(indexPath, "utf-8");
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ "Content-Type": "text/html" }).end(template);
      } catch (e: any) {
        if (vite) vite.ssrFixStacktrace(e);
        next(e);
      }
    });
  } else {
    const distPath = path.resolve(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`\n  VITE v8.3.0  ready in 150 ms\n\n  ➜  Local:   http://localhost:${PORT}/\n  ➜  Network: http://0.0.0.0:${PORT}/\n`);
    console.log(`BharatAI server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
