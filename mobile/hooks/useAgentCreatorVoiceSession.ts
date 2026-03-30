import { useRef, useCallback, useEffect } from 'react';
import { AppState } from 'react-native';
import {
  ExpoPlayAudioStream,
  PlaybackModes,
} from '@mykin-ai/expo-audio-stream';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useSessionStore } from '../stores/sessionStore';
import { useAgentStore } from '../stores/agentStore';
import { wsUrl } from '../lib/api';
import type { Agent } from '../types/session';

const PCM_BYTES_PER_SEC = 32000;

interface FormContext {
  name: string;
  voiceId: string | null;
  description: string;
  focusArea: string;
  conversationStyle: string | null;
  customRules: string;
}

interface UseAgentCreatorVoiceSessionCallbacks {
  onAgentCreated: (agent: Agent) => void;
  onError: (message: string) => void;
  formContext: FormContext;
}

export function useAgentCreatorVoiceSession({
  onAgentCreated,
  onError,
  formContext,
}: UseAgentCreatorVoiceSessionCallbacks) {
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
  const pendingAgentRef = useRef<Agent | null>(null);

  const store = useSessionStore;

  const cleanup = useCallback(async () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (playbackTimerRef.current) { clearTimeout(playbackTimerRef.current); playbackTimerRef.current = null; }
    subscriptionRef.current?.remove(); subscriptionRef.current = null;
    appStateSubRef.current?.remove(); appStateSubRef.current = null;

    if (isRecordingRef.current) {
      try { await ExpoPlayAudioStream.stopRecording(); } catch {}
      isRecordingRef.current = false;
    }
    try { await ExpoPlayAudioStream.stopSound(); } catch {}

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
    } catch {
      onError('Failed to start microphone');
      cleanup();
      store.getState().endVoiceSession();
    }
  }, [cleanup, onError]);

  const handleMessage = useCallback((msg: any) => {
    const s = store.getState();

    switch (msg.type) {
      case 'ready':
        startMicAndTimer();
        s.setVoiceSessionState('listening');
        break;

      case 'audio': {
        if (doneRef.current) break;
        if (firstAudioTimeRef.current === 0) firstAudioTimeRef.current = Date.now();
        const rawBytes = Math.ceil((msg.data?.length ?? 0) * 3 / 4);
        turnAudioBytesRef.current += rawBytes;
        const streamId = String(msg.turnId ?? turnIdRef.current);
        try { ExpoPlayAudioStream.playSound(msg.data, streamId, 'pcm_s16le'); } catch {}
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
          if (pendingAgentRef.current) {
            const agent = pendingAgentRef.current;
            pendingAgentRef.current = null;
            useAgentStore.getState().addAgent(agent);
            store.getState().endVoiceSession();
            cleanup();
            onAgentCreated(agent);
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

      case 'session_ending':
        doneRef.current = true;
        s.setVoiceSessionState('analyzing');
        break;

      case 'agent_created': {
        if (msg.agent) {
          if (playbackTimerRef.current) {
            // Audio still playing — defer until playback finishes
            pendingAgentRef.current = msg.agent;
          } else {
            useAgentStore.getState().addAgent(msg.agent);
            s.endVoiceSession();
            cleanup();
            onAgentCreated(msg.agent);
          }
        }
        break;
      }

      case 'error':
        onError(msg.message || 'An error occurred');
        cleanup();
        s.endVoiceSession();
        break;
    }
  }, [startMicAndTimer, cleanup, onAgentCreated, onError]);

  const start = useCallback(async () => {
    isStoppingRef.current = false;
    doneRef.current = false;
    const s = store.getState();
    s.startVoiceSession();
    s.resetElapsedTime();

    try { await activateKeepAwakeAsync(); } catch {}

    const { granted } = await ExpoPlayAudioStream.requestPermissionsAsync();
    if (!granted) {
      onError('Microphone permission is required');
      s.endVoiceSession();
      return;
    }

    try {
      await ExpoPlayAudioStream.setSoundConfig({
        sampleRate: 24000,
        playbackMode: PlaybackModes.CONVERSATION,
      });
    } catch {}

    // Allow iOS AVAudioSession to fully initialize before audio arrives
    await new Promise(resolve => setTimeout(resolve, 400));

    const url = wsUrl('/voice-session') + '&mode=agent-creator&formContext=' + encodeURIComponent(JSON.stringify(formContext));
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => { ws.send(JSON.stringify({ type: 'start' })); };
    ws.onmessage = (event) => {
      try { handleMessage(JSON.parse(event.data)); } catch {}
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
  }, [handleMessage, cleanup, onError, formContext]);

  const stop = useCallback(async () => {
    if (isStoppingRef.current) return;
    isStoppingRef.current = true;
    doneRef.current = true;

    store.getState().setVoiceSessionState('analyzing');

    // Stop audio playback immediately so user hears silence
    try { await ExpoPlayAudioStream.stopSound(); } catch {}

    if (playbackTimerRef.current) {
      clearTimeout(playbackTimerRef.current);
      playbackTimerRef.current = null;
    }

    // Tell server to stop generating audio early
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'done' }));
    }

    // Stop mic (slow on iOS — no longer blocks UX)
    if (isRecordingRef.current) {
      try { await ExpoPlayAudioStream.stopRecording(); } catch {}
      isRecordingRef.current = false;
    }
    subscriptionRef.current?.remove(); subscriptionRef.current = null;

    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  const toggleMute = useCallback(async () => {
    const s = store.getState();
    const newMuted = !s.isMuted;
    s.setMuted(newMuted);

    // If muting while AI is speaking, stop audio playback
    if (newMuted && s.voiceSessionState === 'speaking') {
      try { await ExpoPlayAudioStream.stopSound(); } catch (e) { console.warn('[voice-session] mute: stopSound error:', e); }
    }

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
