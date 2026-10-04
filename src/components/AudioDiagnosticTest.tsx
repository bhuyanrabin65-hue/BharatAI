import React, { useState, useRef, useEffect } from "react";
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Play,
  Square,
  RefreshCw,
  Volume2,
  Radio,
  Sliders,
  HelpCircle,
  Sparkles,
  Mic,
  ShieldAlert,
} from "lucide-react";
import {
  AudioDiagnosticResult,
  runAudioDiagnosticTest,
} from "../utils/audioDiagnostic";

interface AudioDiagnosticTestProps {
  darkMode: boolean;
  selectedLanguage?: string;
  onTestComplete?: (result: AudioDiagnosticResult) => void;
}

export const AudioDiagnosticTest: React.FC<AudioDiagnosticTestProps> = ({
  darkMode,
  selectedLanguage = "en-IN",
  onTestComplete,
}) => {
  const [status, setStatus] = useState<
    "idle" | "countdown" | "recording" | "analyzing" | "completed" | "error"
  >("idle");
  const [secondsRemaining, setSecondsRemaining] = useState<number>(3.0);
  const [liveVolume, setLiveVolume] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState<AudioDiagnosticResult | null>(null);
  const [isPlayingBack, setIsPlayingBack] = useState<boolean>(false);
  const [showDetailedMetrics, setShowDetailedMetrics] = useState<boolean>(false);

  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  // Stop playback on unmount or reset
  useEffect(() => {
    return () => {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
        audioPlayerRef.current = null;
      }
    };
  }, []);

  const handleStartDiagnostic = async () => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      setIsPlayingBack(false);
    }

    setErrorMessage(null);
    setStatus("recording");
    setSecondsRemaining(3.0);
    setLiveVolume(0);

    try {
      const diagnosticResult = await runAudioDiagnosticTest(
        (secRemaining, currentLevel) => {
          setSecondsRemaining(secRemaining);
          setLiveVolume(currentLevel);
        },
        selectedLanguage
      );

      setStatus("analyzing");
      // Brief pause for visual smoothness
      setTimeout(() => {
        setResult(diagnosticResult);
        setStatus("completed");
        if (onTestComplete) {
          onTestComplete(diagnosticResult);
        }
      }, 400);
    } catch (err: any) {
      setStatus("error");
      setErrorMessage(
        err?.message || "An unexpected error occurred during audio diagnostic."
      );
    }
  };

  const handleTogglePlayback = () => {
    if (!result?.audioUrl) return;

    if (isPlayingBack) {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
        audioPlayerRef.current.currentTime = 0;
      }
      setIsPlayingBack(false);
    } else {
      if (!audioPlayerRef.current) {
        audioPlayerRef.current = new Audio(result.audioUrl);
        audioPlayerRef.current.onended = () => setIsPlayingBack(false);
      } else {
        audioPlayerRef.current.currentTime = 0;
      }

      audioPlayerRef.current
        .play()
        .then(() => setIsPlayingBack(true))
        .catch(() => setIsPlayingBack(false));
    }
  };

  // Helper colors based on confidence score
  const getScoreColor = (score: number) => {
    if (score >= 80) {
      return {
        badge: darkMode
          ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
          : "bg-emerald-50 border-emerald-300 text-emerald-800",
        ring: "text-emerald-500",
        bar: "bg-emerald-500",
        pill: darkMode ? "bg-emerald-950 text-emerald-300" : "bg-emerald-100 text-emerald-800",
        label: "Excellent Clarity",
      };
    }
    if (score >= 60) {
      return {
        badge: darkMode
          ? "bg-sky-500/15 border-sky-500/40 text-sky-300"
          : "bg-sky-50 border-sky-300 text-sky-800",
        ring: "text-sky-500",
        bar: "bg-sky-500",
        pill: darkMode ? "bg-sky-950 text-sky-300" : "bg-sky-100 text-sky-800",
        label: "Good Clarity",
      };
    }
    if (score >= 40) {
      return {
        badge: darkMode
          ? "bg-amber-500/15 border-amber-500/40 text-amber-300"
          : "bg-amber-50 border-amber-300 text-amber-800",
        ring: "text-amber-500",
        bar: "bg-amber-500",
        pill: darkMode ? "bg-amber-950 text-amber-300" : "bg-amber-100 text-amber-800",
        label: "Fair Clarity",
      };
    }
    return {
      badge: darkMode
        ? "bg-rose-500/15 border-rose-500/40 text-rose-300"
        : "bg-rose-50 border-rose-300 text-rose-800",
      ring: "text-rose-500",
      bar: "bg-rose-500",
      pill: darkMode ? "bg-rose-950 text-rose-300" : "bg-rose-100 text-rose-800",
      label: "Low Clarity / Silent",
    };
  };

  const scoreTheme = result ? getScoreColor(result.confidenceScore) : null;

  return (
    <div
      className={`rounded-2xl border p-5 transition-all ${
        darkMode
          ? "bg-slate-900/90 border-slate-800"
          : "bg-white border-slate-200"
      }`}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <div
              className={`p-1.5 rounded-lg ${
                darkMode ? "bg-sky-500/10 text-sky-400" : "bg-sky-100 text-sky-700"
              }`}
            >
              <Activity className="w-4 h-4" />
            </div>
            <h3
              className={`text-base font-semibold ${
                darkMode ? "text-white" : "text-slate-900"
              }`}
            >
              Audio Input Diagnostic
            </h3>
            <span
              className={`text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full border ${
                darkMode
                  ? "bg-sky-500/10 border-sky-500/30 text-sky-300"
                  : "bg-sky-50 border-sky-200 text-sky-700"
              }`}
            >
              3-Second Test
            </span>
          </div>
          <p
            className={`text-xs mt-1 ${
              darkMode ? "text-slate-400" : "text-slate-500"
            }`}
          >
            Records for 3 seconds to measure input volume, clarity confidence, background noise, and speech detection.
          </p>
        </div>

        {/* Action Button */}
        {status !== "recording" && status !== "analyzing" && (
          <button
            type="button"
            onClick={handleStartDiagnostic}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-2 whitespace-nowrap shadow-sm active:scale-[0.98] ${
              result
                ? darkMode
                  ? "bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700"
                  : "bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300"
                : "bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold shadow-sky-500/20 shadow-md"
            }`}
          >
            {result ? (
              <>
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Run Test Again</span>
              </>
            ) : (
              <>
                <Mic className="w-3.5 h-3.5" />
                <span>Run 3s Audio Diagnostic</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* State 1: Active 3-Second Recording */}
      {status === "recording" && (
        <div
          className={`p-4 rounded-xl border mb-2 transition-all ${
            darkMode
              ? "bg-slate-950/80 border-sky-500/40"
              : "bg-sky-50/70 border-sky-300"
          }`}
        >
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2.5">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500" />
              </span>
              <span
                className={`text-xs font-semibold ${
                  darkMode ? "text-rose-300" : "text-rose-700"
                }`}
              >
                Recording Audio Test... Please speak normally
              </span>
            </div>

            <div
              className={`font-mono font-bold text-sm px-2.5 py-0.5 rounded-lg tabular-nums ${
                darkMode
                  ? "bg-slate-900 text-sky-400 border border-slate-800"
                  : "bg-white text-sky-700 border border-slate-200"
              }`}
            >
              {secondsRemaining.toFixed(1)}s remaining
            </div>
          </div>

          <p
            className={`text-xs mb-3 italic ${
              darkMode ? "text-slate-300" : "text-slate-600"
            }`}
          >
            Try saying: &ldquo;Namaste, testing my microphone 1, 2, 3&rdquo;
          </p>

          {/* Progress Bar for 3 seconds */}
          <div
            className={`w-full h-2 rounded-full overflow-hidden mb-3 ${
              darkMode ? "bg-slate-800" : "bg-slate-200"
            }`}
          >
            <div
              className="h-full bg-sky-500 transition-all duration-75 ease-linear"
              style={{
                width: `${Math.max(
                  0,
                  Math.min(100, ((3.0 - secondsRemaining) / 3.0) * 100)
                )}%`,
              }}
            />
          </div>

          {/* Live Sound Level Meter */}
          <div>
            <div className="flex items-center justify-between text-[11px] mb-1 font-mono">
              <span
                className={darkMode ? "text-slate-400" : "text-slate-500"}
              >
                Live Input Level
              </span>
              <span
                className={
                  liveVolume > 0.85
                    ? "text-rose-400 font-bold"
                    : liveVolume > 0.2
                    ? "text-emerald-400 font-semibold"
                    : darkMode
                    ? "text-slate-400"
                    : "text-slate-500"
                }
              >
                {Math.round(liveVolume * 100)}%{" "}
                {liveVolume > 0.85 ? "(Peak/Clips)" : liveVolume > 0.2 ? "(Good)" : "(Low)"}
              </span>
            </div>
            <div
              className={`w-full h-3 rounded-lg overflow-hidden flex items-center p-0.5 gap-1 ${
                darkMode ? "bg-slate-900 border border-slate-800" : "bg-slate-100 border border-slate-200"
              }`}
            >
              {Array.from({ length: 24 }).map((_, idx) => {
                const threshold = idx / 24;
                const active = liveVolume >= threshold;
                const isHigh = idx >= 20;
                const isMid = idx >= 14;

                return (
                  <div
                    key={idx}
                    className={`flex-1 h-full rounded-sm transition-all duration-75 ${
                      !active
                        ? darkMode
                          ? "bg-slate-850 opacity-20"
                          : "bg-slate-300 opacity-30"
                        : isHigh
                        ? "bg-rose-500"
                        : isMid
                        ? "bg-amber-400"
                        : "bg-emerald-400"
                    }`}
                  />
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* State 2: Analyzing */}
      {status === "analyzing" && (
        <div
          className={`p-6 rounded-xl border text-center flex flex-col items-center justify-center gap-3 ${
            darkMode
              ? "bg-slate-950/60 border-slate-800"
              : "bg-slate-50 border-slate-200"
          }`}
        >
          <RefreshCw className="w-6 h-6 text-sky-400 animate-spin" />
          <div>
            <div
              className={`text-sm font-semibold ${
                darkMode ? "text-white" : "text-slate-900"
              }`}
            >
              Analyzing Acoustic Clarity & Confidence...
            </div>
            <p
              className={`text-xs mt-0.5 ${
                darkMode ? "text-slate-400" : "text-slate-500"
              }`}
            >
              Computing signal-to-noise ratio, volume dynamics, and vocal intelligibility
            </p>
          </div>
        </div>
      )}

      {/* State 3: Error */}
      {status === "error" && errorMessage && (
        <div
          className={`p-4 rounded-xl border mb-3 flex items-start gap-3 ${
            darkMode
              ? "bg-rose-950/30 border-rose-800/60 text-rose-200"
              : "bg-rose-50 border-rose-300 text-rose-900"
          }`}
        >
          <ShieldAlert className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="text-xs font-bold uppercase tracking-wider mb-1">
              Microphone Diagnostic Failed
            </h4>
            <p className="text-xs leading-relaxed">{errorMessage}</p>
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={handleStartDiagnostic}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white transition-colors"
              >
                Retry Test
              </button>
            </div>
          </div>
        </div>
      )}

      {/* State 4: Completed Result Display */}
      {status === "completed" && result && scoreTheme && (
        <div className="space-y-4">
          {/* Main Confidence Score Banner */}
          <div
            className={`p-4 rounded-xl border transition-all ${
              darkMode
                ? "bg-slate-950/80 border-slate-800"
                : "bg-slate-50 border-slate-200"
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                {/* Confidence Score Pill / Badge */}
                <div
                  className={`w-16 h-16 rounded-2xl flex flex-col items-center justify-center shrink-0 border ${scoreTheme.badge} shadow-sm`}
                >
                  <span className="text-xl font-black tabular-nums tracking-tight">
                    {result.confidenceScore}%
                  </span>
                  <span className="text-[9px] font-semibold uppercase tracking-wider">
                    Score
                  </span>
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded-md ${scoreTheme.pill}`}
                    >
                      {scoreTheme.label}
                    </span>
                    <span
                      className={`text-[11px] ${
                        darkMode ? "text-slate-400" : "text-slate-500"
                      }`}
                    >
                      Tested at {result.analyzedAt}
                    </span>
                  </div>
                  <h4
                    className={`text-sm font-semibold mt-1 ${
                      darkMode ? "text-white" : "text-slate-900"
                    }`}
                  >
                    {result.statusSummary}
                  </h4>
                </div>
              </div>

              {/* Playback Controls */}
              {result.audioUrl && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleTogglePlayback}
                    className={`px-3 py-2 rounded-xl text-xs font-medium border transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                      isPlayingBack
                        ? "bg-rose-600 border-rose-500 text-white"
                        : darkMode
                        ? "bg-slate-900 border-slate-700 text-slate-200 hover:border-slate-600"
                        : "bg-white border-slate-300 text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    {isPlayingBack ? (
                      <>
                        <Square className="w-3.5 h-3.5 fill-current" />
                        <span>Stop Playback</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>Hear 3s Sample</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* Score Bar Meter */}
            <div className="mt-4">
              <div className="flex items-center justify-between text-[11px] mb-1">
                <span className={darkMode ? "text-slate-400" : "text-slate-500"}>
                  Audio Clarity Confidence
                </span>
                <span className="font-bold tabular-nums">
                  {result.confidenceScore} / 100
                </span>
              </div>
              <div
                className={`w-full h-2 rounded-full overflow-hidden ${
                  darkMode ? "bg-slate-800" : "bg-slate-200"
                }`}
              >
                <div
                  className={`h-full rounded-full transition-all duration-500 ${scoreTheme.bar}`}
                  style={{ width: `${result.confidenceScore}%` }}
                />
              </div>
            </div>
          </div>

          {/* Transcribed Speech Result (if available) */}
          {result.transcript && (
            <div
              className={`p-3 rounded-xl border flex items-start gap-2.5 ${
                darkMode
                  ? "bg-sky-950/20 border-sky-800/40 text-sky-200"
                  : "bg-sky-50/70 border-sky-200 text-sky-900"
              }`}
            >
              <Sparkles className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
              <div className="text-xs">
                <span className="font-semibold block text-[11px] uppercase tracking-wider text-sky-400 mb-0.5">
                  Detected Speech Content
                </span>
                <span className="italic font-medium">&ldquo;{result.transcript}&rdquo;</span>
              </div>
            </div>
          )}

          {/* Detected Issues & Actionable Troubleshooting Tips */}
          <div
            className={`p-4 rounded-xl border ${
              result.detectedIssues.length > 0 && result.confidenceScore < 70
                ? darkMode
                  ? "bg-amber-950/20 border-amber-800/40"
                  : "bg-amber-50/60 border-amber-200"
                : darkMode
                ? "bg-slate-950/40 border-slate-800"
                : "bg-slate-50/60 border-slate-200"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span
                className={`text-xs font-semibold flex items-center gap-1.5 ${
                  result.detectedIssues.length > 0 && result.confidenceScore < 70
                    ? darkMode
                      ? "text-amber-300"
                      : "text-amber-900"
                    : darkMode
                    ? "text-slate-200"
                    : "text-slate-800"
                }`}
              >
                {result.detectedIssues.length > 0 && result.confidenceScore < 70 ? (
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                )}
                Troubleshooting & Input Recommendations
              </span>

              <button
                type="button"
                onClick={() => setShowDetailedMetrics(!showDetailedMetrics)}
                className={`text-[11px] underline transition-colors ${
                  darkMode ? "text-slate-400 hover:text-white" : "text-slate-500 hover:text-slate-900"
                }`}
              >
                {showDetailedMetrics ? "Hide Technical Metrics" : "View Technical Metrics"}
              </button>
            </div>

            {/* List of Detected Issues if any */}
            {result.detectedIssues.length > 0 && (
              <div className="mb-2.5 flex flex-wrap gap-1.5">
                {result.detectedIssues.map((issue, idx) => (
                  <span
                    key={idx}
                    className={`text-[11px] font-medium px-2 py-0.5 rounded-md border flex items-center gap-1 ${
                      darkMode
                        ? "bg-rose-500/10 border-rose-500/30 text-rose-300"
                        : "bg-rose-50 border-rose-200 text-rose-800"
                    }`}
                  >
                    <XCircle className="w-3 h-3 text-rose-400" />
                    {issue}
                  </span>
                ))}
              </div>
            )}

            {/* Troubleshooting Advice Points */}
            <ul className="space-y-1.5 text-xs">
              {result.troubleshootingTips.map((tip, idx) => (
                <li
                  key={idx}
                  className={`flex items-start gap-2 ${
                    darkMode ? "text-slate-300" : "text-slate-700"
                  }`}
                >
                  <span className="text-sky-500 font-bold shrink-0 mt-0.5">•</span>
                  <span>{tip}</span>
                </li>
              ))}
            </ul>

            {/* Detailed Acoustic Metrics Breakdown (Collapsible) */}
            {showDetailedMetrics && (
              <div
                className={`mt-4 pt-3 border-t grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono ${
                  darkMode ? "border-slate-800 text-slate-300" : "border-slate-200 text-slate-700"
                }`}
              >
                <div
                  className={`p-2 rounded-lg border ${
                    darkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
                  }`}
                >
                  <div className="text-[10px] text-slate-500 uppercase">SNR Ratio</div>
                  <div className="font-bold text-sm">+{result.metrics.snrDb} dB</div>
                  <div className="text-[10px] text-slate-400">
                    {result.metrics.snrDb >= 15 ? "Crisp" : "Noisy"}
                  </div>
                </div>

                <div
                  className={`p-2 rounded-lg border ${
                    darkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
                  }`}
                >
                  <div className="text-[10px] text-slate-500 uppercase">Peak Level</div>
                  <div className="font-bold text-sm">
                    {Math.round(result.metrics.peakVolume * 100)}%
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {result.metrics.peakVolume > 0.95
                      ? "Clipping"
                      : result.metrics.peakVolume > 0.1
                      ? "Healthy"
                      : "Too Quiet"}
                  </div>
                </div>

                <div
                  className={`p-2 rounded-lg border ${
                    darkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
                  }`}
                >
                  <div className="text-[10px] text-slate-500 uppercase">Noise Floor</div>
                  <div className="font-bold text-sm">
                    {Math.round(result.metrics.noiseFloor * 100)}%
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {result.metrics.noiseFloor < 0.05 ? "Quiet room" : "Ambient hum"}
                  </div>
                </div>

                <div
                  className={`p-2 rounded-lg border ${
                    darkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
                  }`}
                >
                  <div className="text-[10px] text-slate-500 uppercase">Voice Activity</div>
                  <div className="font-bold text-sm">
                    {Math.round(result.metrics.speechActivityRatio * 100)}%
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {result.speechDetected ? "Speech detected" : "No speech"}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
