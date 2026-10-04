export type IndianLanguageCode =
  | "hinglish"
  | "en-IN"
  | "hi-IN"
  | "ta-IN"
  | "te-IN"
  | "bn-IN"
  | "mr-IN"
  | "gu-IN"
  | "kn-IN"
  | "ml-IN"
  | "pa-IN"
  | "or-IN";

export interface LanguageOption {
  code: IndianLanguageCode;
  name: string;
  nativeName: string;
  speechRecognitionLang: string;
  browserVoiceLang: string;
  sampleGreeting: string;
  samplePrompt: string;
  regionLabel: string;
}

export type AvatarGender = "female" | "male";

export type AvatarEmotion =
  | "friendly"
  | "enthusiastic"
  | "thoughtful"
  | "empathetic"
  | "curious";

export type AgentState = "idle" | "listening" | "thinking" | "speaking";

export interface AvatarPersona {
  id: string;
  name: string;
  fullName: string;
  gender: AvatarGender;
  styleLabel: string;
  city: string;
  role: string;
  personalityDescription: string;
  defaultVoiceName: "Kore" | "Puck" | "Zephyr" | "Charon" | "Fenrir";
  browserPitch: number;
  browserRate: number;
  appearance: {
    skinTone: string;
    skinShadow: string;
    skinHighlight: string;
    hairColor: string;
    outfitPrimary: string;
    outfitSecondary: string;
    outfitAccent: string;
    lipColor: string;
    hasGlasses?: boolean;
    hasBindi?: boolean;
    hasBeard?: boolean;
    collarStyle: "kurta" | "blazer" | "bandhgala" | "corporate";
  };
}

export interface VoiceOption {
  id: "Kore" | "Puck" | "Zephyr" | "Charon" | "Fenrir";
  label: string;
  gender: AvatarGender;
  timbre: string;
  recommendedFor: string;
}

export interface ConversationMessage {
  id: string;
  role: "user" | "model";
  text: string;
  timestamp: string;
  language: IndianLanguageCode;
  emotion?: AvatarEmotion;
  interrupted?: boolean;
}

export interface AudioVisemeFrame {
  volume: number; // 0..1 overall RMS
  jawOpen: number; // 0..1 low-frequency energy
  lipWidth: number; // 0..1 mid-frequency formant
  lipRound: number; // 0..1 vowel rounding
  sibilance: number; // 0..1 high-frequency energy
  bands: number[]; // 24 frequency bars for live waveform visualization
}
