import { create } from 'zustand';
import type { SessionDetail } from '../types/session';

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
}

export const useSessionStore = create<SessionStore>((set) => ({
  currentSessionId: null,
  currentSessionData: null,
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
}));
