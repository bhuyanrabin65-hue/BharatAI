import { jsPDF } from "jspdf";
import { ConversationMessage } from "../types/agent";

/**
 * Clean up text for ASCII/Latin PDF rendering, preserving romanized Indian phrases (Hinglish/Tanglish/etc.)
 */
function sanitizeForPdf(text: string): string {
  // Replace smart quotes, em-dashes, and special non-printable symbols
  return text
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/[^\x00-\x7F]/g, (char) => {
      // For Devanagari or other non-Latin scripts in PDF standard fonts, provide transliteration or safe fallback
      return `[${char}]`;
    });
}

function getFormattedDate(): string {
  return new Date().toLocaleString("en-IN", {
    dateStyle: "full",
    timeStyle: "short",
  });
}

function getFileTimestamp(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hours = String(d.getHours()).padStart(2, "0");
  const mins = String(d.getMinutes()).padStart(2, "0");
  return `${year}${month}${day}_${hours}${mins}`;
}

/**
 * Export conversation transcript as a formatted .txt file
 */
export function exportConversationAsText(
  messages: ConversationMessage[],
  personaName: string,
  languageLabel?: string
): void {
  if (!messages || messages.length === 0) return;

  const separator = "=".repeat(80);
  const subSeparator = "-".repeat(80);
  const now = getFormattedDate();

  let content = `${separator}\n`;
  content += `BHARATAI — CONVERSATION TRANSCRIPT\n`;
  content += `Persona: ${personaName}\n`;
  if (languageLabel) {
    content += `Language: ${languageLabel}\n`;
  }
  content += `Date: ${now}\n`;
  content += `Total Messages: ${messages.length}\n`;
  content += `${separator}\n\n`;

  messages.forEach((msg, idx) => {
    const isUser = msg.role === "user";
    const speaker = isUser ? "YOU" : personaName.toUpperCase();
    const emotionTag = msg.emotion && !isUser ? ` [Emotion: ${msg.emotion}]` : "";
    const langTag = msg.language ? ` [Lang: ${msg.language}]` : "";

    content += `[#${idx + 1}] [${msg.timestamp}] ${speaker}${emotionTag}${langTag}\n`;
    content += `${msg.text}\n\n`;
    if (idx < messages.length - 1) {
      content += `${subSeparator}\n\n`;
    }
  });

  content += `${separator}\n`;
  content += `Exported from BharatAI — The Indian Talking AI Companion\n`;
  content += `Private Session Transcript · No audio recording stored on server\n`;
  content += `${separator}\n`;

  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `BharatAI_Transcript_${getFileTimestamp()}.txt`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

/**
 * Export conversation transcript as a beautifully styled PDF document
 */
export async function exportConversationAsPdf(
  messages: ConversationMessage[],
  personaName: string,
  languageLabel?: string
): Promise<void> {
  if (!messages || messages.length === 0) return;

  try {
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 16;
    const contentWidth = pageWidth - margin * 2;
    let y = 18;

    // Header Title
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(margin, y, contentWidth, 22, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("BharatAI — Conversation Transcript", margin + 6, y + 9);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(226, 232, 240); // slate-200
    const subtitle = `Persona: ${personaName} ${languageLabel ? `· Language: ${languageLabel}` : ""} · Messages: ${messages.length}`;
    doc.text(subtitle, margin + 6, y + 16);

    y += 28;

    // Metadata Bar
    doc.setDrawColor(226, 232, 240);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(margin, y, contentWidth, 12, 1.5, 1.5, "FD");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text(`Generated: ${getFormattedDate()}`, margin + 5, y + 7.5);
    doc.text("Confidential & Private", pageWidth - margin - 5, y + 7.5, { align: "right" });

    y += 18;

    // Messages List
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      const isUser = msg.role === "user";
      const speakerName = isUser ? "You" : personaName;
      const timeStr = msg.timestamp || "N/A";
      const emotionStr = msg.emotion && !isUser ? ` · Emotion: ${msg.emotion}` : "";

      const cleanText = sanitizeForPdf(msg.text);
      const textLines = doc.splitTextToSize(cleanText, contentWidth - 10);
      const lineHeight = 5;
      const boxHeight = textLines.length * lineHeight + 14;

      // Check for page break
      if (y + boxHeight > pageHeight - 20) {
        doc.addPage();
        y = 18;
      }

      // Bubble / Card background
      if (isUser) {
        doc.setFillColor(238, 246, 255); // light sky blue
        doc.setDrawColor(186, 230, 253);
      } else {
        doc.setFillColor(248, 250, 252); // light slate
        doc.setDrawColor(226, 232, 240);
      }

      doc.roundedRect(margin, y, contentWidth, boxHeight, 2, 2, "FD");

      // Speaker & Timestamp Header
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      if (isUser) {
        doc.setTextColor(2, 132, 199); // sky-600
      } else {
        doc.setTextColor(30, 41, 59); // slate-800
      }
      doc.text(`${speakerName}${emotionStr}`, margin + 5, y + 6);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184); // slate-400
      doc.text(timeStr, pageWidth - margin - 5, y + 6, { align: "right" });

      // Message text
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(15, 23, 42); // slate-900

      let textY = y + 12;
      for (const line of textLines) {
        doc.text(line, margin + 5, textY);
        textY += lineHeight;
      }

      y += boxHeight + 4;
    }

    // Page Numbering Footer
    const totalPages = (doc.internal as any).getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(
        `BharatAI Conversation Record · Page ${p} of ${totalPages}`,
        pageWidth / 2,
        pageHeight - 8,
        { align: "center" }
      );
    }

    doc.save(`BharatAI_Transcript_${getFileTimestamp()}.pdf`);
  } catch (err) {
    console.error("Failed to generate PDF, falling back to text file:", err);
    exportConversationAsText(messages, personaName, languageLabel);
  }
}
