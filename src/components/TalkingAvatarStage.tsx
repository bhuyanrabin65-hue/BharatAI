import React, { useEffect, useRef } from "react";
import {
  AgentState,
  AudioVisemeFrame,
  AvatarEmotion,
  AvatarPersona,
} from "../types/agent";
import { Sparkles, UserCheck, Volume2, Mic, Loader2, Radio } from "lucide-react";

interface TalkingAvatarStageProps {
  persona: AvatarPersona;
  agentState: AgentState;
  emotion: AvatarEmotion;
  visemeRef: React.MutableRefObject<AudioVisemeFrame>;
  liveCaption: string;
  userInterimTranscript: string;
  darkMode: boolean;
  onInterrupt: () => void;
  isUserSpeaking?: boolean;
  onDoneSpeaking?: () => void;
}

export const TalkingAvatarStage: React.FC<TalkingAvatarStageProps> = ({
  persona,
  agentState,
  emotion,
  visemeRef,
  liveCaption,
  userInterimTranscript,
  darkMode,
  onInterrupt,
  isUserSpeaking = false,
  onDoneSpeaking,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const stateRef = useRef(agentState);
  const emotionRef = useRef(emotion);
  const personaRef = useRef(persona);

  useEffect(() => {
    stateRef.current = agentState;
  }, [agentState]);

  useEffect(() => {
    emotionRef.current = emotion;
  }, [emotion]);

  useEffect(() => {
    personaRef.current = persona;
  }, [persona]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let lastBlinkTime = performance.now();
    let nextBlinkInterval = 2800 + Math.random() * 2200;
    let blinkProgress = 0;
    let isBlinking = false;

    let smoothJaw = 0;
    let smoothWidth = 0.5;
    let smoothRound = 0;
    let smoothVolume = 0;
    let headTiltX = 0;
    let headTiltY = 0;
    let headNod = 0;
    let eyeGazeX = 0;
    let eyeGazeY = 0;
    let targetGazeX = 0;
    let targetGazeY = 0;
    let lastSaccadeTime = performance.now();

    const renderLoop = (now: number) => {
      const width = canvas.width;
      const height = canvas.height;
      const cx = width / 2;
      const cy = height / 2;

      const currentState = stateRef.current;
      const currentEmotion = emotionRef.current;
      const currentPersona = personaRef.current;
      const currentViseme = visemeRef.current;

      // 1. Natural Blinking (150ms blink curve)
      if (!isBlinking && now - lastBlinkTime > nextBlinkInterval) {
        isBlinking = true;
        lastBlinkTime = now;
        nextBlinkInterval = 2400 + Math.random() * 2800;
      }
      if (isBlinking) {
        const elapsed = now - lastBlinkTime;
        const blinkDuration = 150;
        if (elapsed < blinkDuration) {
          blinkProgress = Math.sin((elapsed / blinkDuration) * Math.PI);
        } else {
          blinkProgress = 0;
          isBlinking = false;
        }
      }

      // 2. Eye Gaze Tracking & Saccades
      if (now - lastSaccadeTime > 1600 + Math.random() * 1800) {
        lastSaccadeTime = now;
        if (currentState === "thinking") {
          targetGazeX = (Math.random() - 0.5) * 6;
          targetGazeY = -5 - Math.random() * 3;
        } else if (currentState === "listening") {
          targetGazeX = (Math.random() - 0.5) * 2.5;
          targetGazeY = (Math.random() - 0.5) * 2;
        } else {
          targetGazeX = (Math.random() - 0.5) * 4.5;
          targetGazeY = (Math.random() - 0.5) * 3;
        }
      }
      eyeGazeX += (targetGazeX - eyeGazeX) * 0.12;
      eyeGazeY += (targetGazeY - eyeGazeY) * 0.12;

      // 3. Audio Visemes Interpolation for Real-time Lip-Sync
      const targetJaw =
        currentState === "speaking" ? currentViseme.jawOpen : 0;
      const targetWidth =
        currentState === "speaking" ? currentViseme.lipWidth : 0.52;
      const targetRound =
        currentState === "speaking" ? currentViseme.lipRound : 0;
      const targetVol = currentViseme.volume;

      smoothJaw += (targetJaw - smoothJaw) * 0.38;
      smoothWidth += (targetWidth - smoothWidth) * 0.3;
      smoothRound += (targetRound - smoothRound) * 0.3;
      smoothVolume += (targetVol - smoothVolume) * 0.28;

      // 4. Natural Head Movements, Breathing & Nodding
      const breathCycle = Math.sin(now * 0.0022);
      const targetTiltX =
        currentState === "speaking"
          ? Math.sin(now * 0.0031) * 4.5 + Math.cos(now * 0.0017) * 3
          : currentState === "thinking"
          ? 6
          : Math.sin(now * 0.0012) * 2;
      const targetTiltY =
        currentState === "listening"
          ? Math.sin(now * 0.0055) * 3.5
          : currentState === "speaking"
          ? Math.sin(now * 0.0042) * 3 + smoothJaw * 4
          : breathCycle * 1.8;

      headTiltX += (targetTiltX - headTiltX) * 0.08;
      headTiltY += (targetTiltY - headTiltY) * 0.08;
      headNod = Math.sin(now * 0.0038) * (currentState === "speaking" ? 0.022 : 0.008);

      ctx.clearRect(0, 0, width, height);

      // Studio Backdrop Gradient
      const bgGrad = ctx.createRadialGradient(
        cx,
        cy * 0.85,
        30,
        cx,
        cy,
        width * 0.72
      );
      bgGrad.addColorStop(0, "#0E2A47");
      bgGrad.addColorStop(0.55, "#0B192E");
      bgGrad.addColorStop(1, "#07101E");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // Dynamic Studio Rim Light Halo
      const haloRadius =
        155 + (currentState === "speaking" ? smoothVolume * 35 : breathCycle * 6);
      const haloGrad = ctx.createRadialGradient(
        cx,
        cy - 15,
        20,
        cx,
        cy - 15,
        haloRadius
      );
      if (currentState === "speaking") {
        haloGrad.addColorStop(0, "rgba(56, 189, 248, 0.28)");
        haloGrad.addColorStop(0.6, "rgba(2, 132, 199, 0.10)");
        haloGrad.addColorStop(1, "rgba(2, 132, 199, 0)");
      } else if (currentState === "listening") {
        haloGrad.addColorStop(0, "rgba(52, 211, 153, 0.22)");
        haloGrad.addColorStop(0.6, "rgba(16, 185, 129, 0.08)");
        haloGrad.addColorStop(1, "rgba(16, 185, 129, 0)");
      } else {
        haloGrad.addColorStop(0, "rgba(56, 189, 248, 0.16)");
        haloGrad.addColorStop(1, "rgba(15, 23, 42, 0)");
      }
      ctx.fillStyle = haloGrad;
      ctx.beginPath();
      ctx.arc(cx, cy - 15, haloRadius, 0, Math.PI * 2);
      ctx.fill();

      const app = currentPersona.appearance;
      const isFemale = currentPersona.gender === "female";

      // Torso & Shoulders Group
      ctx.save();
      const breathOffset = breathCycle * 2.8;
      ctx.translate(cx, cy + 125 + breathOffset);

      if (isFemale) {
        ctx.fillStyle = app.hairColor;
        ctx.beginPath();
        ctx.ellipse(0, -105, 86, 98, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      // Neck with 3D Studio Shading
      const neckGrad = ctx.createLinearGradient(-28, -95, 28, -30);
      neckGrad.addColorStop(0, app.skinShadow);
      neckGrad.addColorStop(0.45, app.skinTone);
      neckGrad.addColorStop(1, app.skinShadow);
      ctx.fillStyle = neckGrad;
      ctx.beginPath();
      ctx.roundRect(-27, -92, 54, 72, 18);
      ctx.fill();

      // Chin Shadow onto neck
      ctx.fillStyle = "rgba(0, 0, 0, 0.22)";
      ctx.beginPath();
      ctx.ellipse(0, -76 + smoothJaw * 6, 28, 16, 0, 0, Math.PI * 2);
      ctx.fill();

      // Shoulders & Outfit
      const shoulderWidth = isFemale ? 148 : 168;
      const outfitGrad = ctx.createLinearGradient(
        -shoulderWidth,
        -40,
        shoulderWidth,
        90
      );
      outfitGrad.addColorStop(0, app.outfitPrimary);
      outfitGrad.addColorStop(0.5, app.outfitSecondary);
      outfitGrad.addColorStop(1, app.outfitPrimary);
      ctx.fillStyle = outfitGrad;

      ctx.beginPath();
      ctx.moveTo(-shoulderWidth, 95);
      ctx.quadraticCurveTo(-shoulderWidth * 0.92, -32, -34, -42);
      ctx.lineTo(34, -42);
      ctx.quadraticCurveTo(shoulderWidth * 0.92, -32, shoulderWidth, 95);
      ctx.closePath();
      ctx.fill();

      // Collar Details
      if (app.collarStyle === "kurta") {
        ctx.fillStyle = app.skinTone;
        ctx.beginPath();
        ctx.moveTo(-26, -42);
        ctx.quadraticCurveTo(0, -8, 26, -42);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = app.outfitAccent;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(-29, -41);
        ctx.lineTo(0, -6);
        ctx.lineTo(29, -41);
        ctx.stroke();

        ctx.strokeStyle = "#FDE68A";
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(0, -40, 24, 0.22 * Math.PI, 0.78 * Math.PI);
        ctx.stroke();
      } else if (app.collarStyle === "blazer" || app.collarStyle === "corporate") {
        ctx.fillStyle = app.outfitSecondary;
        ctx.beginPath();
        ctx.moveTo(-30, -42);
        ctx.lineTo(0, 38);
        ctx.lineTo(30, -42);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = app.outfitAccent;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-36, -42);
        ctx.lineTo(0, 40);
        ctx.lineTo(36, -42);
        ctx.stroke();
      } else if (app.collarStyle === "bandhgala") {
        ctx.strokeStyle = app.outfitAccent;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.roundRect(-34, -48, 68, 18, 6);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(0, -30);
        ctx.lineTo(0, 80);
        ctx.stroke();

        [-10, 12, 34].forEach((by) => {
          ctx.fillStyle = "#38BDF8";
          ctx.beginPath();
          ctx.arc(0, by, 3.2, 0, Math.PI * 2);
          ctx.fill();
        });
      }

      ctx.restore();

      // Head Group
      ctx.save();
      ctx.translate(cx + headTiltX, cy - 22 + headTiltY + breathCycle * 1.6);
      ctx.rotate(headNod);

      const headWidth = isFemale ? 72 : 76;
      const headHeight = isFemale ? 90 : 94;
      const jawExtension = smoothJaw * 11;

      // Ears
      [-headWidth + 2, headWidth - 2].forEach((ex, i) => {
        ctx.fillStyle = app.skinShadow;
        ctx.beginPath();
        ctx.ellipse(ex, 4, 12, 23, i === 0 ? -0.12 : 0.12, 0, Math.PI * 2);
        ctx.fill();

        if (isFemale) {
          ctx.fillStyle = "#38BDF8";
          ctx.beginPath();
          ctx.arc(ex + (i === 0 ? -3 : 3), 22, 3.8, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      // Head Base with 3D Studio Lighting Gradient
      const faceGrad = ctx.createRadialGradient(
        -16,
        -24,
        12,
        0,
        8,
        headHeight * 1.15
      );
      faceGrad.addColorStop(0, app.skinHighlight);
      faceGrad.addColorStop(0.55, app.skinTone);
      faceGrad.addColorStop(1, app.skinShadow);

      ctx.fillStyle = faceGrad;
      ctx.beginPath();
      ctx.moveTo(-headWidth, -18);
      ctx.bezierCurveTo(
        -headWidth,
        -headHeight * 1.05,
        headWidth,
        -headHeight * 1.05,
        headWidth,
        -18
      );
      ctx.bezierCurveTo(
        headWidth * 0.96,
        44 + jawExtension * 0.5,
        32,
        headHeight + jawExtension,
        0,
        headHeight + jawExtension
      );
      ctx.bezierCurveTo(
        -32,
        headHeight + jawExtension,
        -headWidth * 0.96,
        44 + jawExtension * 0.5,
        -headWidth,
        -18
      );
      ctx.closePath();
      ctx.fill();

      // Rim Light
      ctx.strokeStyle = "rgba(56, 189, 248, 0.35)";
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.arc(0, -4, headWidth - 1, -0.35 * Math.PI, 0.25 * Math.PI);
      ctx.stroke();

      if (app.hasBeard) {
        ctx.save();
        ctx.fillStyle = "rgba(22, 22, 28, 0.22)";
        ctx.beginPath();
        ctx.moveTo(-headWidth * 0.88, 12);
        ctx.quadraticCurveTo(0, 34 + jawExtension * 0.3, headWidth * 0.88, 12);
        ctx.bezierCurveTo(
          headWidth * 0.82,
          56 + jawExtension * 0.6,
          28,
          headHeight + jawExtension - 2,
          0,
          headHeight + jawExtension - 2
        );
        ctx.bezierCurveTo(
          -28,
          headHeight + jawExtension - 2,
          -headWidth * 0.82,
          56 + jawExtension * 0.6,
          -headWidth * 0.88,
          12
        );
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      // Hair
      ctx.fillStyle = app.hairColor;
      ctx.beginPath();
      if (isFemale) {
        ctx.moveTo(-headWidth - 4, -8);
        ctx.bezierCurveTo(
          -headWidth - 8,
          -headHeight * 1.18,
          headWidth + 8,
          -headHeight * 1.18,
          headWidth + 4,
          -8
        );
        ctx.quadraticCurveTo(headWidth * 0.65, -56, -8, -68);
        ctx.quadraticCurveTo(-headWidth * 0.7, -52, -headWidth - 4, -8);
      } else {
        ctx.moveTo(-headWidth - 2, -12);
        ctx.bezierCurveTo(
          -headWidth - 6,
          -headHeight * 1.16,
          headWidth + 6,
          -headHeight * 1.2,
          headWidth + 2,
          -12
        );
        ctx.quadraticCurveTo(headWidth * 0.72, -58, 0, -64);
        ctx.quadraticCurveTo(-headWidth * 0.72, -58, -headWidth - 2, -12);
      }
      ctx.closePath();
      ctx.fill();

      if (app.hasBindi) {
        ctx.fillStyle = "#0F172A";
        ctx.beginPath();
        ctx.arc(0, -24, 2.8, 0, Math.PI * 2);
        ctx.fill();
      }

      // Eyebrows
      const browLift =
        currentEmotion === "enthusiastic" || currentEmotion === "curious"
          ? -4.5 - smoothVolume * 3
          : currentState === "thinking"
          ? -2.5
          : -smoothVolume * 2;

      ctx.strokeStyle = app.hairColor;
      ctx.lineWidth = isFemale ? 3.8 : 4.8;
      ctx.lineCap = "round";

      ctx.beginPath();
      ctx.moveTo(-46, -24 + browLift);
      ctx.quadraticCurveTo(-28, -33 + browLift, -13, -25 + browLift * 0.6);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(13, -25 + browLift * 0.6);
      ctx.quadraticCurveTo(28, -33 + browLift, 46, -24 + browLift);
      ctx.stroke();

      // Eyes
      const eyePositions = [-29, 29];
      const eyeY = -8;
      const eyeW = 15;
      const openEyeH = isFemale ? 9.5 : 8.5;
      const currentEyeH = Math.max(0.8, openEyeH * (1 - blinkProgress));

      eyePositions.forEach((ex) => {
        ctx.save();
        ctx.fillStyle = "rgba(0, 0, 0, 0.10)";
        ctx.beginPath();
        ctx.ellipse(ex, eyeY, eyeW + 3, openEyeH + 3, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.ellipse(ex, eyeY, eyeW, currentEyeH, 0, 0, Math.PI * 2);
        ctx.clip();

        ctx.fillStyle = "#F8FAFC";
        ctx.fillRect(ex - eyeW, eyeY - openEyeH, eyeW * 2, openEyeH * 2);

        const irisX = ex + eyeGazeX;
        const irisY = eyeY + eyeGazeY;
        const irisGrad = ctx.createRadialGradient(
          irisX,
          irisY,
          1.5,
          irisX,
          irisY,
          7.2
        );
        irisGrad.addColorStop(0, "#1C1311");
        irisGrad.addColorStop(0.65, "#3E2418");
        irisGrad.addColorStop(1, "#180E0B");
        ctx.fillStyle = irisGrad;
        ctx.beginPath();
        ctx.arc(irisX, irisY, 7.2, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#09090B";
        ctx.beginPath();
        ctx.arc(irisX, irisY, 3.2, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "rgba(255, 255, 255, 0.92)";
        ctx.beginPath();
        ctx.arc(irisX - 2.2, irisY - 2.2, 1.8, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "rgba(56, 189, 248, 0.75)";
        ctx.beginPath();
        ctx.arc(irisX + 2.4, irisY + 1.8, 1.0, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();

        ctx.strokeStyle = "#181416";
        ctx.lineWidth = isFemale ? 2.6 : 2.0;
        ctx.beginPath();
        ctx.ellipse(
          ex,
          eyeY,
          eyeW,
          currentEyeH,
          0,
          Math.PI * 1.08,
          Math.PI * 1.92
        );
        ctx.stroke();
      });

      if (app.hasGlasses) {
        ctx.strokeStyle = "#38BDF8";
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.roundRect(-49, -20, 38, 25, 7);
        ctx.roundRect(11, -20, 38, 25, 7);
        ctx.moveTo(-11, -9);
        ctx.lineTo(11, -9);
        ctx.stroke();
      }

      // Nose
      ctx.strokeStyle = app.skinHighlight;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(0, -10);
      ctx.lineTo(-1, 18);
      ctx.stroke();

      ctx.strokeStyle = app.skinShadow;
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.moveTo(-10, 21);
      ctx.quadraticCurveTo(0, 27, 10, 21);
      ctx.stroke();

      // Real-time Viseme Lip-Sync
      const mouthY = 47 + jawExtension * 0.35;
      const smileCurve =
        currentEmotion === "friendly" || currentEmotion === "enthusiastic"
          ? 5.5
          : currentEmotion === "thoughtful"
          ? 1.5
          : 3.5;

      const baseMouthHalfW = 22 * (0.8 + smoothWidth * 0.38 - smoothRound * 0.25);
      const mouthOpenH = smoothJaw * 24;

      if (mouthOpenH < 1.8) {
        ctx.fillStyle = app.lipColor;
        ctx.beginPath();
        ctx.moveTo(-baseMouthHalfW, mouthY - smileCurve * 0.3);
        ctx.quadraticCurveTo(0, mouthY - 5, baseMouthHalfW, mouthY - smileCurve * 0.3);
        ctx.quadraticCurveTo(0, mouthY + 8 + smileCurve * 0.4, -baseMouthHalfW, mouthY - smileCurve * 0.3);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = "rgba(35, 12, 16, 0.65)";
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(-baseMouthHalfW, mouthY - smileCurve * 0.3);
        ctx.quadraticCurveTo(0, mouthY + smileCurve * 0.5, baseMouthHalfW, mouthY - smileCurve * 0.3);
        ctx.stroke();
      } else {
        ctx.save();
        ctx.fillStyle = app.lipColor;
        ctx.beginPath();
        ctx.ellipse(
          0,
          mouthY,
          baseMouthHalfW + 3,
          mouthOpenH * 0.58 + 4,
          0,
          0,
          Math.PI * 2
        );
        ctx.fill();

        ctx.beginPath();
        ctx.ellipse(
          0,
          mouthY,
          baseMouthHalfW,
          mouthOpenH * 0.52,
          0,
          0,
          Math.PI * 2
        );
        ctx.clip();

        ctx.fillStyle = "#260B10";
        ctx.fillRect(
          -baseMouthHalfW - 5,
          mouthY - mouthOpenH,
          (baseMouthHalfW + 5) * 2,
          mouthOpenH * 2
        );

        ctx.fillStyle = "#9E3E48";
        ctx.beginPath();
        ctx.ellipse(
          0,
          mouthY + mouthOpenH * 0.36,
          baseMouthHalfW * 0.65,
          mouthOpenH * 0.38,
          0,
          0,
          Math.PI * 2
        );
        ctx.fill();

        ctx.fillStyle = "#F8FAFC";
        ctx.beginPath();
        ctx.roundRect(
          -baseMouthHalfW * 0.76,
          mouthY - mouthOpenH * 0.52,
          baseMouthHalfW * 1.52,
          Math.min(7, mouthOpenH * 0.34),
          2
        );
        ctx.fill();

        if (currentViseme.sibilance > 0.35) {
          ctx.fillStyle = "rgba(241, 245, 249, 0.85)";
          ctx.beginPath();
          ctx.roundRect(
            -baseMouthHalfW * 0.65,
            mouthY + mouthOpenH * 0.34,
            baseMouthHalfW * 1.3,
            4,
            1.5
          );
          ctx.fill();
        }

        ctx.restore();
      }

      ctx.restore();

      animationFrameId = requestAnimationFrame(renderLoop);
    };

    animationFrameId = requestAnimationFrame(renderLoop);
    return () => cancelAnimationFrame(animationFrameId);
  }, [visemeRef]);

  const getStateLabel = () => {
    switch (agentState) {
      case "listening":
        return {
          text: isUserSpeaking ? "Hearing your voice..." : "Listening to you...",
          icon: isUserSpeaking ? (
            <Radio className="w-3.5 h-3.5 text-rose-400 animate-ping" />
          ) : (
            <Mic className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
          ),
        };
      case "thinking":
        return {
          text: `${persona.name} is thinking...`,
          icon: <Loader2 className="w-3.5 h-3.5 text-sky-400 animate-spin" />,
        };
      case "speaking":
        return {
          text: `${persona.name} is speaking`,
          icon: <Volume2 className="w-3.5 h-3.5 text-sky-400 animate-pulse" />,
        };
      default:
        return {
          text: "Ready for conversation",
          icon: <UserCheck className="w-3.5 h-3.5 text-slate-400" />,
        };
    }
  };

  const statusInfo = getStateLabel();

  return (
    <div className="relative w-full flex flex-col items-center">
      <div
        className={`relative w-full max-w-[520px] aspect-square rounded-3xl overflow-hidden border transition-colors ${
          darkMode
            ? "bg-slate-950 border-slate-800 shadow-2xl shadow-sky-950/30"
            : "bg-slate-900 border-slate-200 shadow-xl shadow-slate-900/10"
        }`}
      >
        <canvas
          ref={canvasRef}
          width={560}
          height={560}
          className="w-full h-full object-cover block"
        />

        {/* Top-Left Live Status */}
        <div className="absolute top-4 left-4 right-4 flex items-center justify-between pointer-events-none">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950/75 backdrop-blur-md border border-white/10 text-xs text-slate-100">
            {statusInfo.icon}
            <span className="font-medium whitespace-nowrap">{statusInfo.text}</span>
            <span aria-hidden="true" className="text-slate-500">
              ·
            </span>
            <span className="text-sky-300 capitalize">{emotion}</span>
          </div>
        </div>

        {/* Action Controls: Stop Speaking or Done Speaking Button */}
        {agentState === "speaking" ? (
          <div className="absolute top-16 right-4 z-10">
            <button
              type="button"
              onClick={onInterrupt}
              className="px-3 py-1.5 rounded-xl bg-amber-500/90 hover:bg-amber-400 text-slate-950 font-semibold text-xs shadow-lg transition-transform active:scale-95 flex items-center gap-1.5 whitespace-nowrap"
            >
              <span>Stop Speaking</span>
            </button>
          </div>
        ) : agentState === "listening" && isUserSpeaking && onDoneSpeaking ? (
          <div className="absolute top-16 right-4 z-10 animate-fade-in">
            <button
              type="button"
              onClick={onDoneSpeaking}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/30 transition-transform active:scale-95 flex items-center gap-1.5 whitespace-nowrap"
            >
              <span>Done Speaking ✓</span>
            </button>
          </div>
        ) : null}

        {/* Measured Scrim for Live Conversation Captions */}
        <div className="absolute inset-x-0 bottom-0 pt-16 pb-5 px-5 bg-gradient-to-t from-slate-950/95 via-slate-950/70 to-transparent flex flex-col justify-end">
          <div className="flex items-center justify-between text-xs text-slate-300 mb-2">
            <div className="flex items-center gap-1.5 truncate">
              <span className="font-semibold text-white text-sm">
                {persona.fullName}
              </span>
              <span aria-hidden="true">·</span>
              <span className="text-sky-300">{persona.city}</span>
              <span aria-hidden="true">·</span>
              <span className="text-slate-400 truncate">{persona.role}</span>
            </div>
            <span className="text-[11px] text-slate-400 shrink-0 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-sky-400" />
              AI Assistant
            </span>
          </div>

          <div className="min-h-[48px] flex items-center">
            {userInterimTranscript ? (
              <p className="text-sm md:text-base text-emerald-300 font-medium leading-snug line-clamp-3">
                “{userInterimTranscript}”
              </p>
            ) : liveCaption ? (
              <p className="text-sm md:text-base text-white font-medium leading-snug line-clamp-3">
                {liveCaption}
              </p>
            ) : (
              <p className="text-xs md:text-sm text-slate-400 italic">
                Tap &ldquo;Start Conversation&rdquo; or use the microphone to talk naturally in English, Hindi, Hinglish, or your regional language.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
