/**
 * Audio Diagnostic and Clarity Confidence Analyzer
 * Runs a 3-second microphone test, computes DSP acoustic metrics,
 * records a test audio sample, and interfaces with AI diagnostics.
 */

export interface AcousticMetrics {
  durationSeconds: number;
  averageRms: number; // 0..1
  peakVolume: number; // 0..1
  noiseFloor: number; // 0..1
  snrDb: number; // Signal-to-Noise Ratio in decibels
  clippingRatio: number; // 0..1 fraction of clipped frames
  speechActivityRatio: number; // 0..1 fraction of duration speech was active
  spectralClarity: number; // 0..1 energy in human voice frequency band (300Hz-3400Hz)
}

export interface AudioDiagnosticResult {
  confidenceScore: number; // 0..100
  clarityGrade: "Excellent" | "Good" | "Fair" | "Poor" | "Silent";
  statusSummary: string;
  detectedIssues: string[];
  troubleshootingTips: string[];
  speechDetected: boolean;
  transcript?: string;
  audioBlob?: Blob;
  audioUrl?: string;
  metrics: AcousticMetrics;
  analyzedAt: string;
  source: "ai_and_dsp" | "client_dsp";
}

/**
 * Converts a Blob to a base64 data string (without data URL prefix).
 */
export async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64data = (reader.result as string).split(",")[1];
      resolve(base64data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Runs a 3-second recording test from the user's microphone.
 *
 * @param onProgress Callback invoked during recording with seconds remaining (3.0 -> 0) and live volume (0..1)
 * @param selectedLanguage Code of current language for speech hint
 */
export async function runAudioDiagnosticTest(
  onProgress?: (secondsRemaining: number, liveVolume: number) => void,
  selectedLanguage: string = "en-IN"
): Promise<AudioDiagnosticResult> {
  // 1. Request microphone stream
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error(
      "Microphone access is not supported in this browser environment."
    );
  }

  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
  } catch (err: any) {
    if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
      throw new Error(
        "Microphone permission was denied. Please allow microphone access in your browser address bar and try again."
      );
    }
    if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
      throw new Error(
        "No microphone device was detected on your system. Please connect an input device."
      );
    }
    throw new Error(
      err?.message || "Failed to initialize microphone for diagnostic test."
    );
  }

  // 2. Setup Web Audio API Analyser for real-time DSP metric collection
  const AudioCtxClass =
    window.AudioContext || (window as any).webkitAudioContext;
  const audioCtx = new AudioCtxClass();
  if (audioCtx.state === "suspended") {
    await audioCtx.resume().catch(() => {});
  }

  const source = audioCtx.createMediaStreamSource(stream);
  const analyser = audioCtx.createAnalyser();
  analyser.fftSize = 512;
  analyser.smoothingTimeConstant = 0.2;
  source.connect(analyser);

  // 3. Setup MediaRecorder to capture the 3-second sample
  let mimeType = "audio/webm";
  if (!MediaRecorder.isTypeSupported("audio/webm")) {
    if (MediaRecorder.isTypeSupported("audio/ogg")) mimeType = "audio/ogg";
    else if (MediaRecorder.isTypeSupported("audio/mp4")) mimeType = "audio/mp4";
    else mimeType = "";
  }

  const chunks: Blob[] = [];
  const recorder = mimeType
    ? new MediaRecorder(stream, { mimeType })
    : new MediaRecorder(stream);

  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) {
      chunks.push(e.data);
    }
  };

  recorder.start(100);

  // 4. Sample frames for exactly 3 seconds (3000ms)
  const TEST_DURATION_MS = 3000;
  const startTime = performance.now();

  const rmsReadings: number[] = [];
  const peakReadings: number[] = [];
  let clippingFrames = 0;
  let totalFrames = 0;
  const vocalBandRatios: number[] = [];

  const timeData = new Uint8Array(analyser.frequencyBinCount);
  const freqData = new Uint8Array(analyser.frequencyBinCount);

  await new Promise<void>((resolve) => {
    const sampleInterval = setInterval(() => {
      const elapsed = performance.now() - startTime;
      const remainingMs = Math.max(0, TEST_DURATION_MS - elapsed);
      const remainingSec = Math.round((remainingMs / 1000) * 10) / 10;

      // Extract time-domain waveform for RMS & Peak
      analyser.getByteTimeDomainData(timeData);
      let sumSquares = 0;
      let framePeak = 0;

      for (let i = 0; i < timeData.length; i++) {
        // timeData is 0..255 with 128 as zero point
        const normalized = (timeData[i] - 128) / 128;
        const absVal = Math.abs(normalized);
        if (absVal > framePeak) framePeak = absVal;
        sumSquares += normalized * normalized;
      }

      const frameRms = Math.sqrt(sumSquares / timeData.length);
      rmsReadings.push(frameRms);
      peakReadings.push(framePeak);
      totalFrames++;

      if (framePeak >= 0.98) {
        clippingFrames++;
      }

      // Extract frequency data for speech presence & vocal band (approx 300Hz-3400Hz)
      analyser.getByteFrequencyData(freqData);
      const sampleRate = audioCtx.sampleRate || 48000;
      const binWidth = sampleRate / analyser.fftSize;

      let vocalEnergy = 0;
      let totalEnergy = 0;
      for (let i = 0; i < freqData.length; i++) {
        const freq = i * binWidth;
        const energy = freqData[i] / 255;
        totalEnergy += energy;
        if (freq >= 250 && freq <= 3500) {
          vocalEnergy += energy;
        }
      }
      const vocalRatio = totalEnergy > 0 ? vocalEnergy / totalEnergy : 0;
      vocalBandRatios.push(vocalRatio);

      // Report live progress
      if (onProgress) {
        onProgress(remainingSec, framePeak);
      }

      if (elapsed >= TEST_DURATION_MS) {
        clearInterval(sampleInterval);
        resolve();
      }
    }, 50); // ~20 samples per second
  });

  // Stop recorder and audio stream
  await new Promise<void>((resolve) => {
    recorder.onstop = () => resolve();
    try {
      recorder.stop();
    } catch {
      resolve();
    }
  });

  // Cleanup media stream and audio context
  try {
    stream.getTracks().forEach((track) => track.stop());
    source.disconnect();
    audioCtx.close().catch(() => {});
  } catch {}

  const finalBlob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
  const audioUrl = URL.createObjectURL(finalBlob);

  // 5. Compute DSP Metrics
  const sortedRms = [...rmsReadings].sort((a, b) => a - b);
  // Estimate noise floor from bottom 20% quietest frames
  const noiseFloorCount = Math.max(1, Math.floor(sortedRms.length * 0.2));
  const noiseFloorSlice = sortedRms.slice(0, noiseFloorCount);
  const estimatedNoiseFloor =
    noiseFloorSlice.reduce((a, b) => a + b, 0) / noiseFloorCount;

  const maxPeak = Math.max(0, ...peakReadings);
  const avgRms =
    rmsReadings.reduce((a, b) => a + b, 0) / Math.max(1, rmsReadings.length);

  // Voice activity: frames where RMS exceeds noise floor by noticeable margin
  const speechThreshold = Math.max(0.02, estimatedNoiseFloor * 1.6 + 0.015);
  const speechFrames = rmsReadings.filter((r) => r > speechThreshold).length;
  const speechActivityRatio = speechFrames / Math.max(1, rmsReadings.length);

  // SNR estimate in dB
  const effectiveSpeechLevel = Math.max(0.01, maxPeak * 0.7);
  const effectiveNoiseLevel = Math.max(0.001, estimatedNoiseFloor);
  const snrDb = Math.round(
    20 * Math.log10(effectiveSpeechLevel / effectiveNoiseLevel)
  );

  const clippingRatio = clippingFrames / Math.max(1, totalFrames);
  const avgVocalClarity =
    vocalBandRatios.reduce((a, b) => a + b, 0) /
    Math.max(1, vocalBandRatios.length);

  const metrics: AcousticMetrics = {
    durationSeconds: 3.0,
    averageRms: Math.round(avgRms * 1000) / 1000,
    peakVolume: Math.round(maxPeak * 1000) / 1000,
    noiseFloor: Math.round(estimatedNoiseFloor * 1000) / 1000,
    snrDb,
    clippingRatio: Math.round(clippingRatio * 1000) / 1000,
    speechActivityRatio: Math.round(speechActivityRatio * 100) / 100,
    spectralClarity: Math.round(avgVocalClarity * 100) / 100,
  };

  // 6. Compute DSP Rule-Based Clarity Confidence Score
  const detectedIssues: string[] = [];
  const troubleshootingTips: string[] = [];

  let dspScore = 80; // Baseline
  let speechDetected = speechActivityRatio >= 0.15 && maxPeak >= 0.04;

  if (maxPeak < 0.015 || speechActivityRatio < 0.08) {
    // Virtually silent
    dspScore = Math.min(15, Math.round(maxPeak * 500));
    speechDetected = false;
    detectedIssues.push("No audible speech detected (Signal Silent)");
    troubleshootingTips.push(
      "Verify that your microphone's physical hardware mute switch is off."
    );
    troubleshootingTips.push(
      "Check your browser site permissions to confirm the correct input device is selected."
    );
    troubleshootingTips.push(
      "Increase microphone input volume in your operating system settings."
    );
  } else {
    // Low volume penalty
    if (maxPeak < 0.08 || avgRms < 0.02) {
      dspScore -= 25;
      detectedIssues.push("Low input volume / Faint audio");
      troubleshootingTips.push(
        "Speak closer to the microphone (recommended 15-20 cm away)."
      );
      troubleshootingTips.push(
        "Increase microphone gain or input volume in system sound settings."
      );
    } else if (maxPeak >= 0.15 && maxPeak <= 0.85) {
      // Healthy volume bonus
      dspScore += 10;
    }

    // Clipping / Distortion penalty
    if (clippingRatio > 0.03 || clippingFrames > 5) {
      dspScore -= 35;
      detectedIssues.push("Audio clipping & distortion detected (Input too loud)");
      troubleshootingTips.push(
        "Lower your microphone input gain in system sound settings."
      );
      troubleshootingTips.push(
        "Step slightly back from the microphone to prevent peak saturation."
      );
    }

    // SNR / Background Noise assessment
    if (snrDb < 8 || estimatedNoiseFloor > 0.12) {
      dspScore -= 25;
      detectedIssues.push("High ambient background noise detected");
      troubleshootingTips.push(
        "Move to a quieter environment or reduce background fans/AC."
      );
      troubleshootingTips.push(
        "Consider using a headset or directional noise-cancelling microphone."
      );
    } else if (snrDb >= 18) {
      // Great SNR bonus
      dspScore += 10;
    }

    // Voice frequency presence bonus
    if (avgVocalClarity > 0.5) {
      dspScore += 5;
    }
  }

  // Constrain to 0..100
  dspScore = Math.max(0, Math.min(100, Math.round(dspScore)));

  if (troubleshootingTips.length === 0) {
    troubleshootingTips.push(
      "Your microphone input is clear, balanced, and ready for conversation!"
    );
    troubleshootingTips.push(
      "Maintain a steady distance of 15-20cm for optimal voice fidelity."
    );
  }

  // Determine grade and summary
  let clarityGrade: AudioDiagnosticResult["clarityGrade"] = "Good";
  let statusSummary = "Audio input is adequate for conversation.";

  if (dspScore >= 85) {
    clarityGrade = "Excellent";
    statusSummary = "Crystal clear audio with strong signal and low ambient noise.";
  } else if (dspScore >= 70) {
    clarityGrade = "Good";
    statusSummary = "Clear voice signal with good intelligibility.";
  } else if (dspScore >= 50) {
    clarityGrade = "Fair";
    statusSummary = "Moderate clarity; minor noise or volume adjustments recommended.";
  } else if (dspScore >= 20) {
    clarityGrade = "Poor";
    statusSummary = "Suboptimal audio clarity; speech recognition may struggle.";
  } else {
    clarityGrade = "Silent";
    statusSummary = "No usable voice audio signal detected.";
  }

  // 7. Attempt Server-side AI Diagnostic (if available) to enrich analysis
  try {
    const base64Data = await blobToBase64(finalBlob);
    const response = await fetch("/api/audio-diagnostic", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        audioBase64: base64Data,
        mimeType: finalBlob.type || "audio/webm",
        language: selectedLanguage,
      }),
    });

    if (response.ok) {
      const aiData = await response.json();
      const aiConfidence =
        typeof aiData.confidenceScore === "number"
          ? aiData.confidenceScore
          : undefined;

      // Merge AI insights with acoustic measurements
      const combinedScore =
        aiConfidence !== undefined
          ? Math.round(aiConfidence * 0.6 + dspScore * 0.4)
          : dspScore;

      const mergedIssues = Array.from(
        new Set([...(aiData.detectedIssues || []), ...detectedIssues])
      ).filter(
        (issue) => issue && issue.toLowerCase() !== "none"
      );

      const mergedTips = Array.from(
        new Set([...(aiData.troubleshootingTips || []), ...troubleshootingTips])
      ).slice(0, 4);

      let finalGrade = clarityGrade;
      if (combinedScore >= 85) finalGrade = "Excellent";
      else if (combinedScore >= 70) finalGrade = "Good";
      else if (combinedScore >= 50) finalGrade = "Fair";
      else if (combinedScore >= 20) finalGrade = "Poor";
      else finalGrade = "Silent";

      return {
        confidenceScore: combinedScore,
        clarityGrade: finalGrade,
        statusSummary: aiData.summary || statusSummary,
        detectedIssues: mergedIssues,
        troubleshootingTips: mergedTips,
        speechDetected: aiData.speechDetected ?? speechDetected,
        transcript: aiData.transcript || undefined,
        audioBlob: finalBlob,
        audioUrl,
        metrics,
        analyzedAt: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
        source: "ai_and_dsp",
      };
    }
  } catch (err) {
    // Fall back to robust DSP metrics if network or AI call fails
    console.warn("AI diagnostic endpoint unavailable, relying on DSP metrics:", err);
  }

  return {
    confidenceScore: dspScore,
    clarityGrade,
    statusSummary,
    detectedIssues,
    troubleshootingTips,
    speechDetected,
    audioBlob: finalBlob,
    audioUrl,
    metrics,
    analyzedAt: new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }),
    source: "client_dsp",
  };
}
