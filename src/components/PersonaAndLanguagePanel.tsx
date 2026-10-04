import React, { useState } from "react";
import {
  AvatarPersona,
  IndianLanguageCode,
  LanguageOption,
  VoiceOption,
} from "../types/agent";
import {
  AVATAR_PERSONAS,
  INDIAN_LANGUAGES,
  VOICE_OPTIONS,
} from "../data/indianAgentConfig";
import { Globe, User, Volume2, Sliders } from "lucide-react";
import { AudioDiagnosticTest } from "./AudioDiagnosticTest";

interface PersonaAndLanguagePanelProps {
  selectedPersona: AvatarPersona;
  onSelectPersona: (persona: AvatarPersona) => void;
  selectedLanguage: IndianLanguageCode;
  onSelectLanguage: (lang: IndianLanguageCode) => void;
  selectedVoice: VoiceOption["id"];
  onSelectVoice: (voice: VoiceOption["id"]) => void;
  formality: "casual" | "balanced" | "formal";
  onChangeFormality: (f: "casual" | "balanced" | "formal") => void;
  onTestVoice: () => void;
  darkMode: boolean;
}

export const PersonaAndLanguagePanel: React.FC<PersonaAndLanguagePanelProps> = ({
  selectedPersona,
  onSelectPersona,
  selectedLanguage,
  onSelectLanguage,
  selectedVoice,
  onSelectVoice,
  formality,
  onChangeFormality,
  onTestVoice,
  darkMode,
}) => {
  const [genderFilter, setGenderFilter] = useState<"all" | "female" | "male">(
    "all"
  );

  const filteredPersonas = AVATAR_PERSONAS.filter((p) =>
    genderFilter === "all" ? true : p.gender === genderFilter
  );

  const currentLangObj: LanguageOption =
    INDIAN_LANGUAGES.find((l) => l.code === selectedLanguage) ||
    INDIAN_LANGUAGES[0];

  return (
    <div className="flex flex-col gap-6">
      {/* 01. Indian Avatar Selection */}
      <section
        className={`p-5 rounded-2xl border transition-colors ${
          darkMode
            ? "bg-slate-900/90 border-slate-800"
            : "bg-white border-slate-200"
        }`}
      >
        <div className="flex items-center justify-between gap-2 mb-4">
          <div>
            <h2
              className={`text-base font-semibold ${
                darkMode ? "text-white" : "text-slate-900"
              }`}
            >
              01. Indian Studio Avatar
            </h2>
            <p
              className={`text-xs mt-0.5 ${
                darkMode ? "text-slate-400" : "text-slate-500"
              }`}
            >
              Select appearance style & conversational persona
            </p>
          </div>

          <div
            className={`flex items-center gap-1 p-1 rounded-lg ${
              darkMode ? "bg-slate-950" : "bg-slate-100"
            }`}
          >
            {(["all", "female", "male"] as const).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGenderFilter(g)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors capitalize whitespace-nowrap ${
                  genderFilter === g
                    ? darkMode
                      ? "bg-sky-500 text-slate-950 font-semibold"
                      : "bg-slate-900 text-white"
                    : darkMode
                    ? "text-slate-400 hover:text-white"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filteredPersonas.map((persona) => {
            const isSelected = persona.id === selectedPersona.id;

            return (
              <button
                key={persona.id}
                type="button"
                onClick={() => onSelectPersona(persona)}
                className={`w-full text-left p-3 rounded-xl border transition-all flex items-start gap-3 min-h-[76px] ${
                  isSelected
                    ? darkMode
                      ? "bg-sky-950/50 border-sky-400"
                      : "bg-sky-50/80 border-sky-600"
                    : darkMode
                    ? "bg-slate-950/60 border-slate-800/80 hover:border-slate-700"
                    : "bg-slate-50/70 border-slate-200 hover:border-slate-300"
                }`}
              >
                <div
                  className="w-12 h-12 rounded-xl shrink-0 border border-sky-500/30 flex items-center justify-center font-bold text-white shadow-inner"
                  style={{
                    backgroundColor: persona.appearance.outfitPrimary,
                    backgroundImage: `radial-gradient(circle at 35% 35%, ${persona.appearance.skinHighlight}, ${persona.appearance.skinTone})`,
                  }}
                >
                  <User className="w-6 h-6 text-white drop-shadow" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <span
                      className={`text-sm font-semibold truncate ${
                        darkMode ? "text-white" : "text-slate-900"
                      }`}
                    >
                      {persona.fullName}
                    </span>
                  </div>
                  <div
                    className={`text-xs mt-0.5 truncate ${
                      darkMode ? "text-sky-300" : "text-sky-700"
                    }`}
                  >
                    {persona.city} · {persona.gender === "female" ? "Female" : "Male"}
                  </div>
                  <div
                    className={`text-[11px] mt-1 line-clamp-1 ${
                      darkMode ? "text-slate-400" : "text-slate-500"
                    }`}
                  >
                    {persona.styleLabel}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* 02. Indian Language Experience Selector */}
      <section
        className={`p-5 rounded-2xl border transition-colors ${
          darkMode
            ? "bg-slate-900/90 border-slate-800"
            : "bg-white border-slate-200"
        }`}
      >
        <div className="flex items-center justify-between gap-2 mb-3">
          <div>
            <h2
              className={`text-base font-semibold flex items-center gap-2 ${
                darkMode ? "text-white" : "text-slate-900"
              }`}
            >
              <Globe className="w-4 h-4 text-sky-500" />
              <span>02. Indian Language Experience</span>
            </h2>
            <p
              className={`text-xs mt-0.5 ${
                darkMode ? "text-slate-400" : "text-slate-500"
              }`}
            >
              Switch languages anytime during a live conversation
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {INDIAN_LANGUAGES.map((lang) => {
            const active = lang.code === selectedLanguage;
            return (
              <button
                key={lang.code}
                type="button"
                onClick={() => onSelectLanguage(lang.code)}
                className={`px-3 py-2.5 rounded-xl border text-left transition-all min-h-[48px] flex flex-col justify-center ${
                  active
                    ? darkMode
                      ? "bg-sky-500 text-slate-950 border-sky-400 font-semibold"
                      : "bg-slate-900 text-white border-slate-900 font-semibold"
                    : darkMode
                    ? "bg-slate-950/60 text-slate-200 border-slate-800 hover:border-slate-700"
                    : "bg-slate-50 text-slate-800 border-slate-200 hover:border-slate-300"
                }`}
              >
                <span className="text-xs font-semibold truncate">
                  {lang.name}
                </span>
                <span
                  className={`text-[11px] truncate ${
                    active
                      ? darkMode
                        ? "text-slate-900"
                        : "text-sky-200"
                      : darkMode
                      ? "text-slate-400"
                      : "text-slate-500"
                  }`}
                >
                  {lang.nativeName}
                </span>
              </button>
            );
          })}
        </div>

        <div
          className={`mt-3 pt-3 border-t text-xs flex items-center justify-between gap-2 ${
            darkMode
              ? "border-slate-800 text-slate-400"
              : "border-slate-100 text-slate-600"
          }`}
        >
          <span>
            Active: <strong className={darkMode ? "text-slate-200" : "text-slate-900"}>{currentLangObj.name}</strong> · {currentLangObj.regionLabel}
          </span>
          <span className="font-mono tabular-nums text-[11px]">
            STT: {currentLangObj.speechRecognitionLang}
          </span>
        </div>
      </section>

      {/* 03. Voice & Conversational Formality */}
      <section
        className={`p-5 rounded-2xl border transition-colors ${
          darkMode
            ? "bg-slate-900/90 border-slate-800"
            : "bg-white border-slate-200"
        }`}
      >
        <div className="flex items-center justify-between gap-2 mb-3">
          <div>
            <h2
              className={`text-base font-semibold flex items-center gap-2 ${
                darkMode ? "text-white" : "text-slate-900"
              }`}
            >
              <Volume2 className="w-4 h-4 text-sky-500" />
              <span>03. Neural Voice & Tone</span>
            </h2>
            <p
              className={`text-xs mt-0.5 ${
                darkMode ? "text-slate-400" : "text-slate-500"
              }`}
            >
              Natural TTS output & adaptive formality
            </p>
          </div>

          <button
            type="button"
            onClick={onTestVoice}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap ${
              darkMode
                ? "border-sky-500/40 bg-sky-500/10 text-sky-300 hover:bg-sky-500/20"
                : "border-sky-600/30 bg-sky-50 text-sky-700 hover:bg-sky-100"
            }`}
          >
            Sample Greeting
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label
              htmlFor="voice-select"
              className={`block text-xs font-medium mb-1.5 ${
                darkMode ? "text-slate-300" : "text-slate-700"
              }`}
            >
              Voice Timbre
            </label>
            <select
              id="voice-select"
              value={selectedVoice}
              onChange={(e) =>
                onSelectVoice(e.target.value as VoiceOption["id"])
              }
              className={`w-full px-3 py-2.5 rounded-xl border text-xs font-medium focus:outline-none focus:ring-2 focus:ring-sky-500 ${
                darkMode
                  ? "bg-slate-950 border-slate-800 text-white"
                  : "bg-slate-50 border-slate-200 text-slate-900"
              }`}
            >
              {VOICE_OPTIONS.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label} — {v.timbre}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span
                className={`text-xs font-medium flex items-center gap-1.5 ${
                  darkMode ? "text-slate-300" : "text-slate-700"
                }`}
              >
                <Sliders className="w-3.5 h-3.5 text-sky-500" />
                Conversational Formality
              </span>
            </div>
            <div
              className={`grid grid-cols-3 gap-1 p-1 rounded-xl ${
                darkMode ? "bg-slate-950" : "bg-slate-100"
              }`}
            >
              {(
                [
                  { id: "casual", label: "Friendly Peer" },
                  { id: "balanced", label: "Adaptive" },
                  { id: "formal", label: "Respectful" },
                ] as const
              ).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onChangeFormality(item.id)}
                  className={`py-2 px-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                    formality === item.id
                      ? darkMode
                        ? "bg-sky-500 text-slate-950 font-semibold"
                        : "bg-white text-slate-900 shadow-sm font-semibold"
                      : darkMode
                      ? "text-slate-400 hover:text-white"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 04. Microphone & Audio Clarity Diagnostic (Settings & Troubleshooting) */}
      <section id="audio-diagnostic">
        <AudioDiagnosticTest
          darkMode={darkMode}
          selectedLanguage={selectedLanguage}
        />
      </section>
    </div>
  );
};
