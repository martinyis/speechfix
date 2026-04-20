import { useCallback, useEffect, useRef, useState } from 'react';
import { ExpoPlayAudioStream } from '@mykin-ai/expo-audio-stream';
import { useSharedValue, type SharedValue } from 'react-native-reanimated';
import { API_BASE_URL } from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';
import { computeRMS } from '../../lib/rms';

export type RecordAndSubmitState = 'idle' | 'recording' | 'evaluating' | 'result';

export interface RecordAndSubmitConfig<TParams, TResult> {
  endpoint: string;
  formFields: (params: TParams) => Record<string, string | number>;
  parseResponse: (json: unknown) => TResult;
  maxDurationSeconds?: number;
}

export interface RecordAndSubmitHandle<TParams, TResult> {
  state: RecordAndSubmitState;
  elapsedSeconds: number;
  result: TResult | null;
  error: string | null;
  audioLevel: SharedValue<number>;
  start: () => Promise<void>;
  stop: (params: TParams) => Promise<void>;
  reset: () => void;
}

export function useRecordAndSubmit<TParams, TResult>(
  config: RecordAndSubmitConfig<TParams, TResult>,
): RecordAndSubmitHandle<TParams, TResult> {
  const { endpoint, formFields, parseResponse } = config;

  const [state, setState] = useState<RecordAndSubmitState>('idle');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [result, setResult] = useState<TResult | null>(null);
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
        console.warn('[record-and-submit] stopRecording error:', e);
      }
      isRecordingRef.current = false;
    }
  }, []);

  const submitRecording = useCallback(
    async (params: TParams) => {
      setState('evaluating');

      const chunks = audioChunksRef.current;
      if (chunks.length === 0 || elapsedRef.current < 1) {
        setError('Recording too short. Hold to record.');
        setState('idle');
        return;
      }

      const audioBase64 = chunks.join('');
      audioChunksRef.current = [];

      try {
        const token = useAuthStore.getState().token;
        const formData = new FormData();
        const fields = formFields(params);
        for (const [key, value] of Object.entries(fields)) {
          formData.append(key, String(value));
        }
        formData.append('sampleRate', '16000');
        formData.append('channels', '1');
        formData.append('encoding', 'pcm_16bit');
        formData.append('audio', {
          uri: `data:audio/pcm;base64,${audioBase64}`,
          type: 'audio/pcm',
          name: 'recording.pcm',
        } as any);

        const res = await fetch(`${API_BASE_URL}${endpoint}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });

        if (!res.ok) {
          const body = await res.text();
          console.error(`[record-and-submit] ${endpoint} failed: ${res.status} — ${body}`);
          throw new Error('Evaluation failed');
        }

        const data = parseResponse(await res.json());
        setResult(data);
        setState('result');
      } catch (err) {
        console.error(`[record-and-submit] submit error:`, err);
        setError('Could not evaluate recording. Try again.');
        setState('idle');
      }
    },
    [endpoint, formFields, parseResponse],
  );

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
      let firstChunkDropped = false;
      const { subscription } = await ExpoPlayAudioStream.startRecording({
        sampleRate: 16000,
        channels: 1,
        encoding: 'pcm_16bit',
        interval: 100,
        onAudioStream: async (event: any) => {
          if (!event.data) return;
          if (!firstChunkDropped) {
            firstChunkDropped = true;
            return;
          }
          audioChunksRef.current.push(event.data);
          try {
            const raw = computeRMS(event.data);
            const smoothed = smoothedRef.current * 0.3 + raw * 0.7;
            smoothedRef.current = smoothed;
            audioLevel.value = smoothed;
          } catch {}
        },
      });
      isRecordingRef.current = true;
      if (subscription) subscriptionRef.current = subscription;

      setState('recording');

      timerRef.current = setInterval(() => {
        elapsedRef.current += 1;
        setElapsedSeconds(elapsedRef.current);
      }, 1000);
    } catch (err) {
      console.error('[record-and-submit] startRecording failed:', err);
      setError('Failed to start microphone');
    }
  }, [audioLevel]);

  const stop = useCallback(
    async (params: TParams) => {
      audioLevel.value = 0;
      smoothedRef.current = 0;
      await cleanupRecording();
      await submitRecording(params);
    },
    [cleanupRecording, submitRecording, audioLevel],
  );

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
