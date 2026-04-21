/**
 * Audio playback for session recordings (Phase 2 Pitch Ribbon).
 *
 * Wraps `expo-audio`'s useAudioPlayer with:
 *   - Authenticated URL (Bearer token in headers)
 *   - Reanimated shared value for playhead position (smooth sync with ribbon)
 *   - Simple play(fromSeconds) / pause() / stop() API
 *
 * IMPORTANT: the persisted audio file on the server is PURE user-speech —
 * AI speech is filtered at capture time, and the user's between-utterance
 * silences are trimmed in `persistSessionAudio`. So `player.currentTime`
 * and `positionSeconds` are both in trim-time seconds (cumulative user
 * speech), which matches the time base used by the Pitch Ribbon's axis.
 */

import { useEffect, useMemo, useRef } from 'react';
import { useSharedValue, type SharedValue } from 'react-native-reanimated';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useAuthStore } from '../stores/authStore';
import { API_BASE_URL } from '../lib/config';

export interface UseAudioPlaybackOptions {
  sessionId: number;
  enabled: boolean;
}

export interface AudioPlaybackAPI {
  positionSeconds: SharedValue<number>;
  durationSeconds: number;
  isPlaying: boolean;
  play: (fromSeconds?: number) => void;
  /** Move the playhead without starting playback. Used by insight-marker taps. */
  seekTo: (toSeconds: number) => void;
  pause: () => void;
  stop: () => void;
}

// After a seek, ignore RAF-driven updates from `player.currentTime` for this
// long. `currentTime` lags a freshly-issued seekTo by ~100-200ms on both iOS
// and Android, and without this lockout the RAF loop immediately overwrites
// the snapped playhead with the stale pre-seek position.
const SEEK_LOCKOUT_MS = 300;

export function useAudioPlayback({ sessionId, enabled }: UseAudioPlaybackOptions): AudioPlaybackAPI {
  const token = useAuthStore(s => s.token);
  const positionSeconds = useSharedValue(0);
  const rafRef = useRef<number | null>(null);
  const seekLockoutUntilRef = useRef(0);

  const source = useMemo(() => {
    if (!enabled || !token) return null;
    return {
      uri: `${API_BASE_URL}/sessions/${sessionId}/audio`,
      headers: { Authorization: `Bearer ${token}` },
    };
  }, [enabled, token, sessionId]);

  const player = useAudioPlayer(source as any, { updateInterval: 100 });
  const status = useAudioPlayerStatus(player);

  // Sync playhead with player's currentTime via RAF loop when playing,
  // EXCEPT during the seek lockout window.
  useEffect(() => {
    const tick = () => {
      if (player.playing && Date.now() > seekLockoutUntilRef.current) {
        positionSeconds.value = player.currentTime;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [player, positionSeconds]);

  const api: AudioPlaybackAPI = {
    positionSeconds,
    durationSeconds: status.duration ?? 0,
    isPlaying: status.playing ?? false,
    play: (fromSeconds?: number) => {
      if (typeof fromSeconds === 'number') {
        // Snap visually first, then seek + play. The lockout prevents the
        // RAF from rolling the playhead back to the stale pre-seek position
        // while the native player catches up.
        positionSeconds.value = fromSeconds;
        seekLockoutUntilRef.current = Date.now() + SEEK_LOCKOUT_MS;
        player.seekTo(fromSeconds)
          .then(() => player.play())
          .catch(() => player.play());
      } else {
        player.play();
      }
    },
    seekTo: (toSeconds: number) => {
      positionSeconds.value = toSeconds;
      seekLockoutUntilRef.current = Date.now() + SEEK_LOCKOUT_MS;
      player.seekTo(toSeconds).catch(() => {});
    },
    pause: () => player.pause(),
    stop: () => {
      player.pause();
      seekLockoutUntilRef.current = Date.now() + SEEK_LOCKOUT_MS;
      player.seekTo(0).catch(() => {});
      positionSeconds.value = 0;
    },
  };

  return api;
}
