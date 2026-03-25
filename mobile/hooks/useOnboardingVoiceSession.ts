import { useRef, useCallback, useEffect } from 'react';
import { AppState } from 'react-native';
import {
  ExpoPlayAudioStream,
  PlaybackModes,
} from '@mykin-ai/expo-audio-stream';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useSessionStore } from '../stores/sessionStore';
import { wsUrl } from '../lib/api';

const PCM_BYTES_PER_SEC = 32000;

interface UseOnboardingVoiceSessionCallbacks {
  onComplete: (displayName: string | null, speechObservation: string | null, farewellMessage: string | null) => void;
  onError: (message: string) => void;
}

export function useOnboardingVoiceSession({ onComplete, onError }: UseOnboardingVoiceSessionCallbacks) {
  const wsRef = useRef<WebSocket | null>(null);
  const subscriptionRef = useRef<{ remove(): void } | null>(null);
  const isStoppingRef = useRef(false);
  const doneRef = useRef(false);
  const isRecordingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const appStateSubRef = useRef<{ remove(): void } | null>(null);

  const turnIdRef = useRef(0);
  const firstAudioTimeRef = useRef(0);
  const turnAudioBytesRef = useRef(0);
  const playbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingCompleteRef = useRef<{ displayName: string | null; speechObservation: string | null; farewellMessage: string | null } | null>(null);

  const store = useSessionStore;

  const cleanup = useCallback(async () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (playbackTimerRef.current) { clearTimeout(playbackTimerRef.current); playbackTimerRef.current = null; }
    subscriptionRef.current?.remove(); subscriptionRef.current = null;
    appStateSubRef.current?.remove(); appStateSubRef.current = null;

    if (isRecordingRef.current) {
      try { await ExpoPlayAudioStream.stopRecording(); } catch (e) { console.warn('[onboarding-voice] stopRecording error:', e); }
      isRecordingRef.current = false;
    }
    try { await ExpoPlayAudioStream.stopAudio(); } catch (e) { console.warn('[onboarding-voice] stopAudio error:', e); }

    if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
    deactivateKeepAwake();
    isStoppingRef.current = false;
    doneRef.current = false;
  }, []);

  const startMicAndTimer = useCallback(async () => {
    timerRef.current = setInterval(() => {
      store.getState().incrementElapsedTime();
    }, 1000);

    try {
      const { subscription } = await ExpoPlayAudioStream.startRecording({
        sampleRate: 16000,
        channels: 1,
        encoding: 'pcm_16bit',
        interval: 100,
        onAudioStream: async (event: any) => {
          const ws = wsRef.current;
          if (ws?.readyState === WebSocket.OPEN && event.data) {
            ws.send(JSON.stringify({ type: 'audio', data: event.data }));
          }
        },
      });
      isRecordingRef.current = true;
      if (subscription) subscriptionRef.current = subscription;
    } catch (e) {
      console.error('[onboarding-voice] startRecording failed:', e);
      onError('Failed to start microphone');
      cleanup();
      store.getState().endVoiceSession();
    }
  }, [cleanup, onError]);

  const handleMessage = useCallback((msg: any) => {
    const s = store.getState();

    switch (msg.type) {
      case 'ready':
        console.log('[onboarding-voice] Received ready, starting mic');
        startMicAndTimer();
        s.setVoiceSessionState('listening');
        break;

      case 'audio': {
        if (doneRef.current) break;
        if (firstAudioTimeRef.current === 0) firstAudioTimeRef.current = Date.now();
        const rawBytes = Math.ceil((msg.data?.length ?? 0) * 3 / 4);
        turnAudioBytesRef.current += rawBytes;
        const streamId = String(msg.turnId ?? turnIdRef.current);
        try { ExpoPlayAudioStream.playSound(msg.data, streamId, 'pcm_s16le'); } catch (e) { console.error('[onboarding-voice] playSound error:', e); }
        break;
      }

      case 'audio_end': {
        if (doneRef.current) break;
        const totalBytes = msg.totalAudioBytes ?? 0;
        const totalDurationMs = (totalBytes / PCM_BYTES_PER_SEC) * 1000;
        const elapsedSinceFirst = firstAudioTimeRef.current > 0 ? Date.now() - firstAudioTimeRef.current : 0;
        const remainingMs = Math.max(0, totalDurationMs - elapsedSinceFirst + 500);

        if (playbackTimerRef.current) clearTimeout(playbackTimerRef.current);
        playbackTimerRef.current = setTimeout(() => {
          playbackTimerRef.current = null;
          if (pendingCompleteRef.current) {
            const { displayName, speechObservation, farewellMessage } = pendingCompleteRef.current;
            pendingCompleteRef.current = null;
            store.getState().endVoiceSession();
            cleanup();
            onComplete(displayName, speechObservation, farewellMessage);
          } else {
            store.getState().setVoiceSessionState('listening');
          }
        }, remainingMs);
        break;
      }

      case 'turn_state': {
        if (msg.state === 'speaking') {
          s.setVoiceSessionState('speaking');
          turnIdRef.current = msg.turnId ?? turnIdRef.current + 1;
          firstAudioTimeRef.current = 0;
          turnAudioBytesRef.current = 0;
          if (playbackTimerRef.current) {
            clearTimeout(playbackTimerRef.current);
            playbackTimerRef.current = null;
          }
        }
        if (msg.state === 'listening' && turnAudioBytesRef.current === 0 && !playbackTimerRef.current) {
          s.setVoiceSessionState('listening');
        }
        break;
      }

      case 'onboarding_complete': {
        const displayName = msg.displayName ?? null;
        const speechObservation = msg.speechObservation ?? null;
        const farewellMessage = msg.farewellMessage ?? null;
        if (playbackTimerRef.current) {
          // Audio still playing — defer navigation until playback finishes
          pendingCompleteRef.current = { displayName, speechObservation, farewellMessage };
        } else {
          s.endVoiceSession();
          cleanup();
          onComplete(displayName, speechObservation, farewellMessage);
        }
        break;
      }

      case 'error':
        onError(msg.message || 'An error occurred');
        cleanup();
        s.endVoiceSession();
        break;
    }
  }, [startMicAndTimer, cleanup, onComplete, onError]);

  const start = useCallback(async () => {
    isStoppingRef.current = false;
    doneRef.current = false;
    const s = store.getState();
    s.startVoiceSession();
    s.resetElapsedTime();

    try { await activateKeepAwakeAsync(); } catch (e) { console.warn('[onboarding-voice] keepAwake error:', e); }

    try {
      await ExpoPlayAudioStream.setSoundConfig({
        sampleRate: 24000,
        playbackMode: PlaybackModes.CONVERSATION,
      });
    } catch (e) { console.error('[onboarding-voice] setSoundConfig failed:', e); }

    // Allow iOS AVAudioSession to fully initialize before audio arrives
    await new Promise(resolve => setTimeout(resolve, 400));

    const ws = new WebSocket(wsUrl('/voice-session') + '&mode=onboarding');
    wsRef.current = ws;

    ws.onopen = () => { ws.send(JSON.stringify({ type: 'start' })); };
    ws.onmessage = (event) => {
      try { handleMessage(JSON.parse(event.data)); } catch (e) { console.error('[onboarding-voice] message parse error:', e); }
    };
    ws.onerror = () => {
      onError("Couldn't connect. Check your connection and try again.");
      cleanup();
      s.endVoiceSession();
    };
    ws.onclose = () => {};

    appStateSubRef.current = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'background' && !doneRef.current) { stop(); }
    });
  }, [handleMessage, cleanup, onError]);

  const stop = useCallback(async () => {
    if (isStoppingRef.current) return;
    isStoppingRef.current = true;
    doneRef.current = true;

    store.getState().setVoiceSessionState('analyzing');

    if (playbackTimerRef.current) {
      clearTimeout(playbackTimerRef.current);
      playbackTimerRef.current = null;
    }

    if (isRecordingRef.current) {
      try { await ExpoPlayAudioStream.stopRecording(); } catch (e) { console.warn('[onboarding-voice] stopRecording error:', e); }
      isRecordingRef.current = false;
    }
    subscriptionRef.current?.remove(); subscriptionRef.current = null;
    try { await ExpoPlayAudioStream.stopAudio(); } catch (e) { console.warn('[onboarding-voice] stopAudio error:', e); }

    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }

    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'done' }));
    }
  }, []);

  const toggleMute = useCallback(async () => {
    const s = store.getState();
    const newMuted = !s.isMuted;
    s.setMuted(newMuted);

    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: newMuted ? 'mute' : 'unmute' }));
    }
  }, []);

  useEffect(() => {
    return () => { cleanup(); };
  }, [cleanup]);

  return { start, stop, toggleMute, cleanup };
}
