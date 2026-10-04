import React from "react";
import { AgentState } from "../types/agent";

interface AudioWaveformProps {
  bands: number[];
  state: AgentState;
  isMuted: boolean;
  darkMode: boolean;
}

export const AudioWaveform: React.FC<AudioWaveformProps> = ({
  bands,
  state,
  isMuted,
  darkMode,
}) => {
  return (
    <div
      className="flex items-center justify-center gap-1 h-10 px-4 select-none"
      aria-label={`Audio waveform — current state: ${state}`}
    >
      {bands.map((val, idx) => {
        const activeVal = isMuted && state === "listening" ? 0.05 : val;
        const heightPx = Math.max(4, Math.min(36, Math.round(4 + activeVal * 32)));

        let barColor = darkMode ? "bg-slate-700" : "bg-slate-300";
        if (state === "speaking") {
          barColor =
            idx % 2 === 0
              ? "bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.45)]"
              : "bg-sky-500";
        } else if (state === "listening" && !isMuted) {
          barColor =
            activeVal > 0.18
              ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.4)]"
              : darkMode
              ? "bg-sky-500/60"
              : "bg-sky-600/60";
        } else if (state === "thinking") {
          barColor = darkMode ? "bg-sky-400/70" : "bg-sky-600/70";
        }

        return (
          <div
            key={idx}
            className={`w-1 rounded-full transition-transform duration-75 ${barColor}`}
            style={{
              height: `${heightPx}px`,
              transform:
                state === "thinking"
                  ? `scaleY(${0.4 + 0.5 * Math.sin(Date.now() / 180 + idx * 0.45)})`
                  : "scaleY(1)",
            }}
          />
        );
      })}
    </div>
  );
};
