import React, { useEffect, useRef, useState } from "react";
import { ConversationMessage, IndianLanguageCode } from "../types/agent";
import { QUICK_CONVERSATION_STARTERS } from "../data/indianAgentConfig";
import {
  Trash2,
  Volume2,
  ShieldCheck,
  MessageSquare,
  Send,
  Download,
  FileText,
  FileDown,
  ChevronDown,
  Check,
} from "lucide-react";
import {
  exportConversationAsPdf,
  exportConversationAsText,
} from "../utils/exportConversation";

interface ConversationHistoryPanelProps {
  messages: ConversationMessage[];
  onSendMessage: (text: string, overrideLang?: IndianLanguageCode) => void;
  onReplayMessage: (msg: ConversationMessage) => void;
  onClearHistory: () => void;
  saveConsent: boolean;
  onToggleSaveConsent: (consent: boolean) => void;
  textInput: string;
  onChangeTextInput: (val: string) => void;
  isProcessing: boolean;
  personaName: string;
  languageLabel?: string;
  darkMode: boolean;
}

export const ConversationHistoryPanel: React.FC<
  ConversationHistoryPanelProps
> = ({
  messages,
  onSendMessage,
  onReplayMessage,
  onClearHistory,
  saveConsent,
  onToggleSaveConsent,
  textInput,
  onChangeTextInput,
  isProcessing,
  personaName,
  languageLabel,
  darkMode,
}) => {
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [exportSuccess, setExportSuccess] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (
        exportMenuRef.current &&
        !exportMenuRef.current.contains(e.target as Node)
      ) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const handleExportPdf = async () => {
    if (messages.length === 0 || isExporting) return;
    setIsExporting(true);
    setShowExportMenu(false);
    try {
      await exportConversationAsPdf(messages, personaName, languageLabel);
      setExportSuccess("PDF Downloaded!");
      setTimeout(() => setExportSuccess(null), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportText = () => {
    if (messages.length === 0 || isExporting) return;
    setIsExporting(true);
    setShowExportMenu(false);
    try {
      exportConversationAsText(messages, personaName, languageLabel);
      setExportSuccess("Text File Downloaded!");
      setTimeout(() => setExportSuccess(null), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setIsExporting(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim() || isProcessing) return;
    onSendMessage(textInput.trim());
    onChangeTextInput("");
  };

  return (
    <section
      className={`flex flex-col h-full rounded-2xl border transition-colors ${
        darkMode
          ? "bg-slate-900/90 border-slate-800"
          : "bg-white border-slate-200"
      }`}
    >
      <div
        className={`flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b ${
          darkMode ? "border-slate-800" : "border-slate-100"
        }`}
      >
        <div>
          <h2
            className={`text-base font-semibold flex items-center gap-2 ${
              darkMode ? "text-white" : "text-slate-900"
            }`}
          >
            <MessageSquare className="w-4 h-4 text-sky-500" />
            <span>Live Conversation & Transcript</span>
          </h2>
          <p
            className={`text-xs mt-0.5 ${
              darkMode ? "text-slate-400" : "text-slate-500"
            }`}
          >
            Multi-turn context memory ·{" "}
            <span className="font-mono tabular-nums">{messages.length}</span>{" "}
            messages
          </p>
        </div>

        {messages.length > 0 && (
          <div className="flex items-center gap-2">
            {exportSuccess && (
              <span
                className={`text-[11px] font-medium flex items-center gap-1 animate-fade-in ${
                  darkMode ? "text-emerald-400" : "text-emerald-600"
                }`}
              >
                <Check className="w-3.5 h-3.5" />
                <span>{exportSuccess}</span>
              </span>
            )}

            {/* Export Dropdown Menu */}
            <div className="relative" ref={exportMenuRef}>
              <button
                type="button"
                onClick={() => setShowExportMenu(!showExportMenu)}
                disabled={isExporting}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                  darkMode
                    ? "text-sky-300 hover:bg-sky-950/60 border border-sky-800/60 bg-sky-950/20"
                    : "text-sky-700 hover:bg-sky-50 border border-sky-200 bg-sky-50/50"
                }`}
                title="Export conversation as PDF or formatted text file"
                aria-expanded={showExportMenu}
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export</span>
                <ChevronDown className="w-3 h-3 ml-0.5 opacity-70" />
              </button>

              {showExportMenu && (
                <div
                  className={`absolute right-0 mt-1.5 w-52 rounded-xl shadow-xl border py-1.5 z-30 transition-all ${
                    darkMode
                      ? "bg-slate-900 border-slate-700 text-slate-200 shadow-black/40"
                      : "bg-white border-slate-200 text-slate-800 shadow-slate-200/60"
                  }`}
                >
                  <button
                    type="button"
                    onClick={handleExportPdf}
                    className={`w-full px-3.5 py-2 text-left text-xs flex items-center gap-2.5 transition-colors ${
                      darkMode
                        ? "hover:bg-slate-800 text-slate-200"
                        : "hover:bg-slate-50 text-slate-700"
                    }`}
                  >
                    <FileText className="w-4 h-4 text-rose-500 shrink-0" />
                    <div>
                      <div className="font-medium">Export as PDF (.pdf)</div>
                      <div
                        className={`text-[10px] ${
                          darkMode ? "text-slate-400" : "text-slate-500"
                        }`}
                      >
                        Formatted document with bubbles
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={handleExportText}
                    className={`w-full px-3.5 py-2 text-left text-xs flex items-center gap-2.5 transition-colors ${
                      darkMode
                        ? "hover:bg-slate-800 text-slate-200"
                        : "hover:bg-slate-50 text-slate-700"
                    }`}
                  >
                    <FileDown className="w-4 h-4 text-emerald-500 shrink-0" />
                    <div>
                      <div className="font-medium">Export as Text (.txt)</div>
                      <div
                        className={`text-[10px] ${
                          darkMode ? "text-slate-400" : "text-slate-500"
                        }`}
                      >
                        Timestamped plaintext record
                      </div>
                    </div>
                  </button>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={onClearHistory}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                darkMode
                  ? "text-rose-400 hover:bg-rose-950/50 border border-rose-900/40"
                  : "text-rose-600 hover:bg-rose-50 border border-rose-200"
              }`}
              title="Delete conversation history immediately"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete History</span>
            </button>
          </div>
        )}
      </div>

      <div
        className={`px-5 py-3 border-b ${
          darkMode
            ? "border-slate-800/80 bg-slate-950/40"
            : "border-slate-100 bg-slate-50/70"
        }`}
      >
        <div
          className={`text-[11px] font-medium mb-2 ${
            darkMode ? "text-slate-400" : "text-slate-500"
          }`}
        >
          Try saying or tap a prompt:
        </div>
        <div className="flex flex-wrap gap-1.5">
          {QUICK_CONVERSATION_STARTERS.map((starter, idx) => (
            <button
              key={idx}
              type="button"
              disabled={isProcessing}
              onClick={() => onSendMessage(starter.text, starter.lang)}
              className={`px-2.5 py-1.5 rounded-lg text-xs border transition-colors text-left truncate max-w-full ${
                darkMode
                  ? "bg-slate-900 border-slate-800 text-slate-200 hover:border-sky-500/60 hover:text-sky-300"
                  : "bg-white border-slate-200 text-slate-700 hover:border-sky-600 hover:text-sky-700"
              }`}
            >
              “{starter.text}”
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-4 min-h-[280px] max-h-[420px]">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center py-8 px-4">
            <p
              className={`text-sm font-medium ${
                darkMode ? "text-slate-300" : "text-slate-700"
              }`}
            >
              No messages in this conversation yet
            </p>
            <p
              className={`text-xs mt-1 max-w-xs leading-relaxed ${
                darkMode ? "text-slate-400" : "text-slate-500"
              }`}
            >
              Start a live voice conversation with {personaName} or type a
              message below in English, Hindi, Hinglish, or any supported Indian
              language.
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isUser = msg.role === "user";
            return (
              <div
                key={msg.id}
                className={`flex flex-col ${
                  isUser ? "items-end" : "items-start"
                }`}
              >
                <div className="flex items-center gap-1.5 text-[11px] mb-1 px-1">
                  <span
                    className={`font-semibold ${
                      isUser
                        ? darkMode
                          ? "text-sky-400"
                          : "text-sky-700"
                        : darkMode
                        ? "text-slate-200"
                        : "text-slate-800"
                    }`}
                  >
                    {isUser ? "You" : personaName}
                  </span>
                  <span aria-hidden="true" className="text-slate-500">
                    ·
                  </span>
                  <span
                    className={`font-mono tabular-nums ${
                      darkMode ? "text-slate-500" : "text-slate-400"
                    }`}
                  >
                    {msg.timestamp}
                  </span>
                  {msg.emotion && !isUser && (
                    <>
                      <span aria-hidden="true" className="text-slate-500">
                        ·
                      </span>
                      <span
                        className={`capitalize ${
                          darkMode ? "text-sky-400/90" : "text-sky-700"
                        }`}
                      >
                        {msg.emotion}
                      </span>
                    </>
                  )}
                  {!isUser && (
                    <button
                      type="button"
                      onClick={() => onReplayMessage(msg)}
                      className={`ml-1 p-1 rounded hover:bg-sky-500/10 transition-colors ${
                        darkMode
                          ? "text-slate-400 hover:text-sky-300"
                          : "text-slate-500 hover:text-sky-700"
                      }`}
                      title="Replay spoken audio with lip-sync"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div
                  className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    isUser
                      ? "bg-sky-600 text-white rounded-br-sm"
                      : darkMode
                      ? "bg-slate-950 border border-slate-800 text-slate-100 rounded-bl-sm"
                      : "bg-slate-100 text-slate-900 rounded-bl-sm"
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            );
          })
        )}
      </div>

      <form
        onSubmit={handleFormSubmit}
        className={`p-4 border-t ${
          darkMode ? "border-slate-800" : "border-slate-100"
        }`}
      >
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={textInput}
            onChange={(e) => onChangeTextInput(e.target.value)}
            placeholder={`Type in Hinglish, Hindi, English, or any Indian language...`}
            className={`flex-1 px-4 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 ${
              darkMode
                ? "bg-slate-950 border-slate-800 text-white placeholder-slate-500"
                : "bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400"
            }`}
          />
          <button
            type="submit"
            disabled={!textInput.trim() || isProcessing}
            className="px-4 py-2.5 min-h-[44px] rounded-xl bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-slate-950 font-semibold text-xs flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
          >
            <Send className="w-4 h-4" />
            <span>Speak Reply</span>
          </button>
        </div>

        <div className="mt-3 flex items-center justify-between gap-2 text-[11px]">
          <label
            className={`flex items-center gap-2 cursor-pointer select-none ${
              darkMode ? "text-slate-400" : "text-slate-500"
            }`}
          >
            <input
              type="checkbox"
              checked={saveConsent}
              onChange={(e) => onToggleSaveConsent(e.target.checked)}
              className="rounded border-slate-400 text-sky-500 focus:ring-sky-500"
            />
            <span>
              Consent to save conversation history in this browser (no secret
              voice recording)
            </span>
          </label>
          <span
            className={`hidden sm:inline-flex items-center gap-1 ${
              darkMode ? "text-emerald-400" : "text-emerald-700"
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Private Session</span>
          </span>
        </div>
      </form>
    </section>
  );
};
