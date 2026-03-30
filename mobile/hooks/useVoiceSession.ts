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
import type { Agent, Correction, FillerWord, FillerWordPosition, SessionDetail, SessionInsight } from '../types/session';

// -- WebSocket message types --

type VoiceMessage =
  | { type: 'ready' }
  | { type: 'audio'; data: string; turnId?: number }
  | { type: 'audio_end'; totalAudioBytes?: number }
  | { type: 'turn_state'; state: 'speaking' | 'listening'; turnId?: number }
  | { type: 'mute_state'; muted: boolean }
  | { type: 'session_end'; dbSessionId?: number; sessionId?: number; results?: {
      sentences: string[];
      corrections: Correction[];
      fillerWords: FillerWord[];
      fillerPositions: FillerWordPosition[];
      sessionInsights: SessionInsight[];
    }}
  | { type: 'session_ending' }
  | { type: 'correction'; index: number; data: any }
  | { type: 'analysis_complete'; dbSessionId?: number; data: any }
  | { type: 'agent_created'; agent: Agent }
  | { type: 'error'; message?: string };

// PCM 16kHz 16-bit mono = 32000 bytes/sec
const PCM_BYTES_PER_SEC = 32000;

interface UseVoiceSessionCallbacks {
  onSessionEnd: (results: SessionDetail, dbSessionId: number) => void;
  onError: (message: string) => void;
  onAgentCreated?: (agent: Agent) => void;
  onFirstCorrection?: () => void;
  agentId?: number | null;
}

export function useVoiceSession({ onSessionEnd, onError, onAgentCreated, onFirstCorrection, agentId }: UseVoiceSessionCallbacks) {
  const wsRef = useRef<WebSocket | null>(null);
  const subscriptionRef = useRef<{ remove(): void } | null>(null);
  const isStoppingRef = useRef(false);
  const doneRef = useRef(false);
  const isRecordingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const appStateSubRef = useRef<{ remove(): void } | null>(null);

  // Playback timing refs (from original voice-session.tsx)
  const turnIdRef = useRef(0);
  const firstAudioTimeRef = useRef(0);
  const turnAudioBytesRef = useRef(0);
  const playbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Use getState() to avoid stale closures
  const store = useSessionStore;

  const cleanup = useCallback(async () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (playbackTimerRef.current) {
      clearTimeout(playbackTimerRef.current);
      playbackTimerRef.current = null;
    }
    subscriptionRef.current?.remove();
    subscriptionRef.current = null;
    appStateSubRef.current?.remove();
    appStateSubRef.current = null;

    if (isRecordingRef.current) {
      try { await ExpoPlayAudioStream.stopRecording(); } catch (e) { console.warn('[voice-session] stopRecording error:', e); }
      isRecordingRef.current = false;
    }
    try { await ExpoPlayAudioStream.stopSound(); } catch (e) { console.warn('[voice-session] stopSound error:', e); }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    deactivateKeepAwake();
    isStoppingRef.current = false;
    doneRef.current = false;
  }, []);

  const startMicAndTimer = useCallback(async () => {
    // Start elapsed time timer
    timerRef.current = setInterval(() => {
      store.getState().incrementElapsedTime();
    }, 1000);

    // Start recording
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
      if (subscription) {
        subscriptionRef.current = subscription;
      }
    } catch (e) {
      console.error('[voice-session] startRecording failed:', e);
      onError('Failed to start microphone');
      cleanup();
      store.getState().endVoiceSession();
    }
  }, [cleanup, onError]);

  const handleMessage = useCallback((msg: VoiceMessage) => {
    const s = store.getState();

    switch (msg.type) {
      case 'ready':
        startMicAndTimer();
        s.setVoiceSessionState('listening');
        break;

      case 'audio': {
        if (doneRef.current) {
          console.log('[voice-session] BLOCKED audio chunk after doneRef=true');
          break;
        }
        // Track first audio time and bytes for playback estimation
        if (firstAudioTimeRef.current === 0) {
          firstAudioTimeRef.current = Date.now();
        }
        const rawBytes = Math.ceil((msg.data?.length ?? 0) * 3 / 4);
        turnAudioBytesRef.current += rawBytes;
        const streamId = String(msg.turnId ?? turnIdRef.current);
        try {
          ExpoPlayAudioStream.playSound(msg.data, streamId, 'pcm_s16le');
        } catch (e) { console.error('[voice-session] playSound error:', e); }
        break;
      }

      case 'audio_end': {
        if (doneRef.current) break;
        // Estimate remaining playback time before transitioning to 'listening'
        // PCM 16kHz 16-bit mono = 32000 bytes/sec
        const totalBytes = msg.totalAudioBytes ?? 0;
        const totalDurationMs = (totalBytes / PCM_BYTES_PER_SEC) * 1000;
        const elapsedSinceFirst = firstAudioTimeRef.current > 0
          ? Date.now() - firstAudioTimeRef.current
          : 0;
        const remainingMs = Math.max(0, totalDurationMs - elapsedSinceFirst + 500);

        if (playbackTimerRef.current) clearTimeout(playbackTimerRef.current);
        playbackTimerRef.current = setTimeout(() => {
          const current = store.getState();
          current.setVoiceSessionState(current.isMuted ? 'muted' : 'listening');
          playbackTimerRef.current = null;
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
        // For 'listening' without audio, apply immediately
        if (msg.state === 'listening' && turnAudioBytesRef.current === 0 && !playbackTimerRef.current) {
          s.setVoiceSessionState(s.isMuted ? 'muted' : 'listening');
        }
        break;
      }

      case 'mute_state':
        s.setMuted(msg.muted);
        break;

      case 'session_ending':
        doneRef.current = true;
        s.setVoiceSessionState('analyzing');
        break;

      case 'correction': {
        // First correction triggers streaming mode and navigation
        if (msg.index === 0) {
          s.startStreamingAnalysis();
          onFirstCorrection?.();
        }
        s.addStreamingCorrection(msg.data);
        break;
      }

      case 'analysis_complete': {
        if (playbackTimerRef.current) clearTimeout(playbackTimerRef.current);
        const dbId = msg.dbSessionId ?? 0;
        s.finalizeStreamingSession(dbId, msg.data, msg.data?.correctionIds);
        // Retrieve the finalized data from the store
        const finalized = store.getState().currentSessionData;
        if (finalized) {
          s.endVoiceSession();
          cleanup();
          onSessionEnd(finalized, dbId);
        }
        break;
      }

      case 'session_end': {
        if (playbackTimerRef.current) clearTimeout(playbackTimerRef.current);
        const dbSessionId = msg.dbSessionId ?? msg.sessionId ?? 0;
        // Build a SessionDetail-like object from the results
        const results: SessionDetail = {
          id: dbSessionId as number,
          transcription: '',
          durationSeconds: s.elapsedTime,
          createdAt: new Date().toISOString(),
          sentences: msg.results?.sentences ?? [],
          corrections: msg.results?.corrections ?? [],
          fillerWords: msg.results?.fillerWords ?? [],
          fillerPositions: msg.results?.fillerPositions ?? [],
          sessionInsights: msg.results?.sessionInsights ?? [],
        };
        s.setCurrentSession(dbSessionId, results);
        s.endVoiceSession();
        cleanup();
        onSessionEnd(results, dbSessionId);
        break;
      }

      case 'agent_created':
        if (msg.agent) {
          useAgentStore.getState().addAgent(msg.agent);
          onAgentCreated?.(msg.agent);
        }
        break;

      case 'error':
        onError(msg.message || 'An error occurred');
        cleanup();
        s.endVoiceSession();
        break;
    }
  }, [startMicAndTimer, cleanup, onSessionEnd, onError, onAgentCreated, onFirstCorrection]);

  const start = useCallback(async () => {
    isStoppingRef.current = false;
    doneRef.current = false;
    const s = store.getState();
    s.startVoiceSession();
    s.resetElapsedTime();

    try { await activateKeepAwakeAsync(); } catch (e) { console.warn('[voice-session] keepAwake error:', e); }

    // Request mic permissions
    const { granted } = await ExpoPlayAudioStream.requestPermissionsAsync();
    if (!granted) {
      onError('Microphone permission is required');
      s.endVoiceSession();
      return;
    }

    // Configure sound for conversation mode
    try {
      await ExpoPlayAudioStream.setSoundConfig({
        sampleRate: 24000,
        playbackMode: PlaybackModes.CONVERSATION,
      });
    } catch (e) { console.error('[voice-session] setSoundConfig failed:', e); }

    // Allow iOS AVAudioSession to fully initialize before audio arrives
    await new Promise(resolve => setTimeout(resolve, 400));

    // Connect WebSocket — append agent ID if selected
    const selectedAgent = agentId ?? useAgentStore.getState().selectedAgentId;
    let url = wsUrl('/voice-session');
    if (selectedAgent) {
      url += `&agent=${selectedAgent}`;
    }
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'start' }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        handleMessage(msg);
      } catch (e) { console.error('[voice-session] message parse error:', e); }
    };

    ws.onerror = () => {
      onError("Couldn't connect. Check your connection and try again.");
      cleanup();
      s.endVoiceSession();
    };

    ws.onclose = () => {};

    // Handle app backgrounding
    appStateSubRef.current = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'background' && !doneRef.current) {
        stop();
      }
    });
  }, [handleMessage, cleanup, onError]);

  const stop = useCallback(async () => {
    if (isStoppingRef.current) return;
    isStoppingRef.current = true;
    doneRef.current = true;
    console.log('[voice-session] stop() called');

    store.getState().setVoiceSessionState('analyzing');

    // Stop audio playback immediately so user hears silence
    try {
      await ExpoPlayAudioStream.stopSound();
      console.log('[voice-session] stopSound() resolved');
    } catch (e) { console.warn('[voice-session] stop: stopSound error:', e); }

    if (playbackTimerRef.current) {
      clearTimeout(playbackTimerRef.current);
      playbackTimerRef.current = null;
    }

    // Tell server to stop generating audio early
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'done' }));
      console.log('[voice-session] ws.send(done) sent');
    }

    // Stop mic (slow on iOS — no longer blocks UX)
    if (isRecordingRef.current) {
      try { await ExpoPlayAudioStream.stopRecording(); } catch (e) { console.warn('[voice-session] stop: stopRecording error:', e); }
      isRecordingRef.current = false;
    }
    subscriptionRef.current?.remove();
    subscriptionRef.current = null;

    // Stop timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    console.log('[voice-session] stop() complete');
  }, []);

  const toggleMute = useCallback(async () => {
    const s = store.getState();
    const newMuted = !s.isMuted;
    s.setMuted(newMuted);

    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: newMuted ? 'mute' : 'unmute' }));
    }

    // If muting while AI is speaking, stop audio playback
    if (newMuted && s.voiceSessionState === 'speaking') {
      try { await ExpoPlayAudioStream.stopSound(); } catch (e) { console.warn('[voice-session] mute: stopSound error:', e); }
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => { cleanup(); };
  }, [cleanup]);

  return { start, stop, toggleMute, cleanup };
}
