import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActionSheetIOS,
  Alert,
  Platform,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import { ScreenHeader } from '../components/ui';
import { PatternTaskCard } from '../components/pattern/PatternTaskCard';
import { QueuedPatternRow } from '../components/pattern/QueuedPatternRow';
import { WatchingPatternRow } from '../components/pattern/WatchingPatternRow';
import { WatchingDetailSheet } from '../components/pattern/WatchingDetailSheet';
import { ReturningBanner } from '../components/pattern/ReturningBanner';
import { usePatternTasks } from '../hooks/data/usePatternTasks';
import { authFetch } from '../lib/api';
import {
  colors,
  alpha,
  glass,
  layout,
  spacing,
  typography,
} from '../theme';
import type {
  ActivePattern,
  PatternTasksResponse,
  QueuedPattern,
  WatchingPattern,
} from '../types/practice';

const PATTERN_TYPE_LABEL: Record<string, string> = {
  overused_word: 'Overused Word',
  repetitive_starter: 'Sentence Starter',
  crutch_phrase: 'Crutch Phrase',
  hedging: 'Hedging',
  negative_framing: 'Negative Framing',
};

const SWAP_TOAST_MS = 2800;
const RESWAP_SUPPRESS_WINDOW_MS = 10_000;

function labelFor(pattern: {
  identifier: string | null;
  type: string;
}): string {
  return pattern.identifier
    ? pattern.identifier
    : PATTERN_TYPE_LABEL[pattern.type] ?? pattern.type;
}

/**
 * Optimistically swap `target` into `active`, moving the old active (if any)
 * to the front of the queue with its existing level progress preserved so the
 * `X/Y` chip stays accurate.
 */
function applyOptimisticSwap(
  prev: PatternTasksResponse | undefined,
  target: QueuedPattern,
): PatternTasksResponse | undefined {
  if (!prev) return prev;

  const queuedWithoutTarget = prev.queued.filter(
    (p) => p.patternId !== target.patternId,
  );

  let newQueued = queuedWithoutTarget;
  if (prev.active) {
    const demoted: QueuedPattern = {
      patternId: prev.active.patternId,
      type: prev.active.type,
      identifier: prev.active.identifier,
      severity: prev.active.severity,
      description: prev.active.description,
      frequency: 0,
      exampleSentences: [],
      queuePosition: 0,
      isReturning: prev.active.isReturning,
      lastRegressedAt: null,
      levelProgress: prev.active.levelProgress,
    };
    newQueued = [demoted, ...queuedWithoutTarget];
  }

  const newActive: ActivePattern = {
    patternId: target.patternId,
    type: target.type,
    identifier: target.identifier,
    severity: target.severity,
    description: target.description,
    currentLevel: 1,
    levelProgress: target.levelProgress ?? { completed: 0, total: 0 },
    exercises: [],
    isReturning: target.isReturning,
  };

  return {
    ...prev,
    active: newActive,
    queued: newQueued,
  };
}

export default function PatternsListScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { data: patternData, refetch } = usePatternTasks();
  const scrollRef = useRef<ScrollView>(null);

  useFocusEffect(
    useCallback(() => {
      refetch();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [swapToast, setSwapToast] = useState<string | null>(null);
  const [dismissingIds, setDismissingIds] = useState<Set<number>>(new Set());
  const [sheetPattern, setSheetPattern] = useState<WatchingPattern | null>(null);
  const lastSwapRef = useRef<{ fromId: number | null; at: number } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (toastTimer.current != null) clearTimeout(toastTimer.current);
    },
    [],
  );

  const active = patternData?.active ?? null;
  const watching = useMemo(() => patternData?.watching ?? [], [patternData]);
  const queued = useMemo(() => patternData?.queued ?? [], [patternData]);
  const masteredCount = patternData?.masteredCount ?? 0;

  // Pick the most prominent returning pattern. Preference: returning active,
  // then first returning queued row.
  const returningPattern = useMemo(() => {
    if (active?.isReturning) return active;
    return queued.find((q) => q.isReturning) ?? null;
  }, [active, queued]);

  const showBanner = !bannerDismissed && returningPattern != null;

  const showToast = (text: string) => {
    setSwapToast(text);
    if (toastTimer.current != null) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => {
      setSwapToast(null);
    }, SWAP_TOAST_MS);
  };

  const handleSwap = async (target: QueuedPattern) => {
    const prevActive = active;
    const prevActiveLabel = prevActive ? labelFor(prevActive) : null;
    const targetLabel = labelFor(target);
    const prevActiveNoProgress =
      prevActive != null && prevActive.levelProgress.completed === 0;

    // Optimistic update
    queryClient.setQueryData<PatternTasksResponse>(['pattern-tasks'], (prev) =>
      applyOptimisticSwap(prev, target),
    );

    // Toast suppression if re-swapping the same pattern within 10s.
    const now = Date.now();
    const suppressToast =
      lastSwapRef.current != null &&
      lastSwapRef.current.fromId === target.patternId &&
      now - lastSwapRef.current.at < RESWAP_SUPPRESS_WINDOW_MS;

    if (!suppressToast) {
      if (prevActiveLabel) {
        showToast(
          prevActiveNoProgress
            ? `Now practicing "${targetLabel}". Previous pattern saved.`
            : `Now practicing "${targetLabel}". "${prevActiveLabel}" saved for later.`,
        );
      } else {
        showToast(`Now practicing "${targetLabel}".`);
      }
    }

    lastSwapRef.current = {
      fromId: prevActive?.patternId ?? null,
      at: now,
    };

    try {
      const res = await authFetch(`/practice/patterns/${target.patternId}/activate`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      // Authoritative refresh — pulls real exercises for the new active.
      await queryClient.invalidateQueries({ queryKey: ['pattern-tasks'] });
    } catch (err) {
      // Revert on failure
      await queryClient.invalidateQueries({ queryKey: ['pattern-tasks'] });
      showToast("Couldn't swap that pattern. Try again.");
    }
  };

  const handleDismissQueued = async (target: QueuedPattern) => {
    // Fade then optimistic remove
    setDismissingIds((prev) => {
      const next = new Set(prev);
      next.add(target.patternId);
      return next;
    });

    setTimeout(async () => {
      queryClient.setQueryData<PatternTasksResponse>(
        ['pattern-tasks'],
        (prev) =>
          prev
            ? {
                ...prev,
                queued: prev.queued.filter(
                  (q) => q.patternId !== target.patternId,
                ),
                queuedCount: Math.max(0, (prev.queuedCount ?? 0) - 1),
              }
            : prev,
      );
      try {
        const res = await authFetch(
          `/practice/patterns/${target.patternId}/dismiss`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason: 'not_a_pattern' }),
          },
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        await queryClient.invalidateQueries({ queryKey: ['pattern-tasks'] });
      } catch (err) {
        await queryClient.invalidateQueries({ queryKey: ['pattern-tasks'] });
        showToast("Couldn't dismiss that pattern. Try again.");
      } finally {
        setDismissingIds((prev) => {
          const next = new Set(prev);
          next.delete(target.patternId);
          return next;
        });
      }
    }, 300);
  };

  const handleLongPressQueued = (pattern: QueuedPattern) => {
    const label = labelFor(pattern);
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: `"${label}"`,
          options: ['Cancel', 'Make Active', 'Not actually a pattern'],
          cancelButtonIndex: 0,
          destructiveButtonIndex: 2,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) {
            handleSwap(pattern);
          } else if (buttonIndex === 2) {
            handleDismissQueued(pattern);
          }
        },
      );
    } else {
      Alert.alert(`"${label}"`, undefined, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Make Active', onPress: () => handleSwap(pattern) },
        {
          text: 'Not actually a pattern',
          style: 'destructive',
          onPress: () => handleDismissQueued(pattern),
        },
      ]);
    }
  };

  const handleWatchingTap = (pattern: WatchingPattern) => {
    // Pass the freshest copy of the pattern into the sheet. If the query
    // refreshes while the sheet is open, the sheet will re-derive from the
    // new data via the list's re-render (it reads whatever we hand it).
    setSheetPattern(pattern);
  };
  const handleSheetClose = () => setSheetPattern(null);

  const handleMasteredLink = () => {
    router.push('/mastered-patterns');
  };

  const handleBannerDismiss = () => setBannerDismissed(true);
  const handleBannerTap = () => {
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  const isEmpty =
    active == null && watching.length === 0 && queued.length === 0;

  const rightAction =
    masteredCount > 0
      ? {
          label: 'Mastered',
          onPress: handleMasteredLink,
          color: alpha(colors.white, 0.6),
        }
      : undefined;

  return (
    <View style={styles.container}>
      <ScreenHeader
        variant="back"
        title="Speech Patterns"
        rightAction={rightAction}
      />

      <ScrollView
        ref={scrollRef}
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
      >
        {showBanner && returningPattern && (
          <ReturningBanner
            identifier={labelFor(returningPattern)}
            onPress={handleBannerTap}
            onDismiss={handleBannerDismiss}
          />
        )}

        {isEmpty ? (
          <EmptyState />
        ) : (
          <>
            {active && (
              <View>
                <Text style={styles.sectionLabel}>ACTIVE</Text>
                <View style={styles.heroWrap}>
                  <View style={styles.heroCard}>
                    <PatternTaskCard
                      group={{
                        patternId: active.patternId,
                        type: active.type,
                        identifier: active.identifier,
                        severity: active.severity,
                        description: active.description,
                        exercises: active.exercises,
                      }}
                      isReturning={active.isReturning}
                    />
                  </View>
                  {swapToast != null && (
                    <SwapToast text={swapToast} />
                  )}
                </View>
              </View>
            )}

            {watching.length > 0 && (
              <View>
                <Text
                  style={[styles.sectionLabel, active && styles.sectionLabelSpaced]}
                >
                  WATCHING
                </Text>
                {watching.map((pattern, i) => (
                  <Fragment key={`watching-${pattern.patternId}`}>
                    {i > 0 && <View style={styles.divider} />}
                    <WatchingPatternRow
                      pattern={pattern}
                      onPress={handleWatchingTap}
                    />
                  </Fragment>
                ))}
              </View>
            )}

            {queued.length > 0 && (
              <View>
                <Text
                  style={[
                    styles.sectionLabel,
                    (active || watching.length > 0) && styles.sectionLabelSpaced,
                  ]}
                >
                  QUEUED
                </Text>
                {queued.map((pattern, i) => (
                  <Fragment key={`queued-${pattern.patternId}`}>
                    {i > 0 && <View style={styles.divider} />}
                    <SwapRow
                      pattern={pattern}
                      onSwap={handleSwap}
                      onLongPress={handleLongPressQueued}
                      dismissing={dismissingIds.has(pattern.patternId)}
                    />
                  </Fragment>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>

      <WatchingDetailSheet
        pattern={sheetPattern}
        onClose={handleSheetClose}
      />
    </View>
  );
}

// ── Swap row wrapper (handles entry animation + dismiss fade) ────────────

function SwapRow({
  pattern,
  onSwap,
  onLongPress,
  dismissing,
}: {
  pattern: QueuedPattern;
  onSwap: (p: QueuedPattern) => void;
  onLongPress: (p: QueuedPattern) => void;
  dismissing: boolean;
}) {
  const opacity = useSharedValue(1);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);

  useEffect(() => {
    if (dismissing) {
      opacity.value = withTiming(0, {
        duration: 300,
        easing: Easing.out(Easing.ease),
      });
    } else {
      opacity.value = withTiming(1, { duration: 200 });
    }
  }, [dismissing, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }, { scale: scale.value }],
  }));

  const handleSwapLocal = (p: QueuedPattern) => {
    // Quick spring accent — subtle scale-up pulse to confirm the tap.
    scale.value = withSpring(1.02, { damping: 18, stiffness: 220 }, () => {
      scale.value = withSpring(1, { damping: 18, stiffness: 220 });
    });
    runOnJS(onSwap)(p);
  };

  return (
    <Animated.View style={animatedStyle} pointerEvents={dismissing ? 'none' : 'auto'}>
      <QueuedPatternRow
        pattern={pattern}
        onPress={handleSwapLocal}
        onLongPress={onLongPress}
      />
    </Animated.View>
  );
}

// ── Swap toast ───────────────────────────────────────────────────────────

function SwapToast({ text }: { text: string }) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(-4);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 180 });
    translateY.value = withSpring(0, { damping: 18, stiffness: 220 });
    opacity.value = withDelay(
      SWAP_TOAST_MS - 300,
      withTiming(0, { duration: 300 }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View style={[styles.toast, animatedStyle]}>
      <Text style={styles.toastText} numberOfLines={2}>
        {text}
      </Text>
    </Animated.View>
  );
}

// ── Empty state ──────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <View style={styles.emptyWrap}>
      <Text style={styles.emptyTitle}>Nothing to watch yet.</Text>
      <Text style={styles.emptySubtitle}>
        Speak a few sessions and Reflexa will surface the patterns worth working
        on.
      </Text>
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  sectionLabel: {
    ...typography.labelSm,
    color: alpha(colors.white, 0.3),
    paddingHorizontal: layout.screenPadding,
    marginBottom: 8,
    marginTop: spacing.md,
  },
  sectionLabelSpaced: {
    marginTop: spacing.xl,
  },
  heroWrap: {
    paddingHorizontal: layout.screenPadding,
    gap: spacing.sm,
  },
  heroCard: {
    ...glass.card,
    overflow: 'hidden',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: alpha(colors.white, 0.06),
    marginLeft: layout.screenPadding + 14 + spacing.md,
  },
  toast: {
    backgroundColor: alpha(colors.white, 0.04),
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  toastText: {
    ...typography.bodySm,
    color: alpha(colors.white, 0.6),
  },
  emptyWrap: {
    paddingVertical: 80,
    paddingHorizontal: layout.screenPadding,
    alignItems: 'center',
    gap: spacing.sm,
  },
  emptyTitle: {
    ...typography.headlineSm,
    color: alpha(colors.white, 0.7),
    textAlign: 'center',
  },
  emptySubtitle: {
    ...typography.bodyMd,
    color: alpha(colors.white, 0.35),
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 20,
  },
});
