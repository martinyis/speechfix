import { useRef, useCallback, useState, useEffect } from 'react';
import { ExpoPlayAudioStream } from '@mykin-ai/expo-audio-stream';
import { authFetch, API_BASE_URL } from '../lib/api';
import { useAuthStore } from '../stores/authStore';
import type { PracticeResult, PracticeMode } from '../types/practice';

export type PracticeRecordingState = 'idle' | 'recording' | 'evaluating' | 'result';

const MAX_RECORDING_SECONDS = 15;

export function usePracticeRecording() {
  const [state, setState] = useState<PracticeRecordingState>('idle');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [result, setResult] = useState<PracticeResult | null>(null);
  const [error, setError] = useState<string | null>(null);

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
      formData.append('audio', {
        uri: `data:audio/pcm;base64,${audioBase64}`,
        type: 'audio/pcm',
        name: 'recording.pcm',
      } as any);
      formData.append('correctionId', String(correctionId));
      formData.append('mode', mode);
      if (scenario) {
        formData.append('scenario', scenario);
      }
      formData.append('sampleRate', '16000');
      formData.append('channels', '1');
      formData.append('encoding', 'pcm_16bit');

      const res = await fetch(`${API_BASE_URL}/practice/evaluate`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!res.ok) {
        throw new Error('Evaluation failed');
      }

      const data: PracticeResult = await res.json();
      setResult(data);
      setState('result');
    } catch {
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
      const { subscription } = await ExpoPlayAudioStream.startRecording({
        sampleRate: 16000,
        channels: 1,
        encoding: 'pcm_16bit',
        interval: 100,
        onAudioStream: async (event: any) => {
          if (event.data) {
            audioChunksRef.current.push(event.data);
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
        if (elapsedRef.current >= MAX_RECORDING_SECONDS) {
          // Auto-stop handled by the component calling stop()
        }
      }, 1000);
    } catch {
      setError('Failed to start microphone');
    }
  }, []);

  const stop = useCallback(async (
    correctionId: number,
    mode: PracticeMode,
    scenario?: string,
  ) => {
    await cleanupRecording();
    await submitRecording(correctionId, mode, scenario);
  }, [cleanupRecording, submitRecording]);

  const reset = useCallback(() => {
    audioChunksRef.current = [];
    elapsedRef.current = 0;
    setElapsedSeconds(0);
    setResult(null);
    setError(null);
    setState('idle');
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => { cleanupRecording(); };
  }, [cleanupRecording]);

  return { state, elapsedSeconds, result, error, start, stop, reset };
}
