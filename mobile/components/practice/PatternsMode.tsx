import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActionSheetIOS,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useQueryClient } from '@tanstack/react-query';
import Animated, {
  Easing,
  FadeIn,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { GlassIconPillButton } from '../ui';
import { QueuedPatternRow } from '../pattern/QueuedPatternRow';
import { WatchingPatternRow } from '../pattern/WatchingPatternRow';
import { WatchingDetailSheet } from '../pattern/WatchingDetailSheet';
import { ReturningBanner } from '../pattern/ReturningBanner';
import { authFetch } from '../../lib/api';
import {
  alpha,
  colors,
  fonts,
  layout,
  spacing,
  typography,
} from '../../theme';
import type {
  ActivePattern,
  PatternTasksResponse,
  QueuedPattern,
  WatchingPattern,
} from '../../types/practice';

const PATTERN_TYPE_LABEL: Record<string, string> = {
  overused_word: 'Overused Word',
  repetitive_starter: 'Sentence Starter',
  crutch_phrase: 'Crutch Phrase',
  hedging: 'Hedging',
  negative_framing: 'Negative Framing',
};

const LEVEL_LABEL: Record<number, string> = {
  1: 'LEVEL 1 — GUIDED',
  2: 'LEVEL 2 — FREE',
};

const SWAP_TOAST_MS = 2800;

function labelFor(pattern: { identifier: string | null; type: string }): string {
  return pattern.identifier
    ? pattern.identifier
    : PATTERN_TYPE_LABEL[pattern.type] ?? pattern.type;
}

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
  return { ...prev, active: newActive, queued: newQueued };
}

interface PatternsModeProps {
  active: ActivePattern | null;
  queued: QueuedPattern[];
  watching?: WatchingPattern[];
  returning?: boolean;
  masteredCount?: number;
}

export function PatternsMode({
  active,
  queued,
  watching = [],
  returning = false,
  masteredCount = 0,
}: PatternsModeProps) {
  const queryClient = useQueryClient();

  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [swapToast, setSwapToast] = useState<string | null>(null);
  const [dismissingIds, setDismissingIds] = useState<Set<number>>(new Set());
  const [activatingId, setActivatingId] = useState<number | null>(null);
  const [sheetPattern, setSheetPattern] = useState<WatchingPattern | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (toastTimer.current != null) clearTimeout(toastTimer.current);
    },
    [],
  );

  const returningPattern = useMemo(() => {
    if (active?.isReturning) return active;
    return queued.find((q) => q.isReturning) ?? null;
  }, [active, queued]);

  const showBanner = returning && !bannerDismissed && returningPattern != null;

  const showToast = useCallback((text: string) => {
    setSwapToast(text);
    if (toastTimer.current != null) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setSwapToast(null), SWAP_TOAST_MS);
  }, []);

  const handleSwap = useCallback(
    async (target: QueuedPattern) => {
      // Intentionally NO optimistic setQueryData here — we don't want the UP
      // NEXT list on the Practice tab to re-flow before navigation. Mark the
      // tapped row as "activating" for subtle visual feedback, then wait for
      // `/activate` + refetch to finish so the practice session screen opens
      // with fresh data already in place.
      setActivatingId(target.patternId);

      try {
        const res = await authFetch(
          `/practice/patterns/${target.patternId}/activate`,
          { method: 'POST' },
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        // Refetch while the Practice tab is still mounted is fine because we
        // navigate on the next line before React paints the updated list.
        await queryClient.refetchQueries({ queryKey: ['pattern-tasks'] });

        router.push({
          pathname: '/pattern-practice-session',
          params: { patternId: String(target.patternId) },
        });
      } catch {
        await queryClient.invalidateQueries({ queryKey: ['pattern-tasks'] });
        showToast("Couldn't swap that pattern. Try again.");
      } finally {
        setActivatingId(null);
      }
    },
    [queryClient, showToast],
  );

  const handleDismissQueued = useCallback(
    (target: QueuedPattern) => {
      setDismissingIds((prev) => {
        const next = new Set(prev);
        next.add(target.patternId);
        return next;
      });
      setTimeout(async () => {
        queryClient.setQueryData<PatternTasksResponse>(['pattern-tasks'], (prev) =>
          prev
            ? {
                ...prev,
                queued: prev.queued.filter((q) => q.patternId !== target.patternId),
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
        } catch {
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
    },
    [queryClient, showToast],
  );

  const handleLongPressQueued = useCallback(
    (pattern: QueuedPattern) => {
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
            if (buttonIndex === 1) handleSwap(pattern);
            else if (buttonIndex === 2) handleDismissQueued(pattern);
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
    },
    [handleSwap, handleDismissQueued],
  );

  const handleMasteredLink = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/mastered-patterns');
  };

  const isEmpty =
    active == null && watching.length === 0 && queued.length === 0;

  if (isEmpty) {
    return (
      <View style={styles.root}>
        {showBanner && returningPattern && (
          <ReturningBanner
            identifier={labelFor(returningPattern)}
            onDismiss={() => setBannerDismissed(true)}
          />
        )}
        {masteredCount > 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyTitle}>Quiet for now.</Text>
            <Text style={styles.emptySubtitle}>
              You've mastered {masteredCount}{' '}
              {masteredCount === 1 ? 'pattern' : 'patterns'}.{'\n'}
              The next one will show up after your next session.
            </Text>
            <View style={styles.emptyActions}>
              <GlassIconPillButton
                label="View mastered"
                variant="secondary"
                noIcon
                onPress={handleMasteredLink}
              />
            </View>
          </View>
        ) : (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyTitle}>Nothing to watch yet.</Text>
            <Text style={styles.emptySubtitle}>
              Speak a few sessions and Reflexa will surface the patterns worth
              working on.
            </Text>
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {showBanner && returningPattern && (
        <ReturningBanner
          identifier={labelFor(returningPattern)}
          onDismiss={() => setBannerDismissed(true)}
        />
      )}

      {/* Active hero — flat, no card. Keyed on patternId so the content fades
          in when the user swaps to a different pattern. */}
      {active && (
        <View style={styles.activeHero}>
          <Animated.View
            key={`active-${active.patternId}`}
            entering={FadeIn.duration(150)}
            style={styles.activeInner}
          >
            <View style={styles.activeHeader}>
              <Text style={styles.activeIdentifier} numberOfLines={1}>
                {active.identifier
                  ? `"${active.identifier}"`
                  : PATTERN_TYPE_LABEL[active.type] ?? active.type}
              </Text>
              {active.isReturning && (
                <View style={styles.returningBadge}>
                  <Text style={styles.returningBadgeText}>Came back</Text>
                </View>
              )}
            </View>

            {active.isReturning ? (
              <Text style={styles.returningSubtitle}>
                {active.identifier
                  ? `"${active.identifier}" came back. This is normal — let's watch it again.`
                  : `${PATTERN_TYPE_LABEL[active.type] ?? active.type} came back. This is normal — let's watch it again.`}
              </Text>
            ) : null}

            <View style={styles.progressRow}>
              <View style={styles.progressBarBg}>
                <View
                  style={[
                    styles.progressBarFill,
                    {
                      width:
                        active.levelProgress.total > 0
                          ? `${(active.levelProgress.completed / active.levelProgress.total) * 100}%`
                          : '0%',
                    },
                  ]}
                />
              </View>
              <Text style={styles.progressFraction}>
                {active.levelProgress.completed}/{active.levelProgress.total}
              </Text>
            </View>

            <View style={styles.activeMeta}>
              <Text style={styles.activeLevel}>
                {LEVEL_LABEL[active.currentLevel] ?? `LEVEL ${active.currentLevel}`}
              </Text>
              {active.identifier && (
                <>
                  <Text style={styles.activeMetaDot}> · </Text>
                  <Text style={styles.activeType} numberOfLines={1}>
                    {PATTERN_TYPE_LABEL[active.type] ?? active.type}
                  </Text>
                </>
              )}
            </View>

            <GlassIconPillButton
              icon="play"
              label="Continue Practicing"
              variant="primary"
              fullWidth
              onPress={() =>
                router.push({
                  pathname: '/pattern-practice-session',
                  params: { patternId: String(active.patternId) },
                })
              }
            />
          </Animated.View>

          {swapToast != null && <SwapToast text={swapToast} />}
        </View>
      )}

      {/* Watching section */}
      {watching.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>WATCHING</Text>
          {watching.map((pattern, i) => (
            <Fragment key={`watching-${pattern.patternId}`}>
              {i > 0 && <View style={styles.divider} />}
              <WatchingPatternRow
                pattern={pattern}
                onPress={(p) => setSheetPattern(p)}
              />
            </Fragment>
          ))}
        </View>
      )}

      {/* Up next (queued) section */}
      {queued.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>UP NEXT</Text>
          {queued.map((pattern, i) => (
            <Fragment key={`queued-${pattern.patternId}`}>
              {i > 0 && <View style={styles.divider} />}
              <SwapRow
                pattern={pattern}
                onSwap={handleSwap}
                onLongPress={handleLongPressQueued}
                dismissing={dismissingIds.has(pattern.patternId)}
                activating={activatingId === pattern.patternId}
              />
            </Fragment>
          ))}
        </View>
      )}

      {/* Mastered footer link */}
      {masteredCount > 0 && (
        <Pressable style={styles.masteredFooter} onPress={handleMasteredLink}>
          <Text style={styles.masteredFooterText}>
            {masteredCount} {masteredCount === 1 ? 'pattern' : 'patterns'} mastered
          </Text>
          <Ionicons
            name="chevron-forward"
            size={14}
            color={alpha(colors.white, 0.45)}
          />
        </Pressable>
      )}

      <WatchingDetailSheet
        pattern={sheetPattern}
        onClose={() => setSheetPattern(null)}
      />
    </View>
  );
}

// ── SwapRow (entry/exit animation wrapper for queued rows) ──────────────

function SwapRow({
  pattern,
  onSwap,
  onLongPress,
  dismissing,
  activating,
}: {
  pattern: QueuedPattern;
  onSwap: (p: QueuedPattern) => void;
  onLongPress: (p: QueuedPattern) => void;
  dismissing: boolean;
  activating: boolean;
}) {
  const opacity = useSharedValue(1);
  const scale = useSharedValue(1);

  useEffect(() => {
    if (dismissing) {
      opacity.value = withTiming(0, {
        duration: 300,
        easing: Easing.out(Easing.ease),
      });
    } else if (activating) {
      opacity.value = withTiming(0.5, { duration: 150 });
    } else {
      opacity.value = withTiming(1, { duration: 150 });
    }
  }, [dismissing, activating, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  const handleSwapLocal = (p: QueuedPattern) => {
    scale.value = withSpring(1.02, { damping: 18, stiffness: 220 }, () => {
      scale.value = withSpring(1, { damping: 18, stiffness: 220 });
    });
    runOnJS(onSwap)(p);
  };

  return (
    <Animated.View
      style={animatedStyle}
      pointerEvents={dismissing || activating ? 'none' : 'auto'}
    >
      <QueuedPatternRow
        pattern={pattern}
        onPress={handleSwapLocal}
        onLongPress={onLongPress}
      />
    </Animated.View>
  );
}

// ── SwapToast ───────────────────────────────────────────────────────────

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

// ── Styles ──────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },

  // Active hero (flat — no glass card)
  activeHero: {
    paddingHorizontal: layout.screenPadding,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  activeInner: {
    gap: spacing.sm,
  },
  activeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  activeIdentifier: {
    ...typography.headlineMd,
    color: colors.onSurface,
    flexShrink: 1,
  },
  returningBadge: {
    backgroundColor: alpha(colors.tertiary, 0.15),
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  returningBadgeText: {
    fontSize: 10,
    fontFamily: fonts.bold,
    color: colors.tertiary,
    letterSpacing: 0.5,
  },
  returningSubtitle: {
    ...typography.bodySm,
    color: alpha(colors.white, 0.55),
    lineHeight: 18,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  progressBarBg: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: alpha(colors.white, 0.08),
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: colors.primary,
  },
  progressFraction: {
    ...typography.labelSm,
    color: alpha(colors.white, 0.5),
    minWidth: 30,
    textAlign: 'right',
  },
  activeMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  activeLevel: {
    ...typography.labelSm,
    color: alpha(colors.white, 0.5),
    letterSpacing: 1,
  },
  activeMetaDot: {
    ...typography.labelSm,
    color: alpha(colors.white, 0.25),
  },
  activeType: {
    ...typography.labelSm,
    color: alpha(colors.white, 0.5),
  },

  // Sections (watching / up next)
  section: {
    marginTop: spacing.lg,
  },
  sectionLabel: {
    ...typography.labelSm,
    color: alpha(colors.white, 0.3),
    letterSpacing: 1,
    paddingHorizontal: layout.screenPadding,
    marginBottom: 8,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: alpha(colors.white, 0.06),
    marginLeft: layout.screenPadding + 14 + spacing.md,
  },

  // Mastered footer link
  masteredFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: spacing.lg,
    marginTop: spacing.md,
  },
  masteredFooterText: {
    ...typography.bodySmMedium,
    color: alpha(colors.white, 0.55),
  },

  // Toast
  toast: {
    backgroundColor: alpha(colors.white, 0.04),
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    marginTop: spacing.sm,
  },
  toastText: {
    ...typography.bodySm,
    color: alpha(colors.white, 0.6),
  },

  // Empty state
  emptyWrap: {
    paddingVertical: 60,
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
  emptyActions: {
    marginTop: spacing.md,
  },
});
