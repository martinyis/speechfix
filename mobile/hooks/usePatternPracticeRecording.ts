import { useRef, useCallback, useState, useEffect } from 'react';
import { ExpoPlayAudioStream } from '@mykin-ai/expo-audio-stream';
import { useSharedValue } from 'react-native-reanimated';
import { API_BASE_URL } from '../lib/api';
import { useAuthStore } from '../stores/authStore';
import type { PracticeResult } from '../types/practice';

/** Base64 lookup (no atob — works reliably on all RN engines) */
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const B64_LUT = new Uint8Array(128);
for (let i = 0; i < B64.length; i++) B64_LUT[B64.charCodeAt(i)] = i;

/** Decode base64 PCM-16 chunk → RMS amplitude in 0–1 range */
function computeRMS(base64: string): number {
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
  const linear = Math.min(rms / 1500, 1);
  return Math.pow(linear, 0.6);
}

export type PatternRecordingState = 'idle' | 'recording' | 'evaluating' | 'result';

const MAX_RECORDING_SECONDS = 15;

export function usePatternPracticeRecording() {
  const [state, setState] = useState<PatternRecordingState>('idle');
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
      try { await ExpoPlayAudioStream.stopRecording(); } catch (e) {
        console.warn('[PatternRec] cleanupRecording() — stopRecording error:', e);
      }
      isRecordingRef.current = false;
    }
  }, []);

  const submitRecording = useCallback(async (exerciseId: number) => {
    const t0 = Date.now();
    console.log(`[PatternRec] ========== SUBMIT RECORDING ==========`);
    console.log(`[PatternRec] submit() — exerciseId: ${exerciseId}`);
    setState('evaluating');

    const chunks = audioChunksRef.current;

    if (chunks.length === 0 || elapsedRef.current < 1) {
      console.warn(`[PatternRec] submit() — ABORTING: too short`);
      setError('Recording too short. Hold to record.');
      setState('idle');
      return;
    }

    const audioBase64 = chunks.join('');
    audioChunksRef.current = [];

    try {
      const token = useAuthStore.getState().token;
      const formData = new FormData();
      formData.append('exerciseId', String(exerciseId));
      formData.append('sampleRate', '16000');
      formData.append('channels', '1');
      formData.append('encoding', 'pcm_16bit');
      formData.append('audio', {
        uri: `data:audio/pcm;base64,${audioBase64}`,
        type: 'audio/pcm',
        name: 'recording.pcm',
      } as any);

      console.log(`[PatternRec] submit() — POSTing to ${API_BASE_URL}/practice/pattern-evaluate`);
      const res = await fetch(`${API_BASE_URL}/practice/pattern-evaluate`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!res.ok) {
        const errorBody = await res.text();
        console.error(`[PatternRec] submit() — evaluation FAILED: ${res.status} — ${errorBody}`);
        throw new Error('Evaluation failed');
      }

      const data: PracticeResult = await res.json();
      console.log(`[PatternRec] submit() t=${Date.now() - t0}ms — result: passed=${data.passed}`);
      setResult(data);
      setState('result');
    } catch (err) {
      console.error(`[PatternRec] submit() — ERROR:`, err);
      setError('Could not evaluate recording. Try again.');
      setState('idle');
    }
  }, []);

  const start = useCallback(async () => {
    setError(null);
    setResult(null);
    audioChunksRef.current = [];
    elapsedRef.current = 0;
    setElapsedSeconds(0);

    const { granted } = await ExpoPlayAudioStream.requestPermissionsAsync();
    if (!granted) {
      setError('Microphone permission is required');
      return;
    }

    try {
      let firstChunkTime: number | null = null;
      const { subscription } = await ExpoPlayAudioStream.startRecording({
        sampleRate: 16000,
        channels: 1,
        encoding: 'pcm_16bit',
        interval: 100,
        onAudioStream: async (event: any) => {
          if (event.data) {
            if (firstChunkTime === null) {
              firstChunkTime = Date.now();
              return;
            }
            audioChunksRef.current.push(event.data);
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
      if (subscription) {
        subscriptionRef.current = subscription;
      }

      setState('recording');

      timerRef.current = setInterval(() => {
        elapsedRef.current += 1;
        setElapsedSeconds(elapsedRef.current);
      }, 1000);
    } catch (err) {
      console.error(`[PatternRec] start() — FAILED:`, err);
      setError('Failed to start microphone');
    }
  }, []);

  const stop = useCallback(async (exerciseId: number) => {
    audioLevel.value = 0;
    smoothedRef.current = 0;
    await cleanupRecording();
    await submitRecording(exerciseId);
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

  useEffect(() => {
    return () => { cleanupRecording(); };
  }, [cleanupRecording]);

  return { state, elapsedSeconds, result, error, audioLevel, start, stop, reset };
}
