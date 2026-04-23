import { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withDelay,
} from 'react-native-reanimated';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SCENARIOS } from '../lib/pressureDrillScenarios';
import {
  usePressureDrillSession,
  type FillerFlashEvent,
} from '../hooks/voice/usePressureDrillSession';
import type { ScenarioSlug, DurationPreset } from '../types/pressureDrill';
import { colors, alpha, spacing, typography, fonts, layout } from '../theme';

const FLASH_COLOR = '#ffb95c'; // amber — not red (too punishing), not white (too flat)

function formatMMSS(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// Separate component so its animated style lives in its own render path.
function FillerFlashOverlay({ event }: { event: FillerFlashEvent | null }) {
  const scale = useSharedValue(0.85);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (!event) return;
    scale.value = 0.85;
    opacity.value = 0;
    // Hold longer (1.2s) so user can actually read which filler was flagged.
    scale.value = withSequence(
      withTiming(1, { duration: 140 }),
      withDelay(1200, withTiming(1.05, { duration: 260 })),
    );
    opacity.value = withSequence(
      withTiming(1, { duration: 140 }),
      withDelay(1200, withTiming(0, { duration: 260 })),
    );
  }, [event, scale, opacity]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  if (!event) return null;

  return (
    <Animated.View style={[styles.flashOverlay, style]} pointerEvents="none">
      <Text style={styles.flashText}>{event.word}</Text>
    </Animated.View>
  );
}

export default function PressureDrillSessionScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ scenario?: string; duration?: string }>();

  const scenarioSlug = (params.scenario ?? 'pitch_idea') as ScenarioSlug;
  const durationPreset = (Number(params.duration) || 180) as DurationPreset;
  const scenario = useMemo(
    () => SCENARIOS.find((s) => s.slug === scenarioSlug) ?? SCENARIOS[0],
    [scenarioSlug],
  );

  const [started, setStarted] = useState(false);

  const {
    start,
    stop,
    requestSwap,
    currentPrompt,
    elapsedSeconds,
    isStarting,
    lastFlash,
  } = usePressureDrillSession({
    scenarioSlug,
    durationPreset,
    onEnded: (payload) => {
      router.replace({
        pathname: '/pressure-drill-results',
        params: {
          sessionId: String(payload.sessionId),
          durationSeconds: String(payload.durationSeconds),
          durationSelectedSeconds: String(payload.durationSelectedSeconds),
          scenarioSlug: payload.scenarioSlug,
          fresh: 'true',
        },
      });
    },
    onError: (message) => {
      console.warn('[pressure-drill] error:', message);
      router.back();
    },
  });

  useEffect(() => {
    if (!started) {
      setStarted(true);
      void start();
    }
  }, [start, started]);

  const remaining = Math.max(0, durationPreset - elapsedSeconds);
  const timerDisplay = formatMMSS(remaining);

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: insets.top + spacing.md,
          paddingBottom: insets.bottom + spacing.md,
        },
      ]}
    >
      {/* Timer (top) */}
      <View style={styles.timerBlock}>
        <Text style={styles.timer}>{timerDisplay}</Text>
        <Text style={styles.scenarioName}>{scenario.label}</Text>
      </View>

      {/* Prompt (center) */}
      <View style={styles.promptArea}>
        {isStarting ? (
          <Text style={styles.promptStarting}>Getting ready…</Text>
        ) : currentPrompt ? (
          <>
            <Text style={styles.prompt}>{currentPrompt}</Text>
            <Pressable onPress={requestSwap} hitSlop={12} style={styles.swap}>
              <Ionicons name="sync" size={16} color={alpha(colors.white, 0.6)} />
              <Text style={styles.swapText}>Swap</Text>
            </Pressable>
          </>
        ) : (
          <Text style={styles.promptStarting}>Take it from here.</Text>
        )}
      </View>

      {/* Filler flash overlay — positioned absolutely below the prompt */}
      <FillerFlashOverlay event={lastFlash} />

      {/* Stop button (bottom) */}
      <View style={styles.footer}>
        <Pressable onPress={stop} style={styles.stopBtn} hitSlop={12}>
          <Ionicons name="stop" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.footerHint}>Pause is the skill.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: layout.screenPadding,
  },
  timerBlock: {
    alignItems: 'center',
    gap: 4,
  },
  timer: {
    fontFamily: fonts.extrabold,
    fontSize: 48,
    letterSpacing: -1.5,
    color: colors.onSurface,
    fontVariant: ['tabular-nums'],
  },
  scenarioName: {
    ...typography.bodySm,
    color: alpha(colors.white, 0.35),
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  promptArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  prompt: {
    fontFamily: fonts.extrabold,
    fontSize: 32,
    letterSpacing: -0.6,
    textAlign: 'center',
    color: colors.onSurface,
    lineHeight: 40,
  },
  promptStarting: {
    ...typography.bodyLg,
    color: alpha(colors.white, 0.35),
    textAlign: 'center',
  },
  swap: {
    marginTop: spacing.xxl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  swapText: {
    ...typography.bodyMdMedium,
    color: alpha(colors.white, 0.6),
  },
  flashOverlay: {
    position: 'absolute',
    top: '55%',
    alignSelf: 'center',
  },
  flashText: {
    fontFamily: fonts.extrabold,
    fontSize: 36,
    color: FLASH_COLOR,
    letterSpacing: 0.5,
    textTransform: 'lowercase',
  },
  footer: {
    alignItems: 'center',
    gap: spacing.md,
  },
  stopBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: alpha(colors.white, 0.08),
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: alpha(colors.white, 0.12),
  },
  footerHint: {
    ...typography.bodySm,
    color: alpha(colors.white, 0.3),
    letterSpacing: 0.3,
  },
});
