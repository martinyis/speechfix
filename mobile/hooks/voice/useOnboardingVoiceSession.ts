import { useCallback, useRef } from 'react';
import { useVoiceSessionCore, type CoreMessage } from './useVoiceSessionCore';
import { useSessionStore } from '../../stores/sessionStore';
import { wsUrl, authFetch } from '../../lib/api';

const T0 = { v: 0 };
const t = () => (T0.v ? Date.now() - T0.v : 0);
const tlog = (...args: unknown[]) => console.log('[onb-timing]', `+${t()}ms`, ...args);

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
  const firstAudioTurnRef = useRef<number | null>(null);

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

      // Per-message timing breadcrumbs for diagnosing onboarding lag
      switch (msg.type) {
        case 'ready':
          tlog('WS "ready" received (server handshake complete)');
          break;
        case 'turn_state':
          tlog(`turn_state → ${String((msg as any).state)} turnId=${String((msg as any).turnId)}`);
          if ((msg as any).state === 'speaking') {
            firstAudioTurnRef.current = null; // reset so next turn's first audio logs
          }
          break;
        case 'audio': {
          const tid = (msg as any).turnId as number | undefined;
          if (firstAudioTurnRef.current !== tid) {
            firstAudioTurnRef.current = tid ?? null;
            tlog(`audio chunk (first of turn ${tid}) received`);
          }
          break;
        }
        case 'audio_end':
          tlog(`audio_end turnId=${String((msg as any).turnId)} bytes=${String((msg as any).totalAudioBytes)}`);
          break;
        case 'playback_complete':
          tlog('playback_complete (mic re-enables now)');
          break;
        case 'transcript':
          tlog(`transcript final=${String((msg as any).final)}: "${String((msg as any).text ?? '').slice(0, 60)}"`);
          break;
        default:
          break;
      }

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
    // Cartesia emits pcm_s16le @ 24000 Hz mono = 48000 bytes/sec.
    // Matching the regular session avoids inflating post-AI mic-block time.
    pcmBytesPerSec: 48000,
    playbackPaddingMs: 200,
    micStartBehavior: 'immediate',
    logTag: '[onboarding-ws]',
  });

  coreRef.current = core;

  const start = useCallback(async () => {
    T0.v = Date.now();
    tlog('▶ start() called');
    await core.start();
    tlog('▶ core.start() resolved (WS open + mic/playback init)');
  }, [core]);

  return {
    start,
    stop: core.stop,
    toggleMute: core.toggleMute,
    cleanup: core.cleanup,
  };
}
