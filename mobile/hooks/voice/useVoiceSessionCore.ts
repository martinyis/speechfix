import { useRef, useCallback, useEffect } from 'react';
import { AppState } from 'react-native';
import { ExpoPlayAudioStream, PlaybackModes } from '@mykin-ai/expo-audio-stream';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useSessionStore } from '../../stores/sessionStore';
import { computeRMS } from '../../lib/rms';
import { voiceAudioLevel } from '../../lib/voiceAudioLevel';

export type CoreMessage = {
  type: string;
  [k: string]: unknown;
};

export type MicStartBehavior = 'immediate' | 'on-ready';

export interface UseVoiceSessionCoreConfig {
  wsUrl: string | (() => string);
  startPayload?: Record<string, unknown>;
  onMessage: (msg: CoreMessage) => void;
  onError: (message: string) => void;
  pcmBytesPerSec?: number;
  playbackPaddingMs?: number;
  micStartBehavior?: MicStartBehavior;
  avSessionInitDelayMs?: number;
  logTag?: string;
}

export interface UseVoiceSessionCoreHandle {
  start: () => Promise<void>;
  stop: () => Promise<void>;
  toggleMute: () => Promise<void>;
  cleanup: () => Promise<void>;
  sendMessage: (msg: unknown) => void;
  wsRef: React.MutableRefObject<WebSocket | null>;
  markDone: () => void;
  isPlaybackPending: () => boolean;
  isDone: () => boolean;
}

export function useVoiceSessionCore(config: UseVoiceSessionCoreConfig): UseVoiceSessionCoreHandle {
  const {
    wsUrl,
    startPayload,
    onMessage,
    onError,
    pcmBytesPerSec = 32000,
    playbackPaddingMs = 500,
    micStartBehavior = 'on-ready',
    avSessionInitDelayMs = 400,
    logTag = '[voice-core]',
  } = config;

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
  const speakingEndRef = useRef(0);
  const cleanedUpRef = useRef(false);
  const smoothedLevelRef = useRef(0);

  const store = useSessionStore;

  const cleanup = useCallback(async () => {
    if (cleanedUpRef.current) return;
    cleanedUpRef.current = true;

    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (playbackTimerRef.current) { clearTimeout(playbackTimerRef.current); playbackTimerRef.current = null; }
    subscriptionRef.current?.remove(); subscriptionRef.current = null;
    appStateSubRef.current?.remove(); appStateSubRef.current = null;

    if (isRecordingRef.current) {
      try { await ExpoPlayAudioStream.stopRecording(); } catch (e) { console.warn(`${logTag} stopRecording error:`, e); }
      isRecordingRef.current = false;
    }
    try { await ExpoPlayAudioStream.stopSound(); } catch (e) { console.warn(`${logTag} stopSound error:`, e); }
    voiceAudioLevel.value = 0;
    smoothedLevelRef.current = 0;

    if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
    deactivateKeepAwake();
    isStoppingRef.current = false;
  }, [logTag]);

  const isOnb = logTag === '[onboarding-ws]';
  const firstMicChunkAfterPlaybackRef = useRef(true);

  const startMicAndTimer = useCallback(async () => {
    if (isRecordingRef.current) return;
    if (isOnb) console.log('[onb-timing] mic startRecording() begin');

    if (!timerRef.current) {
      timerRef.current = setInterval(() => {
        store.getState().incrementElapsedTime();
      }, 1000);
    }

    try {
      const { subscription } = await ExpoPlayAudioStream.startRecording({
        sampleRate: 48000,
        channels: 1,
        encoding: 'pcm_16bit',
        interval: 100,
        onAudioStream: async (event: any) => {
          const ws = wsRef.current;
          if (!ws || ws.readyState !== WebSocket.OPEN || !event.data) return;
          const s = store.getState();
          const isSpeaking = s.voiceSessionState === 'speaking';
          const inEchoGrace = speakingEndRef.current > 0 && Date.now() - speakingEndRef.current < 500;

          // Update mic amplitude for visuals. Zero it while the AI is speaking
          // or in echo grace so the overlay doesn't animate off playback bleed.
          if (isSpeaking || inEchoGrace) {
            smoothedLevelRef.current = smoothedLevelRef.current * 0.5;
            voiceAudioLevel.value = smoothedLevelRef.current;
          } else {
            try {
              const raw = computeRMS(event.data);
              const smoothed = smoothedLevelRef.current * 0.3 + raw * 0.7;
              smoothedLevelRef.current = smoothed;
              voiceAudioLevel.value = smoothed;
            } catch {}
          }

          if (isSpeaking) {
            firstMicChunkAfterPlaybackRef.current = true;
            return;
          }
          if (inEchoGrace) return;
          if (isOnb && firstMicChunkAfterPlaybackRef.current) {
            firstMicChunkAfterPlaybackRef.current = false;
            console.log('[onb-timing] first mic chunk forwarded after playback/echo-grace');
          }
          ws.send(JSON.stringify({ type: 'audio', data: event.data }));
        },
      });
      isRecordingRef.current = true;
      if (isOnb) console.log('[onb-timing] mic startRecording() resolved (recording live)');
      if (subscription) subscriptionRef.current = subscription;
    } catch (e) {
      console.error(`${logTag} startRecording failed:`, e);
      onError('Failed to start microphone');
      cleanup();
      store.getState().endVoiceSession();
    }
  }, [cleanup, onError, logTag]);

  const handleMessage = useCallback((msg: CoreMessage) => {
    const s = store.getState();

    switch (msg.type) {
      case 'ready':
        if (micStartBehavior === 'on-ready') {
          startMicAndTimer();
        } else if (!timerRef.current) {
          timerRef.current = setInterval(() => {
            store.getState().incrementElapsedTime();
          }, 1000);
        }
        s.setVoiceSessionState('listening');
        break;

      case 'audio': {
        if (doneRef.current) break;
        if (firstAudioTimeRef.current === 0) firstAudioTimeRef.current = Date.now();
        const rawBytes = Math.ceil(((msg.data as string | undefined)?.length ?? 0) * 3 / 4);
        turnAudioBytesRef.current += rawBytes;
        const streamId = String((msg.turnId as number | undefined) ?? turnIdRef.current);
        try {
          ExpoPlayAudioStream.playSound(msg.data as string, streamId, 'pcm_s16le');
        } catch (e) {
          console.error(`${logTag} playSound error:`, e);
        }
        break;
      }

      case 'audio_end': {
        if (doneRef.current) break;
        const totalBytes = (msg.totalAudioBytes as number | undefined) ?? 0;
        const totalDurationMs = (totalBytes / pcmBytesPerSec) * 1000;
        const elapsedSinceFirst = firstAudioTimeRef.current > 0 ? Date.now() - firstAudioTimeRef.current : 0;
        const remainingMs = Math.max(0, totalDurationMs - elapsedSinceFirst + playbackPaddingMs);

        if (isOnb) {
          console.log(
            `[onb-timing] audio_end math: totalBytes=${totalBytes} pcmBytesPerSec=${pcmBytesPerSec} ` +
            `→ estDurationMs=${totalDurationMs.toFixed(0)}, elapsedSinceFirst=${elapsedSinceFirst}, ` +
            `remainingMs=${remainingMs.toFixed(0)} (padding=${playbackPaddingMs})`,
          );
        }

        if (playbackTimerRef.current) clearTimeout(playbackTimerRef.current);
        playbackTimerRef.current = setTimeout(() => {
          speakingEndRef.current = Date.now();
          playbackTimerRef.current = null;
          onMessage({ type: 'playback_complete' });
          if (!doneRef.current) {
            const current = store.getState();
            current.setVoiceSessionState(current.isMuted ? 'muted' : 'listening');
          }
        }, remainingMs);
        break;
      }

      case 'turn_state': {
        const state = msg.state as 'speaking' | 'listening';
        if (state === 'speaking') {
          s.setVoiceSessionState('speaking');
          turnIdRef.current = (msg.turnId as number | undefined) ?? turnIdRef.current + 1;
          firstAudioTimeRef.current = 0;
          turnAudioBytesRef.current = 0;
          if (playbackTimerRef.current) {
            clearTimeout(playbackTimerRef.current);
            playbackTimerRef.current = null;
          }
        }
        if (state === 'listening' && turnAudioBytesRef.current === 0 && !playbackTimerRef.current) {
          s.setVoiceSessionState(s.isMuted ? 'muted' : 'listening');
        }
        break;
      }

      case 'mute_state':
        s.setMuted(msg.muted as boolean);
        break;

      case 'error':
        onError((msg.message as string | undefined) || 'An error occurred');
        cleanup();
        s.endVoiceSession();
        break;
    }

    onMessage(msg);
  }, [startMicAndTimer, cleanup, onMessage, onError, pcmBytesPerSec, playbackPaddingMs, micStartBehavior, logTag]);

  const start = useCallback(async () => {
    isStoppingRef.current = false;
    doneRef.current = false;
    cleanedUpRef.current = false;
    const s = store.getState();
    s.startVoiceSession();
    s.resetElapsedTime();

    try { await activateKeepAwakeAsync(); } catch (e) { console.warn(`${logTag} keepAwake error:`, e); }

    const { granted } = await ExpoPlayAudioStream.requestPermissionsAsync();
    if (!granted) {
      onError('Microphone permission is required');
      s.endVoiceSession();
      return;
    }

    try {
      await ExpoPlayAudioStream.setSoundConfig({
        sampleRate: 24000 as any,
        playbackMode: PlaybackModes.REGULAR,
      });
    } catch (e) { console.error(`${logTag} setSoundConfig failed:`, e); }

    if (micStartBehavior === 'immediate') {
      await startMicAndTimer();
      if (!isRecordingRef.current) {
        s.endVoiceSession();
        return;
      }
    } else {
      await new Promise((resolve) => setTimeout(resolve, avSessionInitDelayMs));
    }

    const resolvedUrl = typeof wsUrl === 'function' ? wsUrl() : wsUrl;
    const ws = new WebSocket(resolvedUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      if (isOnb) console.log('[onb-timing] WS onopen, sending "start"');
      ws.send(JSON.stringify({ type: 'start', ...(startPayload ?? {}) }));
    };
    ws.onmessage = (event) => {
      try {
        handleMessage(JSON.parse(event.data));
      } catch (e) {
        console.error(`${logTag} message parse error:`, e);
      }
    };
    ws.onerror = (e: any) => {
      console.error(`${logTag} WS error:`, e);
      onMessage({ type: 'ws_error', error: e });
    };
    ws.onclose = (event) => {
      onMessage({
        type: 'ws_close',
        code: event.code,
        reason: event.reason,
        wasDone: doneRef.current,
      });
    };

    appStateSubRef.current = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'background' && !doneRef.current) {
        stop();
      }
    });
  }, [wsUrl, startPayload, handleMessage, onError, onMessage, startMicAndTimer, micStartBehavior, avSessionInitDelayMs, logTag]);

  const stop = useCallback(async () => {
    if (isStoppingRef.current || cleanedUpRef.current) return;
    isStoppingRef.current = true;
    doneRef.current = true;

    store.getState().setVoiceSessionState('analyzing');

    try { await ExpoPlayAudioStream.stopSound(); } catch (e) { console.warn(`${logTag} stop: stopSound error:`, e); }

    if (playbackTimerRef.current) {
      clearTimeout(playbackTimerRef.current);
      playbackTimerRef.current = null;
    }

    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'done' }));
    }

    if (isRecordingRef.current) {
      try { await ExpoPlayAudioStream.stopRecording(); } catch (e) { console.warn(`${logTag} stop: stopRecording error:`, e); }
      isRecordingRef.current = false;
    }
    subscriptionRef.current?.remove();
    subscriptionRef.current = null;

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, [logTag]);

  const toggleMute = useCallback(async () => {
    const s = store.getState();
    const newMuted = !s.isMuted;
    s.setMuted(newMuted);

    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: newMuted ? 'mute' : 'unmute' }));
    }

    if (newMuted && s.voiceSessionState === 'speaking') {
      try { await ExpoPlayAudioStream.stopSound(); } catch (e) { console.warn(`${logTag} mute: stopSound error:`, e); }
    }
  }, [logTag]);

  const sendMessage = useCallback((msg: unknown) => {
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }, []);

  const markDone = useCallback(() => { doneRef.current = true; }, []);
  const isPlaybackPending = useCallback(() => playbackTimerRef.current !== null, []);
  const isDone = useCallback(() => doneRef.current, []);

  useEffect(() => {
    return () => { cleanup(); };
  }, [cleanup]);

  return {
    start,
    stop,
    toggleMute,
    cleanup,
    sendMessage,
    wsRef,
    markDone,
    isPlaybackPending,
    isDone,
  };
}
