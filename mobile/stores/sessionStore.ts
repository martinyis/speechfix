import { create } from 'zustand';
import type { Correction, SessionDetail } from '../types/session';

export type VoiceSessionState =
  | 'connecting'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'analyzing'
  | 'muted'
  | 'done';

interface SessionStore {
  // Session data (passed between voice session and session-detail)
  currentSessionId: number | null;
  currentSessionData: SessionDetail | null;

  // Streaming analysis state
  isStreamingAnalysis: boolean;
  streamingCorrections: Correction[];

  // Voice session state (controls Home screen mode)
  isVoiceSessionActive: boolean;
  voiceSessionState: VoiceSessionState;
  elapsedTime: number;
  isMuted: boolean;

  // Actions
  setCurrentSession: (id: number, data: SessionDetail) => void;
  clearCurrentSession: () => void;
  startVoiceSession: () => void;
  endVoiceSession: () => void;
  setVoiceSessionState: (state: VoiceSessionState) => void;
  setMuted: (muted: boolean) => void;
  incrementElapsedTime: () => void;
  resetElapsedTime: () => void;

  // Streaming actions
  startStreamingAnalysis: () => void;
  addStreamingCorrection: (correction: Correction) => void;
  finalizeStreamingSession: (dbSessionId: number, data: {
    sentences?: string[];
    fillerWords?: any[];
    fillerPositions?: any[];
    sessionInsights?: any[];
    clarityScore?: number;
  }, correctionIds?: number[]) => void;
}

export const useSessionStore = create<SessionStore>((set, get) => ({
  currentSessionId: null,
  currentSessionData: null,
  isStreamingAnalysis: false,
  streamingCorrections: [],
  isVoiceSessionActive: false,
  voiceSessionState: 'connecting',
  elapsedTime: 0,
  isMuted: false,

  setCurrentSession: (id, data) =>
    set({ currentSessionId: id, currentSessionData: data }),

  clearCurrentSession: () =>
    set({ currentSessionId: null, currentSessionData: null }),

  startVoiceSession: () =>
    set({
      isVoiceSessionActive: true,
      voiceSessionState: 'connecting',
      elapsedTime: 0,
      isMuted: false,
      isStreamingAnalysis: false,
      streamingCorrections: [],
    }),

  endVoiceSession: () =>
    set({
      isVoiceSessionActive: false,
      voiceSessionState: 'done',
      isMuted: false,
    }),

  setVoiceSessionState: (state) => set({ voiceSessionState: state }),

  setMuted: (muted) =>
    set({
      isMuted: muted,
      voiceSessionState: muted ? 'muted' : 'listening',
    }),

  incrementElapsedTime: () =>
    set((s) => ({ elapsedTime: s.elapsedTime + 1 })),

  resetElapsedTime: () => set({ elapsedTime: 0 }),

  startStreamingAnalysis: () =>
    set((s) => ({
      isStreamingAnalysis: true,
      streamingCorrections: [],
      currentSessionData: {
        id: 0,
        transcription: '',
        durationSeconds: s.elapsedTime,
        createdAt: new Date().toISOString(),
        sentences: [],
        corrections: [],
        fillerWords: [],
        fillerPositions: [],
        sessionInsights: [],
      },
    })),

  addStreamingCorrection: (correction) => {
    const state = get();
    const updatedCorrections = [...state.streamingCorrections, correction];

    // Also update currentSessionData.corrections if it exists
    const updatedSessionData = state.currentSessionData
      ? { ...state.currentSessionData, corrections: updatedCorrections }
      : null;

    set({
      streamingCorrections: updatedCorrections,
      currentSessionData: updatedSessionData,
    });
  },

  finalizeStreamingSession: (dbSessionId, data, correctionIds) => {
    const state = get();
    const existing = state.currentSessionData;

    // Merge DB IDs into streamed corrections so practice buttons appear
    const mergedCorrections = state.streamingCorrections.map((c, i) => ({
      ...c,
      id: correctionIds?.[i] ?? c.id,
      sessionId: dbSessionId,
    }));

    // Merge streamed corrections with the rest of the session data
    const finalized: SessionDetail = {
      id: dbSessionId,
      transcription: existing?.transcription ?? '',
      durationSeconds: existing?.durationSeconds ?? state.elapsedTime,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      sentences: data.sentences ?? existing?.sentences ?? [],
      corrections: mergedCorrections,
      fillerWords: data.fillerWords ?? [],
      fillerPositions: data.fillerPositions ?? [],
      sessionInsights: data.sessionInsights ?? [],
    };

    set({
      isStreamingAnalysis: false,
      currentSessionId: dbSessionId,
      currentSessionData: finalized,
    });
  },
}));
