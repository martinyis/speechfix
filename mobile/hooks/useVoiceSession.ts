import { useRef, useCallback, useEffect } from 'react';
import { AppState } from 'react-native';
import {
  ExpoPlayAudioStream,
  PlaybackModes,
} from '@mykin-ai/expo-audio-stream';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import * as FileSystem from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';
import { useSessionStore } from '../stores/sessionStore';
import { useAgentStore } from '../stores/agentStore';
import { wsUrl, authFetch, API_BASE_URL } from '../lib/api';
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
  | { type: 'insights_ready'; dbSessionId?: number; data: any }
  | { type: 'analysis_complete'; dbSessionId?: number; data: any }
  | { type: 'agent_created'; agent: Agent }
  | { type: 'error'; message?: string };

// PCM 24kHz 16-bit mono = 48000 bytes/sec (matches Cartesia TTS output)
const PCM_BYTES_PER_SEC = 48000;

// ── Timing / debug logger ──────────────────────────────────────────────
const T0 = { v: 0 };                       // session-relative epoch
const t = () => T0.v ? Date.now() - T0.v : 0; // ms since session start
const TAG = '[voice-timing]';
const tlog = (...args: unknown[]) => console.log(TAG, `+${t()}ms`, ...args);

interface UseVoiceSessionCallbacks {
  onSessionEnd: (results: SessionDetail, dbSessionId: number) => void;
  onError: (message: string) => void;
  onAgentCreated?: (agent: Agent) => void;
  onInsightsReady?: () => void;
  agentId?: number | null;
  mode?: string;
  formContext?: Record<string, unknown>;
}

export function useVoiceSession({ onSessionEnd, onError, onAgentCreated, onInsightsReady, agentId, mode, formContext }: UseVoiceSessionCallbacks) {
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

  // Track audio chunks sent for periodic logging
  const audioChunkCountRef = useRef(0);

  // Hi-fi mic gating: suppress mic WS forwarding while AI is speaking and for
  // 500ms after TTS ends (echo grace), since we disabled hardware AEC by
  // switching to AVAudioSession mode .default.
  const speakingEndRef = useRef(0);

  const startTimer = useCallback(() => {
    tlog('⏱ startTimer');
    timerRef.current = setInterval(() => {
      store.getState().incrementElapsedTime();
    }, 1000);
  }, []);

  // Track per-turn audio chunk count for logging
  const turnAudioChunksRef = useRef(0);
  const turnSpeakingStartRef = useRef(0);

  const handleMessage = useCallback((msg: VoiceMessage) => {
    const s = store.getState();

    switch (msg.type) {
      case 'ready':
        tlog('📩 ready — server ready, starting timer');
        startTimer();
        s.setVoiceSessionState('listening');
        break;

      case 'audio': {
        if (doneRef.current) {
          tlog('⛔ audio chunk BLOCKED (doneRef=true)');
          break;
        }
        // Track first audio time and bytes for playback estimation
        if (firstAudioTimeRef.current === 0) {
          firstAudioTimeRef.current = Date.now();
          const latency = turnSpeakingStartRef.current > 0
            ? Date.now() - turnSpeakingStartRef.current
            : '?';
          tlog(`🔊 FIRST audio chunk for turn ${msg.turnId ?? turnIdRef.current} — ${latency}ms after turn_state:speaking, base64.len=${msg.data?.length ?? 0}`);
        }
        turnAudioChunksRef.current++;
        const rawBytes = Math.ceil((msg.data?.length ?? 0) * 3 / 4);
        turnAudioBytesRef.current += rawBytes;
        const streamId = String(msg.turnId ?? turnIdRef.current);
        try {
          ExpoPlayAudioStream.playSound(msg.data, streamId, 'pcm_s16le');
        } catch (e: any) {
          tlog('🔊 playSound THREW:', {
            name: e?.name,
            message: e?.message,
            code: e?.code,
            stack: e?.stack,
            streamId,
            chunkIndex: turnAudioChunksRef.current,
            base64Len: msg.data?.length ?? 0,
          });
          console.error('[voice-session] playSound error:', e);
        }
        // Log every 20 audio chunks to track flow
        if (turnAudioChunksRef.current % 20 === 0) {
          tlog(`🔊 received ${turnAudioChunksRef.current} audio chunks, ${(turnAudioBytesRef.current / 1024).toFixed(1)}KB total`);
        }
        break;
      }

      case 'audio_end': {
        if (doneRef.current) {
          tlog('⛔ audio_end BLOCKED (doneRef=true)');
          break;
        }
        // Estimate remaining playback time before transitioning to 'listening'
        const totalBytes = msg.totalAudioBytes ?? 0;
        const totalDurationMs = (totalBytes / PCM_BYTES_PER_SEC) * 1000;
        const elapsedSinceFirst = firstAudioTimeRef.current > 0
          ? Date.now() - firstAudioTimeRef.current
          : 0;
        const remainingMs = Math.max(0, totalDurationMs - elapsedSinceFirst + 200);

        tlog(`🔊 audio_end — turn ${turnIdRef.current}: ${turnAudioChunksRef.current} chunks, ${(turnAudioBytesRef.current / 1024).toFixed(1)}KB, totalDuration=${totalDurationMs.toFixed(0)}ms, elapsed=${elapsedSinceFirst}ms, remaining=${remainingMs.toFixed(0)}ms`);

        if (playbackTimerRef.current) clearTimeout(playbackTimerRef.current);
        playbackTimerRef.current = setTimeout(() => {
          tlog(`⏱ playback timer fired — transitioning to listening (was waiting ${remainingMs.toFixed(0)}ms)`);
          speakingEndRef.current = Date.now(); // start echo grace window
          const current = store.getState();
          current.setVoiceSessionState(current.isMuted ? 'muted' : 'listening');
          playbackTimerRef.current = null;
        }, remainingMs);
        break;
      }

      case 'turn_state': {
        tlog(`📩 turn_state: ${msg.state}, turnId=${msg.turnId}`);
        if (msg.state === 'speaking') {
          s.setVoiceSessionState('speaking');
          turnIdRef.current = msg.turnId ?? turnIdRef.current + 1;
          firstAudioTimeRef.current = 0;
          turnAudioBytesRef.current = 0;
          turnAudioChunksRef.current = 0;
          turnSpeakingStartRef.current = Date.now();
          if (playbackTimerRef.current) {
            clearTimeout(playbackTimerRef.current);
            playbackTimerRef.current = null;
          }
        }
        // For 'listening' without audio, apply immediately
        if (msg.state === 'listening' && turnAudioBytesRef.current === 0 && !playbackTimerRef.current) {
          tlog('📩 turn_state: listening (no audio received — immediate transition)');
          s.setVoiceSessionState(s.isMuted ? 'muted' : 'listening');
        }
        break;
      }

      case 'mute_state':
        tlog(`📩 mute_state: ${msg.muted}`);
        s.setMuted(msg.muted);
        break;

      case 'session_ending':
        tlog('📩 session_ending');
        doneRef.current = true;
        s.setVoiceSessionState('analyzing');
        break;

      case 'insights_ready': {
        tlog('📩 insights_ready — dbSessionId:', msg.dbSessionId);
        const dbId = msg.dbSessionId ?? 0;
        s.setInsightsReady(dbId, msg.data);
        onInsightsReady?.();
        break;
      }

      case 'correction': {
        tlog(`📩 correction #${msg.index}`);
        // If insights haven't arrived yet (fallback), start streaming mode
        if (!store.getState().isInsightsReady && msg.index === 0) {
          s.startStreamingAnalysis();
        }
        s.addStreamingCorrection(msg.data);
        break;
      }

      case 'analysis_complete': {
        tlog('📩 analysis_complete — dbSessionId:', msg.dbSessionId);
        if (playbackTimerRef.current) clearTimeout(playbackTimerRef.current);
        const dbId = msg.dbSessionId ?? 0;
        s.finalizeStreamingSession(dbId, msg.data, msg.data?.correctionIds);
        // Fire-and-forget hi-fi upload before cleanup tears down the audio session
        if (dbId > 0) {
          uploadHiFiAudio(dbId).catch((e) => console.warn('[voice-session] hifi upload error:', e));
        }
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
        tlog('📩 session_end — dbSessionId:', msg.dbSessionId ?? msg.sessionId);
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
        tlog('📩 agent_created:', msg.agent?.name);
        if (msg.agent) {
          useAgentStore.getState().addAgent(msg.agent);
          onAgentCreated?.(msg.agent);
        }
        break;

      case 'error':
        tlog('📩 ERROR:', msg.message);
        onError(msg.message || 'An error occurred');
        cleanup();
        s.endVoiceSession();
        break;
    }
  }, [startTimer, cleanup, onSessionEnd, onError, onAgentCreated, onInsightsReady]);

  const start = useCallback(async () => {
    T0.v = Date.now();
    tlog('▶ start() called');
    isStoppingRef.current = false;
    doneRef.current = false;
    const s = store.getState();
    s.startVoiceSession();
    s.resetElapsedTime();

    try { await activateKeepAwakeAsync(); } catch (e) { console.warn('[voice-session] keepAwake error:', e); }

    // Request mic permissions
    const { granted } = await ExpoPlayAudioStream.requestPermissionsAsync();
    tlog('mic permission:', granted ? 'granted' : 'DENIED');
    if (!granted) {
      onError('Microphone permission is required');
      s.endVoiceSession();
      return;
    }

    // Configure sound for REGULAR mode (not CONVERSATION) — avoids software
    // voice processing on the output path for hi-fi playback quality.
    // Trade-off: barge-in is disabled (mic gated while AI speaks).
    try {
      await ExpoPlayAudioStream.setSoundConfig({
        sampleRate: 24000,
        playbackMode: PlaybackModes.REGULAR,
      });
      tlog('setSoundConfig done (REGULAR mode)');
    } catch (e) { console.error('[voice-session] setSoundConfig failed:', e); }

    // Start recording BEFORE connecting WebSocket.
    // On iOS, the AVAudioSession audio route is only fully activated when
    // recording begins. Starting it early ensures playback works when the
    // greeting audio arrives. Mic chunks are safely dropped until the WS opens.
    audioChunkCountRef.current = 0;
    try {
      const { subscription } = await ExpoPlayAudioStream.startRecording({
        sampleRate: 48000,
        channels: 1,
        encoding: 'pcm_16bit',
        interval: 100,
        onAudioStream: async (event: any) => {
          const ws = wsRef.current;
          if (!ws || ws.readyState !== WebSocket.OPEN || !event.data) return;
          // Mic gating: suppress during AI speech + 500ms echo grace
          const s = store.getState();
          if (s.voiceSessionState === 'speaking') return;
          if (speakingEndRef.current > 0 && Date.now() - speakingEndRef.current < 500) return;
          ws.send(JSON.stringify({ type: 'audio', data: event.data }));
          audioChunkCountRef.current++;
          if (audioChunkCountRef.current % 50 === 0) {
            tlog(`🎙 sent ${audioChunkCountRef.current} mic chunks (${(audioChunkCountRef.current * 0.1).toFixed(1)}s of audio)`);
          }
        },
      });
      isRecordingRef.current = true;
      if (subscription) subscriptionRef.current = subscription;
      tlog('🎙 recording started (audio session active)');
    } catch (e) {
      tlog('🎙 startRecording FAILED:', e);
      console.error('[voice-session] startRecording failed:', e);
      onError('Failed to start microphone');
      s.endVoiceSession();
      return;
    }

    // Connect WebSocket — append agent ID, mode, or formContext if provided
    // System modes (filler-coach, onboarding, etc.) use their own handler — never send an agent ID
    const selectedAgent = mode ? null : (agentId ?? useAgentStore.getState().selectedAgentId);
    let url = wsUrl('/voice-session');
    if (selectedAgent) {
      url += `&agent=${selectedAgent}`;
    }
    if (mode) {
      url += `&mode=${encodeURIComponent(mode)}`;
    }
    if (formContext) {
      url += `&formContext=${encodeURIComponent(JSON.stringify(formContext))}`;
    }
    tlog('connecting WS…');
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      tlog('WS open — sending {start}');
      ws.send(JSON.stringify({ type: 'start' }));
    };

    ws.onmessage = (event) => {
      tlog('📥 WS raw message len=', event.data?.length ?? 0);
      try {
        const msg = JSON.parse(event.data);
        tlog('🔀 dispatch type=', msg?.type);
        handleMessage(msg);
      } catch (e) {
        tlog('📥 WS message parse/handle ERROR:', e);
        console.error('[voice-session] message parse error:', e);
      }
    };

    ws.onerror = (e: any) => {
      tlog('WS error:', { message: e?.message, type: e?.type, isTrusted: e?.isTrusted, url });
      console.error('[voice-session] WS error:', e);
      onError("Couldn't connect. Check your connection and try again.");
      cleanup();
      s.endVoiceSession();
    };

    ws.onclose = (e) => {
      tlog('WS close — code:', e.code, 'reason:', e.reason, 'clean:', e.wasClean);
    };

    // Handle app backgrounding
    appStateSubRef.current = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'background' && !doneRef.current) {
        stop();
      }
    });
  }, [handleMessage, cleanup, onError, mode, formContext]);

  const stop = useCallback(async () => {
    if (isStoppingRef.current) return;
    isStoppingRef.current = true;
    doneRef.current = true;
    tlog('⏹ stop() called — total mic chunks sent:', audioChunkCountRef.current);

    store.getState().setVoiceSessionState('analyzing');

    // Stop audio playback immediately so user hears silence
    try {
      await ExpoPlayAudioStream.stopSound();
      tlog('⏹ stopSound() resolved');
    } catch (e) { console.warn('[voice-session] stop: stopSound error:', e); }

    if (playbackTimerRef.current) {
      clearTimeout(playbackTimerRef.current);
      playbackTimerRef.current = null;
    }

    // Tell server to stop generating audio early
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'done' }));
      tlog('⏹ ws.send(done) sent');
    }

    // Stop mic (slow on iOS — no longer blocks UX)
    if (isRecordingRef.current) {
      const micStopStart = Date.now();
      try { await ExpoPlayAudioStream.stopRecording(); } catch (e) { console.warn('[voice-session] stop: stopRecording error:', e); }
      tlog(`⏹ stopRecording took ${Date.now() - micStopStart}ms`);
      isRecordingRef.current = false;
    }
    subscriptionRef.current?.remove();
    subscriptionRef.current = null;

    // Stop timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    tlog('⏹ stop() complete');
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

  /**
   * Upload the hi-fi M4A file to POST /sessions/:id/raw-audio.
   * On failure, queues the (sessionId, filePath) pair in SecureStore for retry.
   */
  const uploadHiFiAudio = useCallback(async (dbSessionId: number) => {
    try {
      const hiFiPath = await ExpoPlayAudioStream.getHighFidelityRecordingPath?.();
      if (!hiFiPath) {
        tlog('⏫ No hi-fi file to upload');
        return;
      }
      tlog(`⏫ Uploading hi-fi M4A for session ${dbSessionId}: ${hiFiPath}`);
      const token = await SecureStore.getItemAsync('auth_token');
      const uploadResult = await FileSystem.uploadAsync(
        `${API_BASE_URL}/sessions/${dbSessionId}/raw-audio`,
        hiFiPath,
        {
          httpMethod: 'POST',
          uploadType: FileSystem.FileSystemUploadType.MULTIPART,
          fieldName: 'file',
          mimeType: 'audio/mp4',
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        }
      );
      if (uploadResult.status >= 200 && uploadResult.status < 300) {
        tlog(`⏫ Hi-fi upload success (${uploadResult.status})`);
        await FileSystem.deleteAsync(hiFiPath, { idempotent: true });
      } else {
        throw new Error(`HTTP ${uploadResult.status}`);
      }
    } catch (err) {
      tlog('⏫ Hi-fi upload failed, queueing for retry:', err);
      try {
        const existing = await SecureStore.getItemAsync('reflexa:hifi-upload-queue');
        const queue: Array<{ sessionId: number; path: string }> = existing ? JSON.parse(existing) : [];
        const hiFiPath = await ExpoPlayAudioStream.getHighFidelityRecordingPath?.();
        if (hiFiPath) {
          queue.push({ sessionId: dbSessionId, path: hiFiPath });
          await SecureStore.setItemAsync('reflexa:hifi-upload-queue', JSON.stringify(queue));
        }
      } catch (qErr) {
        console.warn('[voice-session] Failed to queue hi-fi upload:', qErr);
      }
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => { cleanup(); };
  }, [cleanup]);

  return { start, stop, toggleMute, cleanup, uploadHiFiAudio };
}
