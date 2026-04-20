import { useCallback, useRef } from 'react';
import { useVoiceSessionCore, type CoreMessage } from './voice/useVoiceSessionCore';
import { useSessionStore } from '../stores/sessionStore';
import { wsUrl, authFetch } from '../lib/api';

interface UseOnboardingVoiceSessionCallbacks {
  onComplete: (
    displayName: string | null,
    speechObservation: string | null,
    farewellMessage: string | null,
  ) => void;
  onError: (message: string) => void;
}

export function useOnboardingVoiceSession({ onComplete, onError }: UseOnboardingVoiceSessionCallbacks) {
  const store = useSessionStore;
  const coreRef = useRef<ReturnType<typeof useVoiceSessionCore> | null>(null);
  const pendingCompleteRef = useRef<{
    displayName: string | null;
    speechObservation: string | null;
    farewellMessage: string | null;
  } | null>(null);
  const completedRef = useRef(false);

  const silentSkip = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    authFetch('/onboarding/skip', { method: 'POST' }).catch(() => {});
    coreRef.current?.cleanup();
    store.getState().endVoiceSession();
    onComplete(null, null, null);
  }, [onComplete]);

  const handleMessage = useCallback(
    (msg: CoreMessage) => {
      const core = coreRef.current;

      switch (msg.type) {
        case 'onboarding_complete': {
          core?.markDone();
          const displayName = (msg.displayName as string | null | undefined) ?? null;
          const speechObservation = (msg.speechObservation as string | null | undefined) ?? null;
          const farewellMessage = (msg.farewellMessage as string | null | undefined) ?? null;
          console.log('[onboarding] Server sent onboarding_complete', {
            hasPendingAudio: core?.isPlaybackPending(),
          });

          if (core?.isPlaybackPending()) {
            pendingCompleteRef.current = { displayName, speechObservation, farewellMessage };
          } else if (!completedRef.current) {
            completedRef.current = true;
            store.getState().endVoiceSession();
            core?.cleanup();
            onComplete(displayName, speechObservation, farewellMessage);
          }
          break;
        }

        case 'playback_complete': {
          if (pendingCompleteRef.current && !completedRef.current) {
            completedRef.current = true;
            const { displayName, speechObservation, farewellMessage } = pendingCompleteRef.current;
            pendingCompleteRef.current = null;
            store.getState().endVoiceSession();
            core?.cleanup();
            onComplete(displayName, speechObservation, farewellMessage);
          }
          break;
        }

        case 'ws_error':
          console.error('[onboarding] WebSocket error');
          if (!core?.isDone()) silentSkip();
          break;

        case 'ws_close':
          console.warn('[onboarding] WebSocket closed', {
            code: msg.code,
            reason: msg.reason,
            wasDone: msg.wasDone,
          });
          if (!msg.wasDone) silentSkip();
          break;
      }
    },
    [onComplete, silentSkip],
  );

  const core = useVoiceSessionCore({
    wsUrl: () => wsUrl('/voice-session') + '&mode=onboarding',
    onMessage: handleMessage,
    onError,
    pcmBytesPerSec: 32000,
    playbackPaddingMs: 500,
    micStartBehavior: 'on-ready',
    avSessionInitDelayMs: 400,
    logTag: '[onboarding-ws]',
  });

  coreRef.current = core;

  return {
    start: core.start,
    stop: core.stop,
    toggleMute: core.toggleMute,
    cleanup: core.cleanup,
  };
}
