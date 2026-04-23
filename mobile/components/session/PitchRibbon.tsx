/**
 * PitchRibbon — Energy-style spectrogram of user speech over time.
 *
 * All timestamps are in trim-time seconds (server filters AI speech + silences).
 *
 * Channels:
 *  - Bar height     = per-slot volume
 *  - Bar Y offset   = per-slot average pitch (low below centerline, high above)
 *  - Bar tint       = pink if near a filler-word timestamp, otherwise purple
 *  - Beams (full height) mark specific "point" insights
 *  - Translucent overlay spans mark "range" insights
 *  - Numbered chips in the top lane expose each anchored insight to a tap
 */

import { useMemo } from 'react';
import {
  ScrollView,
  View,
  Pressable,
  Text,
  StyleSheet,
  type GestureResponderEvent,
} from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import Svg, {
  Defs,
  LinearGradient,
  Stop,
  Rect,
} from 'react-native-svg';
import { colors, alpha, fonts } from '../../theme';
import type {
  DeepInsight,
  FillerWordPosition,
  ProsodySample,
} from '../../types/session';
import { useAudioPlayback, type AudioPlaybackAPI } from '../../hooks/useAudioPlayback';

const PX_PER_SECOND = 60;
const RIBBON_HEIGHT = 160;
const TICK_HEIGHT = 26;
const AXIS_HEIGHT = 22;
const TOTAL_HEIGHT = RIBBON_HEIGHT + AXIS_HEIGHT + TICK_HEIGHT;
const CENTER_Y = TICK_HEIGHT + RIBBON_HEIGHT / 2;
const MAX_BAR_HEIGHT = RIBBON_HEIGHT - 24;
const MAX_OFFSET = RIBBON_HEIGHT * 0.18;
const BAR_WIDTH = 3;
const BAR_GAP = 2;
const FILLER_WINDOW = 0.18;

interface Bar {
  x: number;
  cy: number;
  height: number;
  tint: 'normal' | 'filler';
}

function pitchRange(samples: ProsodySample[]) {
  const pitches = samples
    .map(s => s.pitchHz)
    .filter((p): p is number => p !== null && isFinite(p));
  const min = pitches.length ? Math.min(...pitches) : 80;
  const max = pitches.length ? Math.max(...pitches) : 250;
  return { min, max, range: Math.max(30, max - min) };
}

interface PitchRibbonProps {
  sessionId: number;
  samples: ProsodySample[];
  fillers: FillerWordPosition[];
  durationSeconds: number;
  audioPath?: string | null;
  /** Pre-sorted (by anchor start) specific insights; get numbered chips. */
  specificInsights: DeepInsight[];
  /** Which chip is currently selected (or null). */
  selectedInsightIdx: number | null;
  /** Called when a chip is tapped. */
  onInsightTap: (idx: number) => void;
  /**
   * Imperative audio handle. Optional — when omitted, the ribbon creates its
   * own via useAudioPlayback (legacy/standalone). Provided by session-detail
   * to share playback with karaoke + transport bar.
   */
  audio?: AudioPlaybackAPI;
}

export function PitchRibbon({
  sessionId,
  samples,
  fillers,
  durationSeconds,
  audioPath,
  specificInsights,
  selectedInsightIdx,
  onInsightTap,
  audio,
}: PitchRibbonProps) {
  const ownAudio = useAudioPlayback({
    sessionId,
    enabled: !audio && !!audioPath,
  });
  const playback = audio ?? ownAudio;

  const visualDuration = useMemo(() => {
    let max = 0;
    for (const s of samples) if (s.t > max) max = s.t;
    for (const f of fillers) {
      if (typeof f.timeSeconds === 'number' && f.timeSeconds > max) max = f.timeSeconds;
    }
    return Math.max(durationSeconds, max, 0.5);
  }, [samples, fillers, durationSeconds]);

  const canvasWidth = Math.max(200, Math.round(visualDuration * PX_PER_SECOND));

  const bars = useMemo(() => {
    if (samples.length === 0) return [] as Bar[];
    const { min, range } = pitchRange(samples);
    const slotWidth = BAR_WIDTH + BAR_GAP;
    const slotCount = Math.floor(canvasWidth / slotWidth);
    const buckets: { volume: number; pitchNorm: number; hasSample: boolean; t: number }[] = [];
    for (let i = 0; i < slotCount; i++) {
      buckets.push({ volume: 0, pitchNorm: 0.5, hasSample: false, t: 0 });
    }
    const counts = new Array(slotCount).fill(0);
    const pitchSums = new Array(slotCount).fill(0);
    for (const s of samples) {
      const idx = Math.floor((s.t / visualDuration) * slotCount);
      if (idx < 0 || idx >= slotCount) continue;
      const b = buckets[idx];
      b.volume = Math.max(b.volume, s.volume);
      b.hasSample = true;
      b.t = s.t;
      if (s.pitchHz !== null && isFinite(s.pitchHz)) {
        pitchSums[idx] += (s.pitchHz - min) / range;
        counts[idx] += 1;
      }
    }
    for (let i = 0; i < slotCount; i++) {
      if (counts[i] > 0) buckets[i].pitchNorm = pitchSums[i] / counts[i];
    }
    const fillerTimes = fillers
      .map(f => f.timeSeconds)
      .filter((t): t is number => typeof t === 'number');
    return buckets
      .map((b, i): Bar | null => {
        if (!b.hasSample || b.volume < 0.05) return null;
        const x = i * slotWidth;
        const height = 6 + b.volume * MAX_BAR_HEIGHT;
        const cy = CENTER_Y + (0.5 - b.pitchNorm) * 2 * MAX_OFFSET;
        const isFiller = fillerTimes.some(ft => Math.abs(b.t - ft) < FILLER_WINDOW);
        return { x, cy, height, tint: isFiller ? 'filler' : 'normal' };
      })
      .filter((b): b is Bar => b !== null);
  }, [samples, canvasWidth, visualDuration, fillers]);

  const playheadStyle = useAnimatedStyle(() => {
    'worklet';
    const t = playback.positionSeconds.value;
    return {
      transform: [{ translateX: t * PX_PER_SECOND - 12 }],
      opacity: t > 0 || playback.isPlaying ? 1 : 0.8,
    };
  });

  const handleTap = (e: GestureResponderEvent) => {
    const canvasX = e.nativeEvent.locationX;
    const tSeconds = Math.max(0, Math.min(visualDuration, canvasX / PX_PER_SECOND));
    if (audioPath) playback.play(tSeconds);
    else playback.positionSeconds.value = tSeconds;
  };

  if (samples.length === 0 || durationSeconds < 1) return null;

  const insightVisuals = specificInsights.map((ins, idx) => {
    const a = ins.anchor!;
    const isSelected = selectedInsightIdx === idx;
    const x = a.start_seconds * PX_PER_SECOND;
    const w = Math.max(6, (a.end_seconds - a.start_seconds) * PX_PER_SECOND);
    const isRange = a.kind === 'range';
    return { idx, x, w, isRange, isSelected, number: idx + 1 };
  });

  return (
    <View style={styles.container}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View
          style={{ width: canvasWidth, height: TOTAL_HEIGHT }}
          onStartShouldSetResponder={() => true}
          onResponderRelease={handleTap}
        >
          <Svg width={canvasWidth} height={TOTAL_HEIGHT}>
            <Defs>
              <LinearGradient id="bar-gradient" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={colors.secondary} stopOpacity="1" />
                <Stop offset="1" stopColor={colors.primary} stopOpacity="0.55" />
              </LinearGradient>
              <LinearGradient id="bar-filler" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={colors.tertiary} stopOpacity="1" />
                <Stop offset="1" stopColor={colors.tertiary} stopOpacity="0.5" />
              </LinearGradient>
            </Defs>

            {insightVisuals
              .filter(iv => iv.isRange)
              .map(iv => (
                <Rect
                  key={`range-${iv.idx}`}
                  x={iv.x}
                  y={TICK_HEIGHT}
                  width={iv.w}
                  height={RIBBON_HEIGHT}
                  fill={alpha(colors.primary, iv.isSelected ? 0.22 : 0.09)}
                  stroke={alpha(colors.primary, iv.isSelected ? 0.8 : 0.3)}
                  strokeWidth={iv.isSelected ? 1.5 : 1}
                  strokeDasharray={iv.isSelected ? undefined : '3,3'}
                  rx={4}
                />
              ))}

            {insightVisuals
              .filter(iv => !iv.isRange)
              .map(iv => (
                <Rect
                  key={`beam-${iv.idx}`}
                  x={iv.x - 1}
                  y={TICK_HEIGHT}
                  width={2}
                  height={RIBBON_HEIGHT}
                  fill={alpha(colors.primary, iv.isSelected ? 0.85 : 0.45)}
                />
              ))}

            {bars.map((b, i) => (
              <Rect
                key={`b-${i}`}
                x={b.x}
                y={b.cy - b.height / 2}
                width={BAR_WIDTH}
                height={b.height}
                rx={BAR_WIDTH / 2}
                fill={b.tint === 'filler' ? 'url(#bar-filler)' : 'url(#bar-gradient)'}
              />
            ))}
          </Svg>

          <Animated.View pointerEvents="none" style={[styles.aura, playheadStyle]} />
          <Animated.View pointerEvents="none" style={[styles.line, playheadStyle]} />

          {insightVisuals.map(iv => {
            const cx = iv.isRange ? iv.x + Math.min(iv.w / 2, 14) : iv.x;
            return (
              <Pressable
                key={`chip-${iv.idx}`}
                onPress={() => onInsightTap(iv.idx)}
                hitSlop={6}
                style={[
                  styles.chip,
                  iv.isSelected && styles.chipSelected,
                  { left: cx - 11, top: 2 },
                ]}
              >
                <Text style={[styles.chipNum, iv.isSelected && styles.chipNumSelected]}>
                  {iv.number}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 12,
  },
  aura: {
    position: 'absolute',
    top: TICK_HEIGHT - 6,
    height: RIBBON_HEIGHT + 12,
    left: 0,
    width: 24,
    borderRadius: 12,
    backgroundColor: alpha(colors.primary, 0.18),
  },
  line: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    left: 12,
    width: 2,
    borderRadius: 1,
    backgroundColor: colors.white,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 6,
  },
  chip: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: alpha(colors.primary, 0.25),
    borderWidth: 1,
    borderColor: alpha(colors.primary, 0.5),
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.white,
  },
  chipNum: {
    fontSize: 11,
    fontFamily: fonts.bold,
    color: colors.primary,
  },
  chipNumSelected: {
    color: colors.white,
  },
});
