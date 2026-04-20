import { useCallback, useRef } from 'react';
import { useVoiceSessionCore, type CoreMessage } from './voice/useVoiceSessionCore';
import { useSessionStore } from '../stores/sessionStore';
import { useAgentStore } from '../stores/agentStore';
import { wsUrl } from '../lib/api';
import type { Agent } from '../types/session';

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
  const store = useSessionStore;
  const coreRef = useRef<ReturnType<typeof useVoiceSessionCore> | null>(null);
  const pendingAgentRef = useRef<Agent | null>(null);

  const handleMessage = useCallback(
    (msg: CoreMessage) => {
      const s = store.getState();
      const core = coreRef.current;

      switch (msg.type) {
        case 'session_ending':
          core?.markDone();
          s.setVoiceSessionState('analyzing');
          break;

        case 'agent_created': {
          const agent = msg.agent as Agent | undefined;
          if (!agent) break;
          if (core?.isPlaybackPending()) {
            pendingAgentRef.current = agent;
          } else {
            useAgentStore.getState().addAgent(agent);
            core?.markDone();
            s.endVoiceSession();
            core?.cleanup();
            onAgentCreated(agent);
          }
          break;
        }

        case 'playback_complete': {
          if (pendingAgentRef.current) {
            const agent = pendingAgentRef.current;
            pendingAgentRef.current = null;
            useAgentStore.getState().addAgent(agent);
            core?.markDone();
            store.getState().endVoiceSession();
            core?.cleanup();
            onAgentCreated(agent);
          }
          break;
        }

        case 'ws_error':
          onError("Couldn't connect. Check your connection and try again.");
          core?.cleanup();
          s.endVoiceSession();
          break;
      }
    },
    [onAgentCreated, onError],
  );

  const core = useVoiceSessionCore({
    wsUrl: () =>
      wsUrl('/voice-session') +
      '&mode=agent-creator&formContext=' +
      encodeURIComponent(JSON.stringify(formContext)),
    onMessage: handleMessage,
    onError,
    pcmBytesPerSec: 32000,
    playbackPaddingMs: 500,
    micStartBehavior: 'on-ready',
    avSessionInitDelayMs: 400,
    logTag: '[agent-creator-ws]',
  });

  coreRef.current = core;

  return {
    start: core.start,
    stop: core.stop,
    toggleMute: core.toggleMute,
    cleanup: core.cleanup,
  };
}
