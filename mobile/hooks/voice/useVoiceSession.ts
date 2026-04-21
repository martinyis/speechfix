import { useCallback, useRef } from 'react';
import * as FileSystem from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';
import { ExpoPlayAudioStream } from '@mykin-ai/expo-audio-stream';
import { useVoiceSessionCore, type CoreMessage } from './useVoiceSessionCore';
import { useSessionStore } from '../../stores/sessionStore';
import { useAgentStore } from '../../stores/agentStore';
import { wsUrl, API_BASE_URL } from '../../lib/api';
import type { Agent, SessionDetail } from '../../types/session';

const T0 = { v: 0 };
const t = () => (T0.v ? Date.now() - T0.v : 0);
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

export function useVoiceSession({
  onSessionEnd,
  onError,
  onAgentCreated,
  onInsightsReady,
  agentId,
  mode,
  formContext,
}: UseVoiceSessionCallbacks) {
  const store = useSessionStore;
  const coreRef = useRef<ReturnType<typeof useVoiceSessionCore> | null>(null);

  const uploadHiFiAudio = useCallback(async (dbSessionId: number) => {
    try {
      const hiFiPath = await (ExpoPlayAudioStream as any).getHighFidelityRecordingPath?.();
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
          uploadType: (FileSystem as any).FileSystemUploadType.MULTIPART,
          fieldName: 'file',
          mimeType: 'audio/mp4',
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        },
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
        const hiFiPath = await (ExpoPlayAudioStream as any).getHighFidelityRecordingPath?.();
        if (hiFiPath) {
          queue.push({ sessionId: dbSessionId, path: hiFiPath });
          await SecureStore.setItemAsync('reflexa:hifi-upload-queue', JSON.stringify(queue));
        }
      } catch (qErr) {
        console.warn('[voice-session] Failed to queue hi-fi upload:', qErr);
      }
    }
  }, []);

  const handleMessage = useCallback(
    (msg: CoreMessage) => {
      const s = store.getState();
      const core = coreRef.current;

      switch (msg.type) {
        case 'session_ending':
          tlog('📩 session_ending');
          core?.markDone();
          s.setVoiceSessionState('analyzing');
          break;

        case 'insights_ready': {
          tlog('📩 insights_ready — dbSessionId:', msg.dbSessionId);
          const dbId = (msg.dbSessionId as number | undefined) ?? 0;
          s.setInsightsReady(dbId, msg.data as any);
          onInsightsReady?.();
          break;
        }

        case 'correction': {
          tlog(`📩 correction #${msg.index}`);
          if (!store.getState().isInsightsReady && msg.index === 0) {
            s.startStreamingAnalysis();
          }
          s.addStreamingCorrection(msg.data as any);
          break;
        }

        case 'analysis_complete': {
          tlog('📩 analysis_complete — dbSessionId:', msg.dbSessionId);
          const dbId = (msg.dbSessionId as number | undefined) ?? 0;
          s.finalizeStreamingSession(dbId, msg.data as any, (msg.data as any)?.correctionIds);
          if (dbId > 0) {
            uploadHiFiAudio(dbId).catch((e) => console.warn('[voice-session] hifi upload error:', e));
          }
          const finalized = store.getState().currentSessionData;
          if (finalized) {
            core?.markDone();
            s.endVoiceSession();
            core?.cleanup();
            onSessionEnd(finalized, dbId);
          }
          break;
        }

        case 'session_end': {
          tlog('📩 session_end — dbSessionId:', msg.dbSessionId ?? msg.sessionId);
          const dbSessionId =
            ((msg.dbSessionId as number | undefined) ?? (msg.sessionId as number | undefined)) ?? 0;
          const results: SessionDetail = {
            id: dbSessionId,
            transcription: '',
            durationSeconds: s.elapsedTime,
            createdAt: new Date().toISOString(),
            sentences: (msg.results as any)?.sentences ?? [],
            corrections: (msg.results as any)?.corrections ?? [],
            fillerWords: (msg.results as any)?.fillerWords ?? [],
            fillerPositions: (msg.results as any)?.fillerPositions ?? [],
            sessionInsights: (msg.results as any)?.sessionInsights ?? [],
          };
          s.setCurrentSession(dbSessionId, results);
          core?.markDone();
          s.endVoiceSession();
          core?.cleanup();
          onSessionEnd(results, dbSessionId);
          break;
        }

        case 'agent_created':
          tlog('📩 agent_created:', (msg.agent as any)?.name);
          if (msg.agent) {
            useAgentStore.getState().addAgent(msg.agent as Agent);
            onAgentCreated?.(msg.agent as Agent);
          }
          break;

        case 'ws_error':
          tlog('WS error — surfacing');
          onError("Couldn't connect. Check your connection and try again.");
          core?.cleanup();
          s.endVoiceSession();
          break;

        case 'ws_close':
          tlog('WS close — code:', msg.code, 'reason:', msg.reason, 'wasDone:', msg.wasDone);
          break;
      }
    },
    [onInsightsReady, onSessionEnd, onAgentCreated, onError, uploadHiFiAudio],
  );

  const core = useVoiceSessionCore({
    wsUrl: () => {
      const selectedAgent = mode ? null : (agentId ?? useAgentStore.getState().selectedAgentId);
      let url = wsUrl('/voice-session');
      if (selectedAgent) url += `&agent=${selectedAgent}`;
      if (mode) url += `&mode=${encodeURIComponent(mode)}`;
      if (formContext) url += `&formContext=${encodeURIComponent(JSON.stringify(formContext))}`;
      return url;
    },
    onMessage: handleMessage,
    onError,
    pcmBytesPerSec: 48000,
    playbackPaddingMs: 200,
    micStartBehavior: 'immediate',
    logTag: '[voice-session]',
  });

  coreRef.current = core;

  const start = useCallback(async () => {
    T0.v = Date.now();
    tlog('▶ start() called');
    await core.start();
  }, [core]);

  return {
    start,
    stop: core.stop,
    toggleMute: core.toggleMute,
    cleanup: core.cleanup,
    uploadHiFiAudio,
  };
}
