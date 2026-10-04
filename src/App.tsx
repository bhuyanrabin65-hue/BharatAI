import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  AgentState,
  AudioVisemeFrame,
  AvatarEmotion,
  AvatarPersona,
  ConversationMessage,
  IndianLanguageCode,
  VoiceOption,
} from "./types/agent";
import {
  AVATAR_PERSONAS,
  INDIAN_LANGUAGES,
} from "./data/indianAgentConfig";
import { TalkingAvatarStage } from "./components/TalkingAvatarStage";
import { AudioWaveform } from "./components/AudioWaveform";
import { PersonaAndLanguagePanel } from "./components/PersonaAndLanguagePanel";
import { ConversationHistoryPanel } from "./components/ConversationHistoryPanel";
import {
  Mic,
  MicOff,
  PhoneCall,
  PhoneOff,
  Pause,
  Play,
  Square,
  Sun,
  Moon,
  AlertCircle,
  Radio,
  Activity,
  Timer,
} from "lucide-react";

function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const pad = (n: number) => n.toString().padStart(2, "0");

  if (hours > 0) {
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${pad(minutes)}:${pad(seconds)}`;
}

const STORAGE_KEY_HISTORY = "bharat_ai_history_v1";
const STORAGE_KEY_CONSENT = "bharat_ai_consent_v1";

export function App() {
  const [darkMode, setDarkMode] = useState<boolean>(true);

  const [selectedPersona, setSelectedPersona] = useState<AvatarPersona>(
    AVATAR_PERSONAS[0]
  );
  const [selectedLanguage, setSelectedLanguage] =
    useState<IndianLanguageCode>("hinglish");
  const [selectedVoice, setSelectedVoice] = useState<VoiceOption["id"]>(
    AVATAR_PERSONAS[0].defaultVoiceName
  );
  const [formality, setFormality] = useState<"casual" | "balanced" | "formal">(
    "balanced"
  );

  const [isSessionActive, setIsSessionActive] = useState<boolean>(false);
  const [isSessionPaused, setIsSessionPaused] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [agentState, setAgentState] = useState<AgentState>("idle");
  const [emotion, setEmotion] = useState<AvatarEmotion>("friendly");

  const [liveCaption, setLiveCaption] = useState<string>(
    INDIAN_LANGUAGES[0].sampleGreeting
  );
  const [userInterimTranscript, setUserInterimTranscript] =
    useState<string>("");
  const [textInput, setTextInput] = useState<string>("");
  const [micError, setMicError] = useState<string | null>(null);
  const [isRecordingFallback, setIsRecordingFallback] =
    useState<boolean>(false);
  const [sessionDuration, setSessionDuration] = useState<number>(0);
  const [isUserSpeaking, setIsUserSpeaking] = useState<boolean>(false);

  const isVadRecordingRef = useRef<boolean>(false);
  const vadRecorderRef = useRef<MediaRecorder | null>(null);
  const vadChunksRef = useRef<Blob[]>([]);
  const vadSpeechStartRef = useRef<number>(0);
  const vadLastAudioRef = useRef<number>(0);
  const isTranscribingRef = useRef<boolean>(false);
  const speechDetectedFramesRef = useRef<number>(0);
  const lastFinalTranscriptTimestampRef = useRef<number>(0);
  const startVadRecordingRef = useRef<() => void>(() => {});
  const stopVadRecordingRef = useRef<() => void>(() => {});

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | null = null;
    if (isSessionActive && !isSessionPaused) {
      intervalId = setInterval(() => {
        setSessionDuration((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isSessionActive, isSessionPaused]);

  const [saveConsent, setSaveConsent] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY_CONSENT) === "true";
    } catch {
      return false;
    }
  });

  const [messages, setMessages] = useState<ConversationMessage[]>(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY_CONSENT) === "true") {
        const saved = localStorage.getItem(STORAGE_KEY_HISTORY);
        if (saved) return JSON.parse(saved);
      }
    } catch {}
    return [
      {
        id: "welcome-1",
        role: "model",
        text: "Namaste! Main Ananya hoon, aapki AI conversation partner. Hum English, Hindi, Hinglish ya aapki pasandida Indian language mein baat kar sakte hain. Aaj kis topic se shuru karein?",
        timestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
        language: "hinglish",
        emotion: "friendly",
      },
    ];
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_CONSENT, String(saveConsent));
      if (saveConsent) {
        localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(messages));
      } else {
        localStorage.removeItem(STORAGE_KEY_HISTORY);
      }
    } catch {}
  }, [messages, saveConsent]);

  const visemeRef = useRef<AudioVisemeFrame>({
    volume: 0,
    jawOpen: 0,
    lipWidth: 0.5,
    lipRound: 0,
    sibilance: 0,
    bands: new Array(24).fill(0.06),
  });
  const [waveformBands, setWaveformBands] = useState<number[]>(
    new Array(24).fill(0.06)
  );

  const audioCtxRef = useRef<AudioContext | null>(null);
  const ttsAnalyserRef = useRef<AnalyserNode | null>(null);
  const currentAudioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const htmlAudioRef = useRef<HTMLAudioElement | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const micAnalyserRef = useRef<AnalyserNode | null>(null);
  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);

  const sessionActiveRef = useRef(isSessionActive);
  const sessionPausedRef = useRef(isSessionPaused);
  const mutedRef = useRef(isMuted);
  const agentStateRef = useRef(agentState);
  const selectedLangRef = useRef(selectedLanguage);
  const selectedPersonaRef = useRef(selectedPersona);
  const selectedVoiceRef = useRef(selectedVoice);
  const formalityRef = useRef(formality);
  const messagesRef = useRef(messages);

  useEffect(() => {
    sessionActiveRef.current = isSessionActive;
  }, [isSessionActive]);
  useEffect(() => {
    sessionPausedRef.current = isSessionPaused;
  }, [isSessionPaused]);
  useEffect(() => {
    mutedRef.current = isMuted;
  }, [isMuted]);
  useEffect(() => {
    agentStateRef.current = agentState;
  }, [agentState]);
  useEffect(() => {
    selectedLangRef.current = selectedLanguage;
  }, [selectedLanguage]);
  useEffect(() => {
    selectedPersonaRef.current = selectedPersona;
  }, [selectedPersona]);
  useEffect(() => {
    selectedVoiceRef.current = selectedVoice;
  }, [selectedVoice]);
  useEffect(() => {
    formalityRef.current = formality;
  }, [formality]);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const getOrCreateAudioContext = useCallback(() => {
    if (!audioCtxRef.current) {
      const AudioCtx =
        window.AudioContext || (window as any).webkitAudioContext;
      audioCtxRef.current = new AudioCtx();
    }
    if (audioCtxRef.current.state === "suspended") {
      audioCtxRef.current.resume().catch(() => {});
    }
    return audioCtxRef.current;
  }, []);

  const stopSpeaking = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (currentAudioSourceRef.current) {
      try {
        currentAudioSourceRef.current.onended = null;
        currentAudioSourceRef.current.stop();
        currentAudioSourceRef.current.disconnect();
      } catch {}
      currentAudioSourceRef.current = null;
    }
    if (htmlAudioRef.current) {
      htmlAudioRef.current.pause();
      htmlAudioRef.current.currentTime = 0;
      htmlAudioRef.current = null;
    }
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    visemeRef.current = {
      volume: 0,
      jawOpen: 0,
      lipWidth: 0.5,
      lipRound: 0,
      sibilance: 0,
      bands: new Array(24).fill(0.06),
    };
    if (
      sessionActiveRef.current &&
      !sessionPausedRef.current &&
      !mutedRef.current
    ) {
      setAgentState("listening");
    } else {
      setAgentState("idle");
    }
  }, []);

  useEffect(() => {
    let rafId: number;
    const freqData = new Uint8Array(128);

    const updateAudioMetrics = (now: number) => {
      const currentState = agentStateRef.current;

      if (currentState === "speaking" && ttsAnalyserRef.current) {
        ttsAnalyserRef.current.getByteFrequencyData(freqData);

        let lowSum = 0;
        let midSum = 0;
        let highSum = 0;

        for (let i = 1; i <= 10; i++) lowSum += freqData[i];
        for (let i = 11; i <= 32; i++) midSum += freqData[i];
        for (let i = 33; i <= 64; i++) highSum += freqData[i];

        const lowAvg = lowSum / (10 * 255);
        const midAvg = midSum / (22 * 255);
        const highAvg = highSum / (32 * 255);
        const overallVol = Math.min(1, (lowAvg * 1.4 + midAvg * 1.2 + highAvg * 0.6) / 1.8);

        if (overallVol > 0.02) {
          const bands: number[] = [];
          for (let b = 0; b < 24; b++) {
            const idx = Math.min(127, Math.floor((b / 24) * 56) + 1);
            bands.push(Math.min(1, freqData[idx] / 230));
          }
          visemeRef.current = {
            volume: overallVol,
            jawOpen: Math.min(1, Math.pow(lowAvg * 1.85, 0.85)),
            lipWidth: Math.min(1, 0.35 + midAvg * 0.9),
            lipRound: Math.max(0, lowAvg - midAvg * 0.8),
            sibilance: Math.min(1, highAvg * 2.1),
            bands,
          };
          setWaveformBands(bands);
          rafId = requestAnimationFrame(updateAudioMetrics);
          return;
        }
      }

      if (currentState === "speaking") {
        const syllableWave =
          Math.max(0, Math.sin(now * 0.019) * 0.65 + Math.sin(now * 0.031) * 0.35);
        const vowelMod = 0.5 + 0.4 * Math.cos(now * 0.013);
        const bands = Array.from({ length: 24 }, (_, idx) => {
          return Math.max(
            0.08,
            Math.min(
              0.95,
              syllableWave *
                (0.4 + 0.55 * Math.sin(now * 0.012 + idx * 0.45))
            )
          );
        });
        visemeRef.current = {
          volume: syllableWave * 0.8,
          jawOpen: syllableWave * 0.78,
          lipWidth: vowelMod,
          lipRound: Math.max(0, 0.5 - vowelMod * 0.5),
          sibilance: Math.max(0, Math.sin(now * 0.043) * 0.5),
          bands,
        };
        setWaveformBands(bands);
      } else if (
        currentState === "listening" &&
        micAnalyserRef.current &&
        !mutedRef.current
      ) {
        micAnalyserRef.current.getByteFrequencyData(freqData);
        let sum = 0;
        const bands: number[] = [];
        for (let b = 0; b < 24; b++) {
          const idx = Math.min(127, b * 2 + 1);
          const v = freqData[idx] / 255;
          sum += v;
          bands.push(Math.max(0.05, Math.min(1, v * 1.5)));
        }
        const avg = sum / 24;
        visemeRef.current = {
          volume: avg,
          jawOpen: 0,
          lipWidth: 0.52,
          lipRound: 0,
          sibilance: 0,
          bands,
        };
        setWaveformBands(bands);

        // Automatic Voice Activity Detection (VAD) turn-taking loop
        const speechThreshold = 0.05;
        if (avg >= speechThreshold) {
          speechDetectedFramesRef.current++;
          if (speechDetectedFramesRef.current >= 2) {
            if (!isVadRecordingRef.current && !isTranscribingRef.current) {
              startVadRecordingRef.current();
            } else {
              vadLastAudioRef.current = now;
            }
          }
        } else {
          speechDetectedFramesRef.current = 0;
          if (isVadRecordingRef.current) {
            const silenceMs = now - vadLastAudioRef.current;
            const speechMs = now - vadSpeechStartRef.current;
            // Finish speech turn after 1.2s of natural pause
            if (silenceMs > 1200 && speechMs >= 500) {
              stopVadRecordingRef.current();
            }
          }
        }
      } else {
        const idleBands = Array.from({ length: 24 }, (_, idx) =>
          currentState === "thinking"
            ? 0.15 + 0.22 * Math.sin(now * 0.008 + idx * 0.4)
            : 0.06
        );
        visemeRef.current = {
          volume: 0,
          jawOpen: 0,
          lipWidth: 0.52,
          lipRound: 0,
          sibilance: 0,
          bands: idleBands,
        };
        setWaveformBands(idleBands);
      }

      rafId = requestAnimationFrame(updateAudioMetrics);
    };

    rafId = requestAnimationFrame(updateAudioMetrics);
    return () => cancelAnimationFrame(rafId);
  }, []);

  const speakWithBrowserFallback = useCallback(
    (text: string, langCode: IndianLanguageCode, onDone: () => void) => {
      if (!("speechSynthesis" in window)) {
        onDone();
        return;
      }
      window.speechSynthesis.cancel();
      const cleanText = text
        .replace(/\[EMOTION:[a-zA-Z]+\]/g, "")
        .replace(/[*_#`~]+/g, "")
        .trim();

      const utterance = new SpeechSynthesisUtterance(cleanText);
      const langObj =
        INDIAN_LANGUAGES.find((l) => l.code === langCode) ||
        INDIAN_LANGUAGES[0];
      utterance.lang = langObj.browserVoiceLang;
      utterance.pitch = selectedPersonaRef.current.browserPitch;
      utterance.rate = selectedPersonaRef.current.browserRate;

      const voices = window.speechSynthesis.getVoices();
      const preferredVoice =
        voices.find(
          (v) =>
            v.lang.toLowerCase().includes(langObj.browserVoiceLang.toLowerCase())
        ) ||
        voices.find((v) => v.lang.toLowerCase().includes("en-in")) ||
        voices.find((v) => v.lang.toLowerCase().includes("hi-in"));

      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }

      let finished = false;
      const safeDone = () => {
        if (!finished) {
          finished = true;
          onDone();
        }
      };

      utterance.onend = safeDone;
      utterance.onerror = safeDone;
      setAgentState("speaking");
      window.speechSynthesis.resume();
      window.speechSynthesis.speak(utterance);
    },
    []
  );

  const speakTextResponse = useCallback(
    async (
      text: string,
      langCode: IndianLanguageCode,
      emotionTone: AvatarEmotion
    ) => {
      const cleanText = text
        .replace(/\[EMOTION:[a-zA-Z]+\]/g, "")
        .trim();
      if (!cleanText) return;

      setLiveCaption(cleanText);
      setAgentState("speaking");

      const finishSpeaking = () => {
        currentAudioSourceRef.current = null;
        if (
          sessionActiveRef.current &&
          !sessionPausedRef.current &&
          !mutedRef.current
        ) {
          setAgentState("listening");
        } else {
          setAgentState("idle");
        }
      };

      try {
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: cleanText,
            voiceName: selectedVoiceRef.current,
            language: langCode,
            emotion: emotionTone,
          }),
        });

        if (!res.ok) {
          throw new Error("TTS API fallback to browser voice");
        }

        const data = await res.json();
        if (data.fallbackToBrowser || !data.audioBase64) {
          speakWithBrowserFallback(cleanText, langCode, finishSpeaking);
          return;
        }

        const binaryString = window.atob(data.audioBase64);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        const audioCtx = getOrCreateAudioContext();
        const audioBuffer = await audioCtx.decodeAudioData(
          bytes.buffer.slice(0)
        );

        const source = audioCtx.createBufferSource();
        source.buffer = audioBuffer;

        if (!ttsAnalyserRef.current) {
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 256;
          analyser.smoothingTimeConstant = 0.65;
          ttsAnalyserRef.current = analyser;
        }

        source.connect(ttsAnalyserRef.current);
        ttsAnalyserRef.current.connect(audioCtx.destination);

        currentAudioSourceRef.current = source;
        source.onended = finishSpeaking;
        source.start(0);
      } catch {
        speakWithBrowserFallback(cleanText, langCode, finishSpeaking);
      }
    },
    [getOrCreateAudioContext, speakWithBrowserFallback]
  );

  const sendUserMessage = useCallback(
    async (userText: string, overrideLang?: IndianLanguageCode) => {
      const trimmed = userText.trim();
      if (!trimmed) return;

      stopSpeaking();

      const activeLang = overrideLang || selectedLangRef.current;
      if (overrideLang && overrideLang !== selectedLangRef.current) {
        setSelectedLanguage(overrideLang);
      }

      const userMsg: ConversationMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        text: trimmed,
        timestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
        language: activeLang,
      };

      const historyPayload = messagesRef.current.slice(-12).map((m) => ({
        role: m.role,
        text: m.text,
      }));

      setMessages((prev) => [...prev, userMsg]);
      setUserInterimTranscript("");
      setAgentState("thinking");
      setLiveCaption(`${selectedPersonaRef.current.name} is thinking...`);

      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const response = await fetch("/api/chat/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: trimmed,
            history: historyPayload,
            language: activeLang,
            personaName: selectedPersonaRef.current.name,
            personaRole: selectedPersonaRef.current.role,
            personaStyle: selectedPersonaRef.current.personalityDescription,
            formality: formalityRef.current,
          }),
          signal: controller.signal,
        });

        if (!response.ok || !response.body) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(
            errData.error || "Unable to reach conversational AI server."
          );
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let accumulatedText = "";
        let detectedEmotion: AvatarEmotion = "friendly";

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split("\n\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const jsonStr = line.slice(6).trim();
            if (!jsonStr) continue;

            try {
              const parsed = JSON.parse(jsonStr);
              if (parsed.error) {
                throw new Error(parsed.error);
              }
              if (parsed.text) {
                accumulatedText += parsed.text;
                const emotionMatch = accumulatedText.match(
                  /\[EMOTION:(friendly|enthusiastic|thoughtful|empathetic|curious)\]/i
                );
                if (emotionMatch) {
                  detectedEmotion =
                    emotionMatch[1].toLowerCase() as AvatarEmotion;
                  setEmotion(detectedEmotion);
                }
                const cleanDisplay = accumulatedText
                  .replace(/\[EMOTION:[a-zA-Z]+\]/gi, "")
                  .trim();
                if (cleanDisplay) {
                  setLiveCaption(cleanDisplay);
                }
              }
            } catch {}
          }
        }

        const finalCleanText = accumulatedText
          .replace(/\[EMOTION:[a-zA-Z]+\]/gi, "")
          .trim();

        if (finalCleanText) {
          const modelMsg: ConversationMessage = {
            id: `model-${Date.now()}`,
            role: "model",
            text: finalCleanText,
            timestamp: new Date().toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            }),
            language: activeLang,
            emotion: detectedEmotion,
          };
          setMessages((prev) => [...prev, modelMsg]);
          await speakTextResponse(finalCleanText, activeLang, detectedEmotion);
        } else {
          setAgentState(
            sessionActiveRef.current && !mutedRef.current ? "listening" : "idle"
          );
        }
      } catch (err: any) {
        if (err?.name === "AbortError") return;
        const fallbackMsg =
          "Maaf kijiyega, abhi network ya server connection mein thodi dikkat aayi. Kripya ek baar phir se koshish karein.";
        setLiveCaption(fallbackMsg);
        setAgentState("idle");
      }
    },
    [speakTextResponse, stopSpeaking]
  );

  const startMicrophoneAndRecognition = useCallback(async () => {
    setMicError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      micStreamRef.current = stream;

      const audioCtx = getOrCreateAudioContext();
      const micSource = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.7;
      micSource.connect(analyser);
      micAnalyserRef.current = analyser;

      const SpeechRecognition =
        (window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition;

      if (SpeechRecognition) {
        if (recognitionRef.current) {
          try {
            recognitionRef.current.stop();
          } catch {}
        }

        const recognition = new SpeechRecognition();
        const langObj =
          INDIAN_LANGUAGES.find((l) => l.code === selectedLangRef.current) ||
          INDIAN_LANGUAGES[0];

        recognition.lang = langObj.speechRecognitionLang;
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;

        recognition.onresult = (event: any) => {
          if (mutedRef.current || sessionPausedRef.current) return;

          let interim = "";
          let finalTranscript = "";

          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcriptPiece = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              finalTranscript += transcriptPiece;
            } else {
              interim += transcriptPiece;
            }
          }

          if (
            (interim.trim().length > 4 || finalTranscript.trim().length > 0) &&
            agentStateRef.current === "speaking"
          ) {
            stopSpeaking();
          }

          if (interim.trim()) {
            setUserInterimTranscript(interim.trim());
          }

          if (finalTranscript.trim()) {
            setUserInterimTranscript("");
            sendUserMessage(finalTranscript.trim());
          }
        };

        recognition.onerror = (event: any) => {
          if (event.error === "not-allowed") {
            setMicError(
              "Microphone permission was denied. Please allow microphone access in your browser bar or use text chat below."
            );
          }
        };

        recognition.onend = () => {
          if (
            sessionActiveRef.current &&
            !sessionPausedRef.current &&
            !mutedRef.current
          ) {
            try {
              const updatedLang =
                INDIAN_LANGUAGES.find(
                  (l) => l.code === selectedLangRef.current
                ) || INDIAN_LANGUAGES[0];
              recognition.lang = updatedLang.speechRecognitionLang;
              recognition.start();
            } catch {}
          }
        };

        recognitionRef.current = recognition;
        recognition.start();
      }

      setAgentState("listening");
      return true;
    } catch {
      setMicError(
        "Could not access microphone. Please grant microphone permission or use the text chat input below."
      );
      return false;
    }
  }, [getOrCreateAudioContext, sendUserMessage, stopSpeaking]);

  useEffect(() => {
    if (recognitionRef.current && isSessionActive && !isSessionPaused && !isMuted) {
      const langObj =
        INDIAN_LANGUAGES.find((l) => l.code === selectedLanguage) ||
        INDIAN_LANGUAGES[0];
      try {
        recognitionRef.current.lang = langObj.speechRecognitionLang;
        recognitionRef.current.stop();
      } catch {}
    }
  }, [selectedLanguage, isSessionActive, isSessionPaused, isMuted]);

  const handleStartConversation = async () => {
    getOrCreateAudioContext();
    setSessionDuration(0);
    setIsSessionActive(true);
    setIsSessionPaused(false);
    setIsMuted(false);

    const micOk = await startMicrophoneAndRecognition();
    const langObj =
      INDIAN_LANGUAGES.find((l) => l.code === selectedLanguage) ||
      INDIAN_LANGUAGES[0];

    await speakTextResponse(langObj.sampleGreeting, selectedLanguage, "friendly");
    if (micOk) {
      setAgentState("listening");
    }
  };

  const handleTogglePause = () => {
    if (!isSessionActive) return;
    const nextPaused = !isSessionPaused;
    setIsSessionPaused(nextPaused);
    if (nextPaused) {
      stopSpeaking();
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }
      setAgentState("idle");
    } else {
      if (recognitionRef.current && !isMuted) {
        try {
          recognitionRef.current.start();
        } catch {}
      }
      setAgentState(isMuted ? "idle" : "listening");
    }
  };

  const handleToggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    if (micStreamRef.current) {
      micStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !nextMuted;
      });
    }
    if (nextMuted) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }
      if (agentState === "listening") {
        setAgentState("idle");
      }
    } else if (isSessionActive && !isSessionPaused) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.start();
        } catch {}
      }
      if (agentState === "idle") {
        setAgentState("listening");
      }
    }
  };

  const handleEndConversation = useCallback(() => {
    setIsSessionActive(false);
    setIsSessionPaused(false);
    setSessionDuration(0);
    stopSpeaking();

    if (recognitionRef.current) {
      try {
        recognitionRef.current.onend = null;
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }

    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
    }

    setUserInterimTranscript("");
    setAgentState("idle");
    setLiveCaption("Conversation ended. Tap Start Conversation anytime to talk again.");
  }, [stopSpeaking]);

  const handleToggleServerRecord = async () => {
    if (isRecordingFallback) {
      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state !== "inactive"
      ) {
        mediaRecorderRef.current.stop();
      }
      setIsRecordingFallback(false);
      return;
    }

    try {
      setMicError(null);
      stopSpeaking();
      let stream = micStreamRef.current;
      if (!stream || !stream.active) {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        micStreamRef.current = stream;
      }

      recordedChunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        const blob = new Blob(recordedChunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        if (blob.size < 400) return;

        setAgentState("thinking");
        setLiveCaption("Transcribing your voice...");

        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64data = (reader.result as string)?.split(",")[1];
          if (!base64data) return;
          try {
            const res = await fetch("/api/transcribe", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                audioBase64: base64data,
                mimeType: blob.type || "audio/webm",
                language: selectedLangRef.current,
              }),
            });
            const data = await res.json();
            if (data.transcript && data.transcript.trim()) {
              sendUserMessage(data.transcript.trim());
            } else {
              setLiveCaption(
                "Could not hear clear speech. Please speak closer to the mic."
              );
              setAgentState(isSessionActive ? "listening" : "idle");
            }
          } catch {
            setLiveCaption("Voice transcription error. Please try again.");
            setAgentState("idle");
          }
        };
        reader.readAsDataURL(blob);
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecordingFallback(true);
      setAgentState("listening");
      setLiveCaption("Listening... Tap 'Send Voice' when finished speaking.");
    } catch {
      setMicError(
        "Microphone access is required for voice recording. Please allow microphone access."
      );
    }
  };

  const handleSelectPersona = (persona: AvatarPersona) => {
    setSelectedPersona(persona);
    setSelectedVoice(persona.defaultVoiceName);
    const langObj =
      INDIAN_LANGUAGES.find((l) => l.code === selectedLanguage) ||
      INDIAN_LANGUAGES[0];
    setLiveCaption(`${persona.fullName} (${persona.city}): "${langObj.sampleGreeting}"`);
  };

  return (
    <div
      className={`min-h-screen transition-colors ${
        darkMode
          ? "bg-[#070E1C] text-slate-100"
          : "bg-[#F8FAFC] text-slate-900"
      }`}
    >
      <header
        className={`sticky top-0 z-30 flex items-center justify-between px-6 py-3.5 border-b backdrop-blur-md transition-colors ${
          darkMode
            ? "bg-[#070E1C]/85 border-slate-800/90"
            : "bg-white/90 border-slate-200"
        }`}
      >
        <a
          href="#studio"
          className={`text-lg font-bold tracking-tight whitespace-nowrap ${
            darkMode ? "text-white" : "text-slate-900"
          }`}
        >
          BharatAI
        </a>

        <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
          <a
            href="#studio"
            className={`hover:underline underline-offset-4 transition-colors whitespace-nowrap ${
              darkMode
                ? "text-slate-300 hover:text-white"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Live Studio
          </a>
          <a
            href="#settings"
            className={`hover:underline underline-offset-4 transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              darkMode
                ? "text-slate-300 hover:text-white"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <span>Settings & Diagnostics</span>
          </a>
          <a
            href="#transcript"
            className={`hover:underline underline-offset-4 transition-colors whitespace-nowrap ${
              darkMode
                ? "text-slate-300 hover:text-white"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Conversation History
          </a>
        </nav>

        <div className="flex items-center gap-2.5">
          {/* Active Session Duration Timer */}
          {isSessionActive && (
            <div
              className={`flex items-center gap-2 px-3 py-1.5 min-h-[40px] rounded-xl border text-xs font-mono font-medium tabular-nums transition-all ${
                isSessionPaused
                  ? darkMode
                    ? "bg-amber-500/10 border-amber-500/30 text-amber-300"
                    : "bg-amber-50 border-amber-300 text-amber-800"
                  : darkMode
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                  : "bg-emerald-50 border-emerald-300 text-emerald-800"
              }`}
              title={
                isSessionPaused
                  ? "Active conversation paused"
                  : "Active conversation duration"
              }
              aria-label={`Session duration: ${formatDuration(sessionDuration)}`}
            >
              <span className="relative flex h-2 w-2">
                {!isSessionPaused && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                )}
                <span
                  className={`relative inline-flex rounded-full h-2 w-2 ${
                    isSessionPaused ? "bg-amber-400" : "bg-emerald-500"
                  }`}
                />
              </span>
              <Timer className="w-3.5 h-3.5 opacity-80 shrink-0" />
              <div className="flex items-baseline gap-1.5 leading-tight">
                <span className="text-[10px] font-sans font-semibold uppercase tracking-wider hidden sm:inline opacity-75">
                  Session:
                </span>
                <span className="font-bold text-xs sm:text-sm tracking-wide">
                  {formatDuration(sessionDuration)}
                </span>
              </div>
              {isSessionPaused && (
                <span className="text-[10px] font-sans font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-300 hidden md:inline">
                  Paused
                </span>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={() => setDarkMode(!darkMode)}
            className={`min-h-[40px] min-w-[40px] p-2 rounded-xl border flex items-center justify-center transition-colors ${
              darkMode
                ? "border-slate-800 bg-slate-900 text-sky-400 hover:bg-slate-800"
                : "border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
            aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
          >
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          {!isSessionActive ? (
            <button
              type="button"
              onClick={handleStartConversation}
              className="px-4 py-2 min-h-[40px] text-xs font-semibold rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 transition-colors flex items-center gap-1.5 whitespace-nowrap"
            >
              <PhoneCall className="w-3.5 h-3.5" />
              <span>Start Conversation</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleEndConversation}
              className="px-4 py-2 min-h-[40px] text-xs font-semibold rounded-xl bg-rose-600 hover:bg-rose-500 text-white transition-colors flex items-center gap-1.5 whitespace-nowrap"
            >
              <PhoneOff className="w-3.5 h-3.5" />
              <span>End Session</span>
            </button>
          )}
        </div>
      </header>

      <main className="max-w-[1380px] mx-auto px-4 sm:px-6 py-6">
        {micError && (
          <div
            className={`mb-6 p-4 rounded-2xl border flex items-start justify-between gap-3 ${
              darkMode
                ? "bg-amber-950/40 border-amber-700/60 text-amber-200"
                : "bg-amber-50 border-amber-300 text-amber-900"
            }`}
          >
            <div className="flex items-start gap-2.5 text-xs leading-relaxed">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span>{micError}</span>
            </div>
            <button
              type="button"
              onClick={() => setMicError(null)}
              className="text-xs font-semibold underline whitespace-nowrap"
            >
              Dismiss
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div
            id="studio"
            className="lg:col-span-5 xl:col-span-5 flex flex-col items-center lg:sticky lg:top-20"
          >
            <TalkingAvatarStage
              persona={selectedPersona}
              agentState={agentState}
              emotion={emotion}
              visemeRef={visemeRef}
              liveCaption={liveCaption}
              userInterimTranscript={userInterimTranscript}
              darkMode={darkMode}
              onInterrupt={stopSpeaking}
            />

            <div
              className={`w-full max-w-[520px] mt-4 p-4 rounded-2xl border transition-colors ${
                darkMode
                  ? "bg-slate-900/90 border-slate-800"
                  : "bg-white border-slate-200"
              }`}
            >
              <div className="flex items-center justify-between text-xs mb-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      isSessionActive && !isMuted && !isSessionPaused
                        ? "bg-emerald-400 animate-ping"
                        : isRecordingFallback
                        ? "bg-rose-500 animate-ping"
                        : "bg-slate-500"
                    }`}
                  />
                  <span
                    className={`font-medium ${
                      darkMode ? "text-slate-300" : "text-slate-700"
                    }`}
                  >
                    {isRecordingFallback
                      ? "Recording voice clip..."
                      : isSessionActive && !isMuted && !isSessionPaused
                      ? "Microphone Active · Hands-Free Listening"
                      : isMuted
                      ? "Microphone Muted"
                      : "Microphone Standby"}
                  </span>
                </div>
                <span
                  className={`font-mono tabular-nums text-[11px] ${
                    darkMode ? "text-sky-400" : "text-sky-700"
                  }`}
                >
                  {selectedPersona.name} · {selectedVoice}
                </span>
              </div>

              <AudioWaveform
                bands={waveformBands}
                state={agentState}
                isMuted={isMuted}
                darkMode={darkMode}
              />

              <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5">
                {!isSessionActive ? (
                  <button
                    type="button"
                    onClick={handleStartConversation}
                    className="flex-1 min-w-[180px] min-h-[48px] px-5 py-3 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold text-sm shadow-lg shadow-sky-500/20 transition-transform active:scale-[0.98] flex items-center justify-center gap-2 whitespace-nowrap"
                  >
                    <PhoneCall className="w-4 h-4" />
                    <span>Start Conversation</span>
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={handleToggleMute}
                      className={`min-h-[46px] px-4 py-2.5 rounded-xl font-medium text-xs border transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                        isMuted
                          ? "bg-amber-500/20 border-amber-500/50 text-amber-300"
                          : darkMode
                          ? "bg-slate-950 border-slate-800 text-slate-200 hover:border-slate-700"
                          : "bg-slate-100 border-slate-200 text-slate-800 hover:bg-slate-200"
                      }`}
                    >
                      {isMuted ? (
                        <>
                          <MicOff className="w-4 h-4 text-amber-400" />
                          <span>Unmute Mic</span>
                        </>
                      ) : (
                        <>
                          <Mic className="w-4 h-4 text-emerald-400" />
                          <span>Mute Mic</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={handleTogglePause}
                      className={`min-h-[46px] px-4 py-2.5 rounded-xl font-medium text-xs border transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                        darkMode
                          ? "bg-slate-950 border-slate-800 text-slate-200 hover:border-slate-700"
                          : "bg-slate-100 border-slate-200 text-slate-800 hover:bg-slate-200"
                      }`}
                    >
                      {isSessionPaused ? (
                        <>
                          <Play className="w-4 h-4 text-sky-400" />
                          <span>Resume</span>
                        </>
                      ) : (
                        <>
                          <Pause className="w-4 h-4 text-sky-400" />
                          <span>Pause</span>
                        </>
                      )}
                    </button>

                    {agentState === "speaking" && (
                      <button
                        type="button"
                        onClick={stopSpeaking}
                        className="min-h-[46px] px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs transition-colors flex items-center gap-1.5 whitespace-nowrap"
                      >
                        <Square className="w-3.5 h-3.5 fill-current" />
                        <span>Stop Speaking</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={handleEndConversation}
                      className="min-h-[46px] px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs transition-colors flex items-center gap-1.5 whitespace-nowrap"
                    >
                      <PhoneOff className="w-4 h-4" />
                      <span>End</span>
                    </button>
                  </>
                )}

                <button
                  type="button"
                  onClick={handleToggleServerRecord}
                  className={`min-h-[48px] px-4 py-2.5 rounded-xl text-xs font-semibold border transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                    isRecordingFallback
                      ? "bg-rose-600 border-rose-500 text-white animate-pulse"
                      : darkMode
                      ? "bg-slate-950 border-slate-800 text-sky-300 hover:border-sky-500/50"
                      : "bg-slate-100 border-slate-200 text-sky-700 hover:bg-sky-50"
                  }`}
                  title="Record and transcribe voice using server-side AI speech recognition"
                >
                  <Radio className="w-4 h-4" />
                  <span>
                    {isRecordingFallback ? "Send Voice" : "Push to Talk"}
                  </span>
                </button>
              </div>

              {/* Input Troubleshooting Shortcut */}
              <div
                className={`mt-3 pt-2.5 border-t border-dashed flex items-center justify-between text-[11px] ${
                  darkMode ? "border-slate-800 text-slate-400" : "border-slate-200 text-slate-500"
                }`}
              >
                <span>Troubleshoot input issues?</span>
                <a
                  href="#audio-diagnostic"
                  className="font-semibold text-sky-400 hover:text-sky-300 hover:underline flex items-center gap-1 transition-colors"
                >
                  <Activity className="w-3.5 h-3.5" />
                  <span>Run 3s Diagnostic</span>
                </a>
              </div>
            </div>
          </div>

          <div className="lg:col-span-7 xl:col-span-7 flex flex-col gap-6">
            <div id="transcript">
              <ConversationHistoryPanel
                messages={messages}
                onSendMessage={(text, overrideLang) =>
                  sendUserMessage(text, overrideLang)
                }
                onReplayMessage={(msg) =>
                  speakTextResponse(
                    msg.text,
                    msg.language,
                    msg.emotion || "friendly"
                  )
                }
                onClearHistory={() => {
                  stopSpeaking();
                  setMessages([]);
                  localStorage.removeItem(STORAGE_KEY_HISTORY);
                }}
                saveConsent={saveConsent}
                onToggleSaveConsent={setSaveConsent}
                textInput={textInput}
                onChangeTextInput={setTextInput}
                isProcessing={agentState === "thinking"}
                personaName={selectedPersona.name}
                darkMode={darkMode}
              />
            </div>

            <div id="settings">
              <div id="personas">
                <PersonaAndLanguagePanel
                  selectedPersona={selectedPersona}
                  onSelectPersona={handleSelectPersona}
                  selectedLanguage={selectedLanguage}
                  onSelectLanguage={(lang) => setSelectedLanguage(lang)}
                  selectedVoice={selectedVoice}
                  onSelectVoice={(v) => setSelectedVoice(v)}
                  formality={formality}
                  onChangeFormality={setFormality}
                  onTestVoice={() => {
                    const langObj =
                      INDIAN_LANGUAGES.find((l) => l.code === selectedLanguage) ||
                      INDIAN_LANGUAGES[0];
                    speakTextResponse(
                      langObj.sampleGreeting,
                      selectedLanguage,
                      "friendly"
                    );
                  }}
                  darkMode={darkMode}
                />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
