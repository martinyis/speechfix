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
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    subscriptionRef.current?.remove();
    subscriptionRef.current = null;
    if (isRecordingRef.current) {
      try { await ExpoPlayAudioStream.stopRecording(); } catch {}
      isRecordingRef.current = false;
    }
  }, []);

  const submitRecording = useCallback(async (
    correctionId: number,
    mode: PracticeMode,
    scenario?: string,
  ) => {
    console.log(`[PracticeRec] submitRecording() — correctionId: ${correctionId}, mode: ${mode}`);
    setState('evaluating');

    const chunks = audioChunksRef.current;
    console.log(`[PracticeRec] Chunks: ${chunks.length}, elapsed: ${elapsedRef.current}s`);
    if (chunks.length === 0 || elapsedRef.current < 1) {
      console.warn('[PracticeRec] Recording too short — aborting');
      setError('Recording too short. Hold to record.');
      setState('idle');
      return;
    }

    const audioBase64 = chunks.join('');
    audioChunksRef.current = [];
    console.log(`[PracticeRec] Audio base64 length: ${audioBase64.length}`);

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

      console.log(`[PracticeRec] POSTing to ${API_BASE_URL}/practice/evaluate`);
      const res = await fetch(`${API_BASE_URL}/practice/evaluate`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      console.log(`[PracticeRec] Response status: ${res.status}`);
      if (!res.ok) {
        const errorBody = await res.text();
        console.error(`[PracticeRec] Evaluation failed: ${res.status} — ${errorBody}`);
        throw new Error('Evaluation failed');
      }

      const data: PracticeResult = await res.json();
      console.log('[PracticeRec] Result:', JSON.stringify(data));
      setResult(data);
      setState('result');
    } catch (err) {
      console.error('[PracticeRec] Submit error:', err);
      setError('Could not evaluate recording. Try again.');
      setState('idle');
    }
  }, []);

  const start = useCallback(async () => {
    console.log('[PracticeRec] start() called');
    setError(null);
    setResult(null);
    audioChunksRef.current = [];
    elapsedRef.current = 0;
    setElapsedSeconds(0);

    console.log('[PracticeRec] Requesting mic permission...');
    const { granted } = await ExpoPlayAudioStream.requestPermissionsAsync();
    console.log('[PracticeRec] Permission granted:', granted);
    if (!granted) {
      setError('Microphone permission is required');
      return;
    }

    try {
      console.log('[PracticeRec] Starting ExpoPlayAudioStream.startRecording...');
      const { subscription } = await ExpoPlayAudioStream.startRecording({
        sampleRate: 16000,
        channels: 1,
        encoding: 'pcm_16bit',
        interval: 100,
        onAudioStream: async (event: any) => {
          if (event.data) {
            audioChunksRef.current.push(event.data);
            if (audioChunksRef.current.length % 10 === 1) {
              console.log(`[PracticeRec] Audio chunks: ${audioChunksRef.current.length}, latest size: ${event.data.length}`);
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
      isRecordingRef.current = true;
      console.log('[PracticeRec] Recording started, subscription:', !!subscription);
      if (subscription) {
        subscriptionRef.current = subscription;
      }

      setState('recording');
      console.log('[PracticeRec] State set to recording');

      timerRef.current = setInterval(() => {
        elapsedRef.current += 1;
        setElapsedSeconds(elapsedRef.current);
        if (elapsedRef.current >= MAX_RECORDING_SECONDS) {
          // Auto-stop handled by the component calling stop()
        }
      }, 1000);
    } catch (err) {
      console.error('[PracticeRec] Failed to start microphone:', err);
      setError('Failed to start microphone');
    }
  }, []);

  const stop = useCallback(async (
    correctionId: number,
    mode: PracticeMode,
    scenario?: string,
  ) => {
    console.log(`[PracticeRec] stop() called — chunks: ${audioChunksRef.current.length}, elapsed: ${elapsedRef.current}s`);
    audioLevel.value = 0;
    smoothedRef.current = 0;
    await cleanupRecording();
    await submitRecording(correctionId, mode, scenario);
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
