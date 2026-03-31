import { useRef, useCallback, useState, useEffect } from 'react';
import { ExpoPlayAudioStream } from '@mykin-ai/expo-audio-stream';
import { useSharedValue } from 'react-native-reanimated';
import { authFetch, API_BASE_URL } from '../lib/api';
import { useAuthStore } from '../stores/authStore';
import type { PracticeResult, PracticeMode } from '../types/practice';

/** Base64 lookup (no atob — works reliably on all RN engines) */
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const B64_LUT = new Uint8Array(128);
for (let i = 0; i < B64.length; i++) B64_LUT[B64.charCodeAt(i)] = i;

/** Decode base64 PCM-16 chunk → RMS amplitude in 0–1 range */
function computeRMS(base64: string): number {
  // Decode base64 to bytes manually
  const clean = base64.replace(/[=\s]/g, '');
  const n = clean.length;
  const byteLen = (n * 3) >> 2;
  if (byteLen < 2) return 0;

  let sumSq = 0;
  let sampleCount = 0;
  let byteIdx = 0;
  let prevByte = 0;

  for (let i = 0; i < n; i += 4) {
    const a = B64_LUT[clean.charCodeAt(i)];
    const b = i + 1 < n ? B64_LUT[clean.charCodeAt(i + 1)] : 0;
    const c = i + 2 < n ? B64_LUT[clean.charCodeAt(i + 2)] : 0;
    const d = i + 3 < n ? B64_LUT[clean.charCodeAt(i + 3)] : 0;

    const b0 = (a << 2) | (b >> 4);
    const b1 = ((b & 15) << 4) | (c >> 2);
    const b2 = ((c & 3) << 6) | d;

    const triplet = [b0, b1, b2];
    const count = i + 2 < n ? (i + 3 < n ? 3 : 2) : 1;

    for (let j = 0; j < count; j++) {
      if (byteIdx % 2 === 1) {
        // We have a pair: prevByte (lo) + triplet[j] (hi) → Int16LE
        let sample = (triplet[j] << 8) | prevByte;
        if (sample >= 0x8000) sample -= 0x10000;
        sumSq += sample * sample;
        sampleCount++;
      }
      prevByte = triplet[j];
      byteIdx++;
    }
  }

  if (sampleCount === 0) return 0;
  const rms = Math.sqrt(sumSq / sampleCount);
  // Normalize for phone-mic speech levels (~200-2000 RMS typical)
  const linear = Math.min(rms / 1500, 1);
  // Apply compressor curve — boosts quiet audio so bars feel responsive
  return Math.pow(linear, 0.6);
}

export type PracticeRecordingState = 'idle' | 'recording' | 'evaluating' | 'result';

const MAX_RECORDING_SECONDS = 15;

export function usePracticeRecording() {
  const [state, setState] = useState<PracticeRecordingState>('idle');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [result, setResult] = useState<PracticeResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const audioLevel = useSharedValue(0);
  const smoothedRef = useRef(0);

  const audioChunksRef = useRef<string[]>([]);
  const subscriptionRef = useRef<{ remove(): void } | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isRecordingRef = useRef(false);
  const elapsedRef = useRef(0);

  const cleanupRecording = useCallback(async () => {
    console.log(`[PracticeRec] cleanupRecording() — isRecording: ${isRecordingRef.current}, hasTimer: ${!!timerRef.current}, hasSubscription: ${!!subscriptionRef.current}`);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    subscriptionRef.current?.remove();
    subscriptionRef.current = null;
    if (isRecordingRef.current) {
      console.log(`[PracticeRec] cleanupRecording() — stopping ExpoPlayAudioStream...`);
      try { await ExpoPlayAudioStream.stopRecording(); } catch (e) {
        console.warn('[PracticeRec] cleanupRecording() — stopRecording error:', e);
      }
      console.log(`[PracticeRec] cleanupRecording() — ExpoPlayAudioStream stopped, chunks at this point: ${audioChunksRef.current.length}`);
      isRecordingRef.current = false;
    }
  }, []);

  const submitRecording = useCallback(async (
    correctionId: number,
    mode: PracticeMode,
    scenario?: string,
  ) => {
    const t0 = Date.now();
    console.log(`[PracticeRec] ========== SUBMIT RECORDING ==========`);
    console.log(`[PracticeRec] submit() t=0ms — correctionId: ${correctionId}, mode: ${mode}, scenario: ${scenario ? 'yes' : 'no'}`);
    setState('evaluating');

    const chunks = audioChunksRef.current;
    const estimatedDurationMs = chunks.length * 100; // each chunk ~100ms at interval=100
    console.log(`[PracticeRec] submit() — chunks: ${chunks.length}, elapsed: ${elapsedRef.current}s, estimated audio duration: ${estimatedDurationMs}ms`);

    if (chunks.length === 0 || elapsedRef.current < 1) {
      console.warn(`[PracticeRec] submit() — ABORTING: too short (chunks=${chunks.length}, elapsed=${elapsedRef.current}s)`);
      setError('Recording too short. Hold to record.');
      setState('idle');
      return;
    }

    // Log first and last chunk sizes to detect truncation
    console.log(`[PracticeRec] submit() — first chunk size: ${chunks[0]?.length ?? 0}, last chunk size: ${chunks[chunks.length - 1]?.length ?? 0}`);

    const audioBase64 = chunks.join('');
    audioChunksRef.current = [];
    const estimatedPCMBytes = Math.floor((audioBase64.length * 3) / 4);
    const estimatedPCMDurationSec = estimatedPCMBytes / (16000 * 2); // 16kHz, 16-bit = 2 bytes/sample
    console.log(`[PracticeRec] submit() — base64 length: ${audioBase64.length}, PCM bytes (est): ${estimatedPCMBytes}, PCM duration (est): ${estimatedPCMDurationSec.toFixed(2)}s`);

    try {
      const token = useAuthStore.getState().token;
      const formData = new FormData();
      // Text fields MUST come before the file for @fastify/multipart to parse them
      formData.append('correctionId', String(correctionId));
      formData.append('mode', mode);
      if (scenario) {
        formData.append('scenario', scenario);
      }
      formData.append('sampleRate', '16000');
      formData.append('channels', '1');
      formData.append('encoding', 'pcm_16bit');
      formData.append('audio', {
        uri: `data:audio/pcm;base64,${audioBase64}`,
        type: 'audio/pcm',
        name: 'recording.pcm',
      } as any);

      console.log(`[PracticeRec] submit() t=${Date.now() - t0}ms — POSTing to ${API_BASE_URL}/practice/evaluate`);
      const res = await fetch(`${API_BASE_URL}/practice/evaluate`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      console.log(`[PracticeRec] submit() t=${Date.now() - t0}ms — response status: ${res.status}`);
      if (!res.ok) {
        const errorBody = await res.text();
        console.error(`[PracticeRec] submit() — evaluation FAILED: ${res.status} — ${errorBody}`);
        throw new Error('Evaluation failed');
      }

      const data: PracticeResult = await res.json();
      console.log(`[PracticeRec] submit() t=${Date.now() - t0}ms — result: passed=${data.passed}, transcript="${data.transcript}"`);
      console.log(`[PracticeRec] submit() — full result: ${JSON.stringify(data)}`);
      setResult(data);
      setState('result');
    } catch (err) {
      console.error(`[PracticeRec] submit() t=${Date.now() - t0}ms — ERROR:`, err);
      setError('Could not evaluate recording. Try again.');
      setState('idle');
    }
    console.log(`[PracticeRec] ========== SUBMIT COMPLETE — total: ${Date.now() - t0}ms ==========`);
  }, []);

  const start = useCallback(async () => {
    const t0 = Date.now();
    console.log(`[PracticeRec] ========== START() CALLED ==========`);
    console.log(`[PracticeRec] start() t=0ms — current state: ${state}`);
    setError(null);
    setResult(null);
    audioChunksRef.current = [];
    elapsedRef.current = 0;
    setElapsedSeconds(0);

    console.log(`[PracticeRec] start() t=${Date.now() - t0}ms — requesting mic permission...`);
    const { granted } = await ExpoPlayAudioStream.requestPermissionsAsync();
    console.log(`[PracticeRec] start() t=${Date.now() - t0}ms — permission granted: ${granted}`);
    if (!granted) {
      setError('Microphone permission is required');
      return;
    }

    try {
      console.log(`[PracticeRec] start() t=${Date.now() - t0}ms — calling ExpoPlayAudioStream.startRecording...`);
      let firstChunkTime: number | null = null;
      const { subscription } = await ExpoPlayAudioStream.startRecording({
        sampleRate: 16000,
        channels: 1,
        encoding: 'pcm_16bit',
        interval: 100,
        onAudioStream: async (event: any) => {
          if (event.data) {
            // Drop the very first chunk — it always contains mic initialization
            // noise (RMS=1.000) that corrupts transcription
            if (firstChunkTime === null) {
              firstChunkTime = Date.now();
              console.log(`[PracticeRec] DROPPING first chunk (mic init noise) — t=${firstChunkTime - t0}ms, size=${event.data.length}, RMS=${computeRMS(event.data).toFixed(3)}`);
              return;
            }
            audioChunksRef.current.push(event.data);
            if (audioChunksRef.current.length <= 5 || audioChunksRef.current.length % 10 === 0) {
              console.log(`[PracticeRec] chunk #${audioChunksRef.current.length} — size=${event.data.length}, t=${Date.now() - t0}ms, RMS=${computeRMS(event.data).toFixed(3)}`);
            }
            // Extract real-time audio level for visualizer
            try {
              const raw = computeRMS(event.data);
              const smoothed = smoothedRef.current * 0.3 + raw * 0.7;
              smoothedRef.current = smoothed;
              audioLevel.value = smoothed;
            } catch {}
          }
        },
      });
      console.log(`[PracticeRec] start() t=${Date.now() - t0}ms — startRecording resolved, subscription: ${!!subscription}`);
      isRecordingRef.current = true;
      if (subscription) {
        subscriptionRef.current = subscription;
      }

      setState('recording');
      console.log(`[PracticeRec] start() t=${Date.now() - t0}ms — state set to 'recording'`);

      timerRef.current = setInterval(() => {
        elapsedRef.current += 1;
        setElapsedSeconds(elapsedRef.current);
        console.log(`[PracticeRec] timer tick — elapsed=${elapsedRef.current}s, chunks=${audioChunksRef.current.length}`);
        if (elapsedRef.current >= MAX_RECORDING_SECONDS) {
          // Auto-stop handled by the component calling stop()
        }
      }, 1000);
      console.log(`[PracticeRec] ========== START() COMPLETE — total: ${Date.now() - t0}ms ==========`);
    } catch (err) {
      console.error(`[PracticeRec] start() t=${Date.now() - t0}ms — FAILED:`, err);
      setError('Failed to start microphone');
    }
  }, []);

  const stop = useCallback(async (
    correctionId: number,
    mode: PracticeMode,
    scenario?: string,
  ) => {
    const t0 = Date.now();
    console.log(`[PracticeRec] ========== STOP() CALLED ==========`);
    console.log(`[PracticeRec] stop() t=0ms — chunks: ${audioChunksRef.current.length}, elapsed: ${elapsedRef.current}s, state: ${state}`);
    audioLevel.value = 0;
    smoothedRef.current = 0;
    console.log(`[PracticeRec] stop() t=${Date.now() - t0}ms — calling cleanupRecording...`);
    await cleanupRecording();
    console.log(`[PracticeRec] stop() t=${Date.now() - t0}ms — cleanup done, chunks after cleanup: ${audioChunksRef.current.length}`);
    console.log(`[PracticeRec] stop() t=${Date.now() - t0}ms — calling submitRecording...`);
    await submitRecording(correctionId, mode, scenario);
    console.log(`[PracticeRec] ========== STOP() COMPLETE — total: ${Date.now() - t0}ms ==========`);
  }, [cleanupRecording, submitRecording, audioLevel]);

  const reset = useCallback(() => {
    audioChunksRef.current = [];
    elapsedRef.current = 0;
    setElapsedSeconds(0);
    setResult(null);
    setError(null);
    audioLevel.value = 0;
    smoothedRef.current = 0;
    setState('idle');
  }, [audioLevel]);

  // Cleanup on unmount
  useEffect(() => {
    return () => { cleanupRecording(); };
  }, [cleanupRecording]);

  return { state, elapsedSeconds, result, error, audioLevel, start, stop, reset };
}
