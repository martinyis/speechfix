import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  FadeIn,
  FadeOut,
  SlideInRight,
  SlideOutLeft,
  LinearTransition,
  cancelAnimation,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import PracticeRecordOrb from '../components/orbs/PracticeRecordOrb';
import LoadingScreen from '../components/loading/LoadingScreen';
import { SCENARIOS } from '../lib/pressureDrillScenarios';
import {
  usePressureDrillSession,
  type FillerFlashEvent,
} from '../hooks/voice/usePressureDrillSession';
import type { ScenarioSlug, DurationPreset } from '../types/pressureDrill';
import { colors, alpha, spacing, typography, fonts, layout } from '../theme';

const FLASH_COLOR = '#ffb95c';
const MAX_TICKER = 3;
const TICKER_TTL = 2200;

function formatMMSS(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

interface TickerItem {
  id: number;
  word: string;
}

function Ticker({ latest }: { latest: FillerFlashEvent | null }) {
  const [items, setItems] = useState<TickerItem[]>([]);
  const timersRef = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    if (!latest) return;
    const item: TickerItem = { id: latest.id, word: latest.word };
    setItems((prev) => [item, ...prev].slice(0, MAX_TICKER));
    timersRef.current[item.id] = setTimeout(() => {
      setItems((prev) => prev.filter((i) => i.id !== item.id));
    }, TICKER_TTL);
  }, [latest]);

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      Object.values(timers).forEach(clearTimeout);
    };
  }, []);

  return (
    <View style={styles.tickerCol} pointerEvents="none">
      <Text style={styles.tickerLabel}>FILLERS</Text>
      {items.map((item) => (
        <Animated.View
          key={item.id}
          entering={SlideInRight.duration(220)}
          exiting={SlideOutLeft.duration(220)}
          layout={LinearTransition.springify().damping(18).stiffness(220)}
          style={styles.tickerChip}
        >
          <View style={styles.tickerDot} />
          <Text style={styles.tickerWord}>{item.word}</Text>
        </Animated.View>
      ))}
    </View>
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
  const [isStopping, setIsStopping] = useState(false);
  const audioLevel = useSharedValue(0);

  const {
    start,
    stop,
    requestSwap,
    currentPrompt,
    elapsedSeconds,
    isStarting,
    isRecording,
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

  useEffect(() => {
    if (!isRecording) {
      cancelAnimation(audioLevel);
      audioLevel.value = withTiming(0, { duration: 200 });
      return;
    }
    const tick = () => {
      audioLevel.value = withTiming(0.2 + Math.random() * 0.6, { duration: 240 });
    };
    tick();
    const handle = setInterval(tick, 220);
    return () => {
      clearInterval(handle);
    };
  }, [isRecording, audioLevel]);

  const remaining = Math.max(0, durationPreset - elapsedSeconds);
  const orbState: 'idle' | 'recording' = isRecording ? 'recording' : 'idle';

  const handleStop = () => {
    setIsStopping(true);
    void stop();
  };

  if (isStopping) {
    return (
      <LoadingScreen
        title="Scoring drill"
        eyebrow="Scoring"
        tone="calm"
        steps={[
          'Scoring fillers',
          'Comparing to baseline',
          'Building trend',
        ]}
      />
    );
  }

  return (
    <View
      style={[
        styles.container,
        { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.md },
      ]}
    >
      <Pressable
        hitSlop={12}
        onPress={() => router.back()}
        style={[styles.backBtn, { top: insets.top + spacing.xs }]}
      >
        <Ionicons name="chevron-back" size={22} color={alpha(colors.white, 0.7)} />
      </Pressable>

      <View style={styles.timerBlock}>
        <View style={styles.timerPill}>
          <View style={styles.liveDot} />
          <Text style={styles.timerPillText}>{formatMMSS(remaining)}</Text>
        </View>
        <Text style={styles.scenarioLabel}>{scenario.label.toUpperCase()}</Text>
      </View>

      <View style={styles.body}>
        <View style={styles.promptArea}>
          {isStarting ? (
            <Text style={styles.promptStarting}>Getting ready…</Text>
          ) : currentPrompt ? (
            <>
              <Animated.Text
                key={currentPrompt}
                entering={FadeIn.duration(220)}
                exiting={FadeOut.duration(140)}
                style={styles.prompt}
              >
                {currentPrompt}
              </Animated.Text>
              <Pressable onPress={requestSwap} hitSlop={12} style={styles.swap}>
                <Ionicons name="sync" size={16} color={alpha(colors.white, 0.6)} />
                <Text style={styles.swapText}>Swap</Text>
              </Pressable>
            </>
          ) : (
            <Text style={styles.promptStarting}>Take it from here.</Text>
          )}
        </View>

        <Ticker latest={lastFlash} />
      </View>

      <View style={styles.orbArea}>
        <PracticeRecordOrb state={orbState} audioLevel={audioLevel} onPress={handleStop} />
        <Text style={styles.footerHint}>Tap the orb to stop</Text>
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
  backBtn: {
    position: 'absolute',
    left: spacing.md,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  timerBlock: {
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xl,
  },
  timerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 999,
    backgroundColor: alpha(colors.white, 0.06),
    borderWidth: 1,
    borderColor: alpha(colors.white, 0.08),
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.tertiary,
  },
  timerPillText: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.onSurface,
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.2,
  },
  scenarioLabel: {
    ...typography.labelSm,
    color: alpha(colors.white, 0.4),
  },
  body: {
    flex: 1,
    flexDirection: 'row',
  },
  promptArea: {
    flex: 1,
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingRight: spacing.md,
  },
  prompt: {
    fontFamily: fonts.extrabold,
    fontSize: 28,
    letterSpacing: -0.6,
    color: colors.onSurface,
    lineHeight: 36,
  },
  promptStarting: {
    ...typography.bodyLg,
    color: alpha(colors.white, 0.35),
  },
  swap: {
    marginTop: spacing.lg,
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
  tickerCol: {
    width: 108,
    alignItems: 'stretch',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingLeft: spacing.sm,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: alpha(colors.white, 0.08),
  },
  tickerLabel: {
    ...typography.labelSm,
    fontSize: 9,
    color: alpha(colors.white, 0.35),
    marginBottom: spacing.xs,
  },
  tickerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 999,
    backgroundColor: alpha(FLASH_COLOR, 0.1),
    borderWidth: 1,
    borderColor: alpha(FLASH_COLOR, 0.3),
  },
  tickerDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: FLASH_COLOR,
  },
  tickerWord: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: FLASH_COLOR,
    textTransform: 'lowercase',
  },
  orbArea: {
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: -spacing.md,
  },
  footerHint: {
    ...typography.bodySm,
    color: alpha(colors.white, 0.3),
    letterSpacing: 0.3,
  },
});
