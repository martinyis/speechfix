/**
 * PitchRibbon — horizontally-scrollable Skia prosody visualization.
 *
 * ---------------------------------------------------------------------------
 * Coordinate system (single source of truth)
 * ---------------------------------------------------------------------------
 * EVERYTHING on this ribbon lives in **trim-time seconds**:
 *
 *   - `samples[].t`                 seconds from start of trimmed audio
 *   - `fillers[].timeSeconds`       seconds from start of trimmed audio
 *   - `utterance.startTime/endTime` seconds from start of trimmed audio
 *   - `player.currentTime`          position in the silence-trimmed audio file
 *
 * The server (`session-manager.ts#computeSpeechTimeline` + `#persistSessionAudio`)
 * is responsible for remapping all timestamps into this coordinate system and
 * for producing an audio file that matches byte-for-byte. The audio file is
 * PURE user-speech — AI speech is filtered at capture time and the user's
 * between-utterance silences are trimmed out. That makes the client trivial:
 * plot at `value * PX_PER_SECOND`, tap seeks to the tap X, playhead tracks
 * `player.currentTime`. No compression logic needed here.
 *
 * Channels:
 *  - Wave vertical position = pitch (Hz, normalized across session)
 *  - Wave thickness         = volume (per-sample)
 *  - Wave color             = clarity (per-segment from utterance confidence)
 *  - Ticks above ribbon     = filler words
 *  - Gaps in ribbon         = silences > 400ms WITHIN a user utterance
 *  - Time markers below     = every 30s
 * ---------------------------------------------------------------------------
 */

import { useMemo } from 'react';
import { ScrollView, View, Text, StyleSheet, type GestureResponderEvent } from 'react-native';
import {
  Canvas,
  Circle,
  Group,
  Line,
  Path,
  Skia,
  type SkPath,
  vec,
} from '@shopify/react-native-skia';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { colors, alpha, fonts, spacing } from '../theme';
import type { ProsodySample, FillerWordPosition, UtteranceMetadata } from '../types/session';
import { useAudioPlayback } from '../hooks/useAudioPlayback';

const PX_PER_SECOND = 60;
const RIBBON_HEIGHT = 140;
const TICK_ZONE_HEIGHT = 14;
const AXIS_ZONE_HEIGHT = 24;
const TOTAL_HEIGHT = RIBBON_HEIGHT + TICK_ZONE_HEIGHT + AXIS_ZONE_HEIGHT;
const CENTER_Y = TICK_ZONE_HEIGHT + RIBBON_HEIGHT / 2;
const MAX_AMPLITUDE = RIBBON_HEIGHT / 2 - 12;
const MIN_STROKE = 2;
const MAX_STROKE = 12;

// Intra-utterance silence break for path segmentation (cosmetic only —
// splits a single drawn path when there's a noticeable within-speech pause).
const INTRA_PAUSE_MS = 400;

const COLOR_HIGH_CLARITY = '#34d399';
const COLOR_MID_CLARITY = '#fbbf24';
const COLOR_LOW_CLARITY = '#ff6daf';

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function clarityColor(confidence: number): string {
  if (confidence >= 0.85) return COLOR_HIGH_CLARITY;
  if (confidence >= 0.65) return COLOR_MID_CLARITY;
  return COLOR_LOW_CLARITY;
}

interface PitchRibbonProps {
  sessionId: number;
  samples: ProsodySample[];
  fillers: FillerWordPosition[];
  durationSeconds: number;
  utterances?: UtteranceMetadata[];
  sentences?: string[];
  audioPath?: string | null;
  /** Fired with trim-time seconds when the user taps a spot. */
  onScrub?: (tSeconds: number, meta: { sentence: string; confidence: number }) => void;
}

export function PitchRibbon({
  sessionId,
  samples,
  fillers,
  durationSeconds,
  utterances,
  sentences,
  audioPath,
  onScrub,
}: PitchRibbonProps) {
  const playback = useAudioPlayback({
    sessionId,
    enabled: !!audioPath,
  });

  // Visual axis width = largest trim-time value we're going to plot.
  const visualDuration = useMemo(() => {
    let max = 0;
    for (const s of samples) if (s.t > max) max = s.t;
    if (utterances) for (const u of utterances) if (u.endTime > max) max = u.endTime;
    for (const f of fillers) {
      if (typeof f.timeSeconds === 'number' && f.timeSeconds > max) max = f.timeSeconds;
    }
    return Math.max(0.5, max);
  }, [samples, utterances, fillers]);

  const canvasWidth = Math.max(200, Math.round(visualDuration * PX_PER_SECOND));

  // Build Skia paths from samples. Samples are already in trim-time — no
  // compression needed. We only split paths on intra-utterance pauses for
  // cosmetic clarity.
  const segmentPaths = useMemo(() => {
    if (samples.length === 0) return [] as Array<{ path: SkPath; clarity: number }>;

    const validPitches = samples
      .map(s => s.pitchHz)
      .filter((p): p is number => p !== null && isFinite(p));
    const pMin = validPitches.length > 0 ? Math.min(...validPitches) : 80;
    const pMax = validPitches.length > 0 ? Math.max(...validPitches) : 250;
    const pRange = Math.max(30, pMax - pMin);

    const sampleToY = (pitchHz: number | null): number => {
      if (pitchHz === null || !isFinite(pitchHz)) return CENTER_Y;
      const norm = (pitchHz - pMin) / pRange;
      return CENTER_Y + (0.5 - norm) * 2 * MAX_AMPLITUDE;
    };

    const segments: ProsodySample[][] = [];
    let current: ProsodySample[] = [];
    for (let i = 0; i < samples.length; i++) {
      const s = samples[i];
      const prev = samples[i - 1];
      if (prev) {
        const gapMs = (s.t - prev.t) * 1000;
        if (gapMs > INTRA_PAUSE_MS) {
          if (current.length > 1) segments.push(current);
          current = [];
        }
      }
      current.push(s);
    }
    if (current.length > 1) segments.push(current);

    return segments.map(segment => {
      const path = Skia.Path.Make();
      for (let i = 0; i < segment.length; i++) {
        const s = segment[i];
        const x = s.t * PX_PER_SECOND;
        const y = sampleToY(s.pitchHz);
        const halfThick = (MIN_STROKE + (MAX_STROKE - MIN_STROKE) * s.volume) / 2;
        if (i === 0) path.moveTo(x, y - halfThick);
        else path.lineTo(x, y - halfThick);
      }
      for (let i = segment.length - 1; i >= 0; i--) {
        const s = segment[i];
        const x = s.t * PX_PER_SECOND;
        const y = sampleToY(s.pitchHz);
        const halfThick = (MIN_STROKE + (MAX_STROKE - MIN_STROKE) * s.volume) / 2;
        path.lineTo(x, y + halfThick);
      }
      path.close();

      const midT = (segment[0].t + segment[segment.length - 1].t) / 2;
      const utt = utterances?.find(u => midT >= u.startTime && midT <= u.endTime);
      const clarity = utt?.avgConfidence ?? 0.9;
      return { path, clarity };
    });
  }, [samples, utterances]);

  const markerCount = Math.floor(visualDuration / 30) + 1;
  const markers = Array.from({ length: markerCount }, (_, i) => i * 30);

  // Playhead: player.currentTime is already in trim-time (server trims the
  // audio file to match), so plot at positionSeconds * PX_PER_SECOND directly.
  const playheadStyle = useAnimatedStyle(() => {
    'worklet';
    const t = playback.positionSeconds.value;
    return {
      transform: [{ translateX: t * PX_PER_SECOND - 1 }],
      opacity: t > 0 || playback.isPlaying ? 1 : 0,
    };
  });

  // onResponderRelease's locationX is the tap's position inside the inner
  // View's own coordinate system — which IS the canvas coordinate system.
  // Never add scrollOffset; that would double-count.
  const handleTap = (e: GestureResponderEvent) => {
    const canvasX = e.nativeEvent.locationX;
    const tSeconds = Math.max(0, Math.min(visualDuration, canvasX / PX_PER_SECOND));

    const utt = utterances?.find(u => tSeconds >= u.startTime && tSeconds <= u.endTime);
    const sentenceIdx = utterances && utt ? utterances.indexOf(utt) : 0;
    const sentence = sentences?.[sentenceIdx] ?? '';
    const confidence = utt?.avgConfidence ?? 0;

    if (audioPath) {
      playback.play(tSeconds);
    } else {
      playback.positionSeconds.value = tSeconds;
    }
    onScrub?.(tSeconds, { sentence, confidence });
  };

  if (samples.length === 0 || durationSeconds < 1 || visualDuration < 0.5) {
    return null;
  }

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
      >
        <View
          style={{ width: canvasWidth, height: TOTAL_HEIGHT }}
          onStartShouldSetResponder={() => true}
          onResponderRelease={handleTap}
        >
          <Canvas style={{ width: canvasWidth, height: TOTAL_HEIGHT }}>
            <Line
              p1={vec(0, CENTER_Y)}
              p2={vec(canvasWidth, CENTER_Y)}
              color={alpha(colors.white, 0.05)}
              strokeWidth={1}
            />

            <Group>
              {segmentPaths.map(({ path, clarity }, i) => (
                <Path key={i} path={path} color={clarityColor(clarity)} opacity={0.95} />
              ))}
            </Group>

            <Group>
              {fillers
                .filter(f => typeof f.timeSeconds === 'number')
                .map((f, i) => (
                  <Circle
                    key={`f-${i}`}
                    cx={(f.timeSeconds ?? 0) * PX_PER_SECOND}
                    cy={TICK_ZONE_HEIGHT / 2}
                    r={3}
                    color={COLOR_LOW_CLARITY}
                  />
                ))}
            </Group>

            <Group>
              {markers.map((m, i) => (
                <Line
                  key={`m-${i}`}
                  p1={vec(m * PX_PER_SECOND, TICK_ZONE_HEIGHT + RIBBON_HEIGHT - 4)}
                  p2={vec(m * PX_PER_SECOND, TICK_ZONE_HEIGHT + RIBBON_HEIGHT + 4)}
                  color={alpha(colors.white, 0.25)}
                  strokeWidth={1}
                />
              ))}
            </Group>
          </Canvas>

          <View pointerEvents="none" style={styles.labelLayer}>
            {markers.map((m, i) => (
              <Text
                key={`l-${i}`}
                style={[styles.timeLabel, { left: m * PX_PER_SECOND - 14 }]}
              >
                {formatTime(m)}
              </Text>
            ))}
          </View>

          <Animated.View
            pointerEvents="none"
            style={[styles.playhead, { height: TICK_ZONE_HEIGHT + RIBBON_HEIGHT }, playheadStyle]}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.md,
  },
  labelLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: AXIS_ZONE_HEIGHT,
  },
  timeLabel: {
    position: 'absolute',
    top: 4,
    width: 28,
    textAlign: 'center',
    fontSize: 10,
    fontFamily: fonts.medium,
    color: alpha(colors.white, 0.35),
  },
  playhead: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 2,
    backgroundColor: '#ffffff',
  },
});
