import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Vibration } from 'react-native';
import * as Haptics from 'expo-haptics';
import { ExpoPlayAudioStream } from '@mykin-ai/expo-audio-stream';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { wsUrl } from '../../lib/api';
import { SEED_PROMPTS } from '../../lib/pressureDrillSeedPrompts';
import type {
  ScenarioSlug,
  DurationPreset,
  ShownPrompt,
  WithinSessionTrend,
} from '../../types/pressureDrill';

export interface UsePressureDrillSessionConfig {
  scenarioSlug: ScenarioSlug;
  durationPreset: DurationPreset;
  onEnded: (payload: {
    sessionId: number;
    durationSeconds: number;
    durationSelectedSeconds: DurationPreset;
    scenarioSlug: ScenarioSlug;
    promptsShown: ShownPrompt[];
    longestCleanStreakSeconds: number;
    withinSessionTrend: WithinSessionTrend;
  }) => void;
  onError: (message: string) => void;
}

export interface FillerFlashEvent {
  word: string;
  id: number; // monotonic id so the same word firing again triggers a new flash animation
}

export interface UsePressureDrillSessionHandle {
  /** Start the WS + mic capture. */
  start: () => Promise<void>;
  /** User-initiated stop. */
  stop: () => void;
  /** User taps swap: consumes next cached prompt (or seed fallback). */
  requestSwap: () => void;
  /** Current prompt to display. */
  currentPrompt: string | null;
  /** Elapsed seconds from session start (server-authoritative). */
  elapsedSeconds: number;
  /** True when WS is connected and mic is streaming. */
  isRecording: boolean;
  /** Latest filler flash event; mobile keys on `.id` to re-trigger animation. */
  lastFlash: FillerFlashEvent | null;
  /** True if something is still loading (pre-ready). */
  isStarting: boolean;
}

const HAPTIC_INTENSITY = Haptics.ImpactFeedbackStyle.Heavy;

/**
 * Dual-path buzz. Primary: expo-haptics (CoreHaptics on iOS). Backup:
 * react-native Vibration (hardware motor, not affected by AVAudioSession).
 * The mic stream activates `playAndRecord` audio session which can suppress
 * CoreHaptics on iOS — Vibration survives that.
 */
function fireFillerBuzz(): void {
  Haptics.impactAsync(HAPTIC_INTENSITY)
    .then(() => console.log('[pd-debug] Haptics.impactAsync resolved'))
    .catch((err) => console.warn('[pd-debug] Haptics.impactAsync failed:', err));
  try {
    if (Platform.OS === 'android') {
      Vibration.vibrate(40);
    } else {
      // iOS: Vibration.vibrate uses a fixed short pattern; duration arg is
      // ignored on iOS but the call still triggers a Taptic Engine buzz.
      Vibration.vibrate();
    }
    console.log('[pd-debug] Vibration.vibrate() triggered');
  } catch (err) {
    console.warn('[pd-debug] Vibration.vibrate failed:', err);
  }
}

// Used when we need a prompt IMMEDIATELY and nothing else is available.
function pickSeedPrompt(scenarioSlug: ScenarioSlug, alreadyShown: Set<string>): string {
  const seed = SEED_PROMPTS[scenarioSlug] ?? SEED_PROMPTS.pitch_idea;
  for (const p of seed) {
    if (!alreadyShown.has(p)) return p;
  }
  // All seeds exhausted — reuse the first anyway.
  return seed[0];
}

export function usePressureDrillSession(
  cfg: UsePressureDrillSessionConfig,
): UsePressureDrillSessionHandle {
  const wsRef = useRef<WebSocket | null>(null);
  const subscriptionRef = useRef<{ remove(): void } | null>(null);
  const recordingRef = useRef(false);
  const cleanedRef = useRef(false);
  const cachedPromptsRef = useRef<string[]>([]);
  const shownPromptsRef = useRef<Set<string>>(new Set());
  const flashIdRef = useRef(0);
  const elapsedRef = useRef(0);
  // [pd-debug] forensic counter — remove after diagnosis
  const audioChunksSentRef = useRef(0);

  const [currentPrompt, setCurrentPrompt] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [lastFlash, setLastFlash] = useState<FillerFlashEvent | null>(null);
  const [isStarting, setIsStarting] = useState(false);

  const send = useCallback((obj: unknown) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj));
  }, []);

  const displayPrompt = useCallback(
    (prompt: string, wasSwap: boolean) => {
      setCurrentPrompt(prompt);
      shownPromptsRef.current.add(prompt);
      send({
        type: 'prompt_shown',
        prompt,
        shownAtSeconds: elapsedRef.current,
        wasSwap,
      });
    },
    [send],
  );

  const requestSwap = useCallback(() => {
    // Grab next from cache; if empty, use a seed prompt. Then proactively
    // request a new batch in the background when running low.
    void Haptics.selectionAsync();
    const next = cachedPromptsRef.current.shift();
    if (next) {
      displayPrompt(next, true);
    } else {
      const seed = pickSeedPrompt(cfg.scenarioSlug, shownPromptsRef.current);
      displayPrompt(seed, true);
    }
    if (cachedPromptsRef.current.length < 2) {
      send({
        type: 'request_prompt_batch',
        elapsedSeconds: elapsedRef.current,
        lastTranscriptWindow: '',
        previouslyShownPrompts: [...shownPromptsRef.current],
      });
    }
  }, [cfg.scenarioSlug, displayPrompt, send]);

  const cleanup = useCallback(async () => {
    if (cleanedRef.current) return;
    cleanedRef.current = true;
    subscriptionRef.current?.remove();
    subscriptionRef.current = null;
    if (recordingRef.current) {
      try {
        await ExpoPlayAudioStream.stopRecording();
      } catch (err) {
        console.warn('[pressure-drill] stopRecording error:', err);
      }
      recordingRef.current = false;
      setIsRecording(false);
    }
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {}
      wsRef.current = null;
    }
    deactivateKeepAwake();
  }, []);

  const stop = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    send({ type: 'stop' });
    // onEnded will fire from the drill_ended WS message; cleanup happens then.
  }, [send]);

  const startMicCapture = useCallback(async (ws: WebSocket) => {
    if (recordingRef.current) return;
    try {
      console.log('[pd-debug] startRecording() calling native...');
      const { subscription } = await ExpoPlayAudioStream.startRecording({
        sampleRate: 48000,
        channels: 1,
        encoding: 'pcm_16bit',
        interval: 100,
        onAudioStream: async (event) => {
          if (ws.readyState !== WebSocket.OPEN) {
            if (audioChunksSentRef.current === 0) {
              console.warn(`[pd-debug] mic chunk but WS not open (state=${ws.readyState})`);
            }
            return;
          }
          if (typeof event.data !== 'string') return;
          audioChunksSentRef.current += 1;
          if (
            audioChunksSentRef.current === 1 ||
            audioChunksSentRef.current % 50 === 0
          ) {
            console.log(
              `[pd-debug] audio chunks sent=${audioChunksSentRef.current} payloadLen=${event.data.length}`,
            );
          }
          ws.send(JSON.stringify({ type: 'audio', data: event.data }));
        },
      });
      if (subscription) subscriptionRef.current = subscription;
      recordingRef.current = true;
      setIsRecording(true);
      console.log('[pd-debug] startRecording() resolved, mic live');
    } catch (err) {
      console.error('[pressure-drill] startRecording failed:', err);
      cfg.onError('Failed to start microphone');
      void cleanup();
    }
  }, [cfg, cleanup]);

  const start = useCallback(async () => {
    if (wsRef.current) return;
    setIsStarting(true);
    try {
      await activateKeepAwakeAsync();
    } catch (err) {
      console.warn('[pressure-drill] activateKeepAwake error:', err);
    }

    const { granted } = await ExpoPlayAudioStream.requestPermissionsAsync();
    if (!granted) {
      setIsStarting(false);
      cfg.onError('Microphone permission is required');
      return;
    }

    const url =
      wsUrl('/pressure-drill/session') +
      `&scenario=${encodeURIComponent(cfg.scenarioSlug)}` +
      `&duration=${cfg.durationPreset}`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log(`[pd-debug] WS open → ${url.replace(/token=[^&]+/, 'token=***')}`);
      // Handshake already includes scenario + duration in URL.
    };

    ws.onmessage = (ev) => {
      let msg: any;
      try {
        msg = JSON.parse(String(ev.data));
      } catch {
        return;
      }
      // [pd-debug] log every incoming WS message type (trim large payloads)
      if (msg.type !== 'drill_tick') {
        console.log(`[pd-debug] WS← type=${msg.type}`, JSON.stringify(msg).slice(0, 240));
      }
      switch (msg.type) {
        case 'ready':
          console.log('[pd-debug] received ready, starting mic');
          setIsStarting(false);
          void startMicCapture(ws);
          break;

        case 'prompt_batch':
          if (Array.isArray(msg.prompts)) {
            cachedPromptsRef.current = (msg.prompts as unknown[])
              .filter((p): p is string => typeof p === 'string')
              .filter((p) => !shownPromptsRef.current.has(p));
          }
          break;

        case 'auto_prompt':
          if (typeof msg.prompt === 'string') {
            displayPrompt(msg.prompt, false);
          }
          break;

        case 'filler_detected':
          console.log(
            `[pd-debug] filler_detected word="${msg.word}" throttled=${msg.throttled} → ${msg.throttled ? 'no haptic' : 'BUZZ'}`,
          );
          flashIdRef.current += 1;
          setLastFlash({ word: String(msg.word ?? ''), id: flashIdRef.current });
          if (!msg.throttled) fireFillerBuzz();
          break;

        case 'drill_tick':
          if (typeof msg.elapsedSeconds === 'number') {
            const next = Math.floor(msg.elapsedSeconds);
            elapsedRef.current = next;
            setElapsedSeconds(next);
          }
          break;

        case 'drill_ended':
          cfg.onEnded({
            sessionId: Number(msg.sessionId),
            durationSeconds: Number(msg.durationSeconds ?? 0),
            durationSelectedSeconds:
              (Number(msg.durationSelectedSeconds) as DurationPreset) ?? cfg.durationPreset,
            scenarioSlug: (msg.scenarioSlug as ScenarioSlug) ?? cfg.scenarioSlug,
            promptsShown: Array.isArray(msg.promptsShown) ? (msg.promptsShown as ShownPrompt[]) : [],
            longestCleanStreakSeconds: Number(msg.longestCleanStreakSeconds ?? 0),
            withinSessionTrend:
              (msg.withinSessionTrend as WithinSessionTrend) ?? {
                firstThirdRate: 0,
                middleThirdRate: 0,
                lastThirdRate: 0,
              },
          });
          void cleanup();
          break;

        case 'error':
          cfg.onError(String(msg.message ?? 'Unknown error'));
          void cleanup();
          break;
      }
    };

    ws.onerror = (e) => {
      console.warn('[pd-debug] WS onerror:', e);
      cfg.onError('Connection error');
      void cleanup();
    };
    ws.onclose = (ev) => {
      console.log(`[pd-debug] WS close code=${ev.code} reason="${ev.reason}" wasClean=${ev.wasClean}`);
      // handled by error/drill_ended
    };
  }, [cfg, cleanup, displayPrompt, startMicCapture]);

  useEffect(() => {
    return () => {
      void cleanup();
    };
  }, [cleanup]);

  return {
    start,
    stop,
    requestSwap,
    currentPrompt,
    elapsedSeconds,
    isRecording,
    lastFlash,
    isStarting,
  };
}
