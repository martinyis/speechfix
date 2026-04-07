import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, {
  FadeIn,
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
  Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { ScreenHeader, GlassIconPillButton } from '../components/ui';
import PracticeRecordOrb from '../components/PracticeRecordOrb';
import PracticeFeedbackPanel from '../components/PracticeFeedbackPanel';
import SuccessCelebration from '../components/SuccessCelebration';
import { wordDiff, formatCorrectionTypeLabel } from '../lib/wordDiff';
import { useWeakSpots } from '../hooks/useWeakSpots';
import { useDrillRecording } from '../hooks/useDrillRecording';
import { authFetch } from '../lib/api';
import { usePreloadSuccessSound, playSuccessSound } from '../lib/sounds';
import { colors, alpha, spacing, layout, fonts } from '../theme';
import type { DrillItem, DrillSummary } from '../types/practice';

const SEVERITY_COLOR: Record<string, string> = {
  error: colors.severityError,
  improvement: colors.severityImprovement,
  polish: colors.severityPolish,
};

export default function WeakSpotDrillScreen() {
  const { weakSpotId } = useLocalSearchParams<{ weakSpotId: string }>();
  const insets = useSafeAreaInsets();
  const { data } = useWeakSpots();
  const recording = useDrillRecording();
  usePreloadSuccessSound();

  const weakSpot = useMemo(() => {
    return data?.activeSpots.find((ws) => ws.id === Number(weakSpotId)) ?? null;
  }, [data, weakSpotId]);

  // Build drill queue: corrections first, then exercises
  const initialQueue = useMemo((): DrillItem[] => {
    if (!weakSpot) return [];
    const items: DrillItem[] = [
      ...weakSpot.corrections.map((c): DrillItem => ({ type: 'correction', data: c })),
      ...weakSpot.exercises.map((e): DrillItem => ({ type: 'exercise', data: e })),
    ];
    return items;
  }, [weakSpot]);

  const [queue, setQueue] = useState<DrillItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [passedSet, setPassedSet] = useState<Set<string>>(new Set());
  const retriesRef = useRef(0);
  const [summary, setSummary] = useState<DrillSummary | null>(null);

  // Initialize queue when data arrives
  useEffect(() => {
    if (initialQueue.length > 0 && queue.length === 0) {
      setQueue(initialQueue);
    }
  }, [initialQueue]);

  const currentItem = queue[currentIndex] ?? null;
  const totalItems = initialQueue.length;

  // Unique key for a drill item
  const itemKey = useCallback((item: DrillItem) => {
    return `${item.type}-${item.data.id}`;
  }, []);

  // Collapsable explanation state
  const [explanationExpanded, setExplanationExpanded] = useState(false);
  const explanationAnim = useSharedValue(0);

  const toggleExplanation = useCallback(() => {
    const next = !explanationExpanded;
    setExplanationExpanded(next);
    explanationAnim.value = withTiming(next ? 1 : 0, {
      duration: 250,
      easing: Easing.out(Easing.cubic),
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [explanationExpanded, explanationAnim]);

  const explanationBodyStyle = useAnimatedStyle(() => ({
    height: interpolate(explanationAnim.value, [0, 1], [0, 60]),
    opacity: interpolate(explanationAnim.value, [0, 0.4, 1], [0, 0, 1]),
    overflow: 'hidden' as const,
  }));

  const explanationChevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${interpolate(explanationAnim.value, [0, 1], [0, 180])}deg` }],
  }));

  // Reset explanation state when switching items
  useEffect(() => {
    setExplanationExpanded(false);
    explanationAnim.value = 0;
  }, [currentIndex]);

  // Recording handlers
  const handleStartRecording = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await recording.start();
  }, [recording]);

  const handleStopRecording = useCallback(async () => {
    if (!currentItem) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await recording.stop(currentItem, Number(weakSpotId));
  }, [recording, currentItem, weakSpotId]);

  // Auto-stop at max duration
  useEffect(() => {
    if (recording.state === 'recording' && recording.elapsedSeconds >= 15) {
      handleStopRecording();
    }
  }, [recording.state, recording.elapsedSeconds, handleStopRecording]);

  const advanceToNext = useCallback(() => {
    const nextIdx = currentIndex + 1;
    if (nextIdx < queue.length) {
      setCurrentIndex(nextIdx);
      recording.reset();
    } else {
      completeDrill();
    }
  }, [currentIndex, queue, recording]);

  const completeDrill = useCallback(async () => {
    try {
      const res = await authFetch('/practice/weak-spot-drill-complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          weakSpotId: Number(weakSpotId),
          allPassed: true,
        }),
      });
      if (res.ok) {
        const data: DrillSummary = await res.json();
        setSummary(data);
      } else {
        setSummary({
          totalItems,
          retriesCount: retriesRef.current,
          resolved: false,
          nextReviewAt: null,
          srsStage: 0,
        });
      }
    } catch {
      setSummary({
        totalItems,
        retriesCount: retriesRef.current,
        resolved: false,
        nextReviewAt: null,
        srsStage: 0,
      });
    }
  }, [weakSpotId, totalItems]);

  // Handle pass/fail
  const handlePass = useCallback(() => {
    if (!currentItem) return;
    const key = itemKey(currentItem);
    setPassedSet((prev) => new Set(prev).add(key));
  }, [currentItem, itemKey]);

  const handleFail = useCallback(() => {
    if (!currentItem) return;
    retriesRef.current += 1;
    setQueue((prev) => [...prev, currentItem]);
  }, [currentItem]);

  const handleTryAgain = useCallback(() => {
    recording.reset();
  }, [recording]);

  const handleSkipToEnd = useCallback(() => {
    if (!currentItem) return;
    retriesRef.current += 1;
    setQueue((prev) => [...prev, currentItem]);
    advanceToNext();
  }, [currentItem, advanceToNext]);

  // On result: auto-advance on pass
  const passed = recording.state === 'result' && recording.result?.passed;

  useEffect(() => {
    if (!passed) return;
    handlePass();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    playSuccessSound();
    const timer = setTimeout(advanceToNext, 1500);
    return () => clearTimeout(timer);
  }, [passed]);

  // Orb state
  const orbState: 'idle' | 'recording' | 'evaluating' | 'success' =
    passed ? 'success'
    : recording.state === 'recording' ? 'recording'
    : recording.state === 'evaluating' ? 'evaluating'
    : 'idle';

  // Dim content during recording or failure
  const contentOpacity = useAnimatedStyle(() => ({
    opacity: withTiming(
      recording.state === 'recording' ? 0.6
      : (recording.state === 'result' && !recording.result?.passed) ? 0.35
      : 1,
      { duration: 200 },
    ),
  }));

  const sevColor = weakSpot ? (SEVERITY_COLOR[weakSpot.severity] ?? colors.severityError) : colors.severityError;

  // Loading state
  if (!weakSpot || queue.length === 0) {
    return (
      <View style={styles.container}>
        <ScreenHeader variant="back" />
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  // Summary / completion screen
  if (summary) {
    const firstTryCount = totalItems - (summary.retriesCount > 0 ? Math.min(summary.retriesCount, totalItems) : 0);

    return (
      <View style={styles.container}>
        <ScreenHeader variant="back" />
        <Animated.View style={styles.summaryContainer} entering={FadeIn.duration(300)}>
          {summary.resolved ? (
            <Animated.View entering={FadeInDown.duration(400).delay(100)}>
              <Ionicons name="checkmark-circle" size={64} color={colors.severityPolish} />
            </Animated.View>
          ) : (
            <Animated.View entering={FadeInDown.duration(400).delay(100)}>
              <Ionicons name="trophy" size={64} color={colors.primary} />
            </Animated.View>
          )}

          <Text style={styles.summaryTitle}>
            {summary.resolved ? 'Resolved!' : 'Drill Complete'}
          </Text>

          <View style={styles.summaryStats}>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Correct on first try</Text>
              <Text style={styles.statValue}>{firstTryCount}/{totalItems}</Text>
            </View>
            {summary.retriesCount > 0 && (
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Retries</Text>
                <Text style={styles.statValue}>{summary.retriesCount}</Text>
              </View>
            )}
            {!summary.resolved && summary.nextReviewAt && (
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Next review</Text>
                <Text style={styles.statValue}>
                  {formatNextReview(summary.nextReviewAt)}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.summaryActions}>
            <GlassIconPillButton
              label="Done"
              icon="checkmark"
              variant="primary"
              fullWidth
              onPress={() => router.back()}
            />
          </View>
        </Animated.View>
      </View>
    );
  }

  const progressFraction = totalItems > 0 ? passedSet.size / totalItems : 0;

  return (
    <View style={styles.container}>
      <ScreenHeader variant="back" />
      <SuccessCelebration visible={!!passed} />

      {/* Gradient progress line — full width, above content */}
      <View style={styles.progressTrack}>
        <Animated.View style={{ width: `${Math.max(progressFraction * 100, 1)}%` as any, height: '100%' }}>
          <LinearGradient
            colors={[colors.primary, colors.secondary] as [string, string]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      </View>

      <View style={styles.body}>
        {/* Prompt content */}
        <Animated.View style={[styles.promptContainer, contentOpacity]}>
          {currentItem.type === 'correction' ? (
            <>
              {/* Original sentence with error underlined */}
              <View>
                <Text style={styles.sectionLabel}>YOUR ORIGINAL</Text>
                <Text style={styles.originalText}>
                  {(() => {
                    const ctx = currentItem.data.fullContext;
                    if (ctx) {
                      const idx = ctx.toLowerCase().indexOf(currentItem.data.originalText.toLowerCase());
                      if (idx >= 0) {
                        const before = ctx.slice(0, idx);
                        const match = ctx.slice(idx, idx + currentItem.data.originalText.length);
                        const after = ctx.slice(idx + currentItem.data.originalText.length);
                        return (
                          <>
                            {before ? <Text>{before}</Text> : null}
                            <Text style={[styles.errorUnderline, { textDecorationColor: sevColor }]}>
                              {match}
                            </Text>
                            {after ? <Text>{after}</Text> : null}
                          </>
                        );
                      }
                    }
                    // Fallback: wordDiff
                    return wordDiff(currentItem.data.originalText, currentItem.data.correctedText).map((seg, i) => (
                      <Text
                        key={i}
                        style={
                          seg.type === 'equal'
                            ? undefined
                            : [styles.errorUnderline, { textDecorationColor: sevColor }]
                        }
                      >
                        {i > 0 ? ' ' : ''}{seg.text}
                      </Text>
                    ));
                  })()}
                </Text>
              </View>

              {/* Correction type pill + Why? toggle */}
              <View style={styles.hintArea}>
                <View style={styles.hintRow}>
                  <View style={styles.correctionTypePill}>
                    <Text style={[styles.correctionTypePillText, { color: sevColor }]}>
                      {formatCorrectionTypeLabel(currentItem.data.correctionType)}
                    </Text>
                  </View>
                  {currentItem.data.explanation ? (
                    <Pressable onPress={toggleExplanation} hitSlop={8} style={styles.explainToggle}>
                      <Text style={styles.explainToggleText}>Why?</Text>
                      <Animated.View style={explanationChevronStyle}>
                        <Ionicons name="chevron-down" size={12} color={alpha(colors.white, 0.3)} />
                      </Animated.View>
                    </Pressable>
                  ) : null}
                </View>
                {currentItem.data.explanation ? (
                  <Animated.View style={explanationBodyStyle}>
                    <Text style={styles.hintText}>{currentItem.data.explanation}</Text>
                  </Animated.View>
                ) : null}
              </View>

              <Text style={styles.instructionText}>Now say the corrected version</Text>
            </>
          ) : (
            <>
              <Text style={styles.sectionLabel}>PRACTICE SENTENCE</Text>
              <Text style={styles.heroText}>{currentItem.data.prompt}</Text>
              <Text style={styles.instructionText}>Say it naturally</Text>
            </>
          )}
        </Animated.View>

        {/* Feedback panel (failure) or record area */}
        {recording.state === 'result' && recording.result && !recording.result.passed ? (
          <PracticeFeedbackPanel
            passed={false}
            feedback={recording.result.feedback}
            transcript={recording.result.transcript}
            correctAnswer={
              currentItem.type === 'correction' ? currentItem.data.correctedText : undefined
            }
            onTryAgain={handleTryAgain}
            onSkip={handleSkipToEnd}
            onDone={() => router.back()}
            bottomInset={insets.bottom}
          />
        ) : (
          <View style={[styles.recordArea, { paddingBottom: insets.bottom + 16 }]}>
            {recording.state === 'evaluating' ? (
              <View style={styles.evaluatingWrap}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.evaluatingText}>Evaluating...</Text>
              </View>
            ) : (
              <PracticeRecordOrb
                state={orbState}
                audioLevel={recording.audioLevel}
                onPress={() => { recording.state === 'recording' ? handleStopRecording() : handleStartRecording(); }}
              />
            )}

            {recording.error && (
              <Text style={styles.errorText}>{recording.error}</Text>
            )}
          </View>
        )}
      </View>
    </View>
  );
}

function formatNextReview(dateStr: string): string {
  const diff = new Date(dateStr).getTime() - Date.now();
  const days = Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  if (days === 1) return 'Tomorrow';
  return `In ${days} days`;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  body: {
    flex: 1,
  },

  // Progress line
  progressTrack: {
    height: 2,
    backgroundColor: alpha(colors.white, 0.04),
  },

  // Prompt content
  promptContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: layout.screenPadding + 4,
    gap: 32,
  },
  sectionLabel: {
    fontSize: 10,
    fontFamily: fonts.bold,
    letterSpacing: 1.5,
    color: alpha(colors.white, 0.2),
    marginBottom: 10,
  },
  originalText: {
    fontSize: 20,
    fontFamily: fonts.medium,
    color: alpha(colors.white, 0.85),
    lineHeight: 30,
  },
  errorUnderline: {
    textDecorationLine: 'underline' as const,
    textDecorationStyle: 'solid' as const,
  },

  // Hint area (correction type + explanation)
  hintArea: {
    gap: 10,
  },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  correctionTypePill: {
    alignSelf: 'flex-start' as const,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: alpha(colors.white, 0.06),
  },
  correctionTypePillText: {
    fontSize: 9,
    fontFamily: fonts.bold,
    letterSpacing: 1,
  },
  explainToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  explainToggleText: {
    fontSize: 12,
    fontFamily: fonts.semibold,
    color: alpha(colors.white, 0.3),
  },
  hintText: {
    fontSize: 14,
    fontFamily: fonts.medium,
    color: alpha(colors.white, 0.4),
    lineHeight: 20,
    fontStyle: 'italic' as const,
  },

  heroText: {
    fontSize: 22,
    fontFamily: fonts.semibold,
    color: alpha(colors.white, 0.9),
    lineHeight: 32,
  },
  instructionText: {
    fontSize: 13,
    fontFamily: fonts.semibold,
    color: alpha(colors.white, 0.2),
    textAlign: 'center' as const,
  },

  // Record area
  recordArea: {
    alignItems: 'center',
    gap: spacing.md,
  },
  evaluatingWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: spacing.xl,
  },
  evaluatingText: {
    fontSize: 15,
    fontFamily: fonts.medium,
    color: alpha(colors.white, 0.5),
  },
  errorText: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: colors.severityError,
    textAlign: 'center',
  },

  // Summary
  summaryContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: layout.screenPadding,
    gap: spacing.md,
  },
  summaryTitle: {
    fontSize: 26,
    fontFamily: fonts.extrabold,
    color: colors.onSurface,
    letterSpacing: -0.5,
    marginTop: spacing.sm,
  },
  summaryStats: {
    gap: 12,
    marginTop: spacing.lg,
    width: '100%',
    maxWidth: 280,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: alpha(colors.white, 0.4),
  },
  statValue: {
    fontSize: 14,
    fontFamily: fonts.semibold,
    color: alpha(colors.white, 0.8),
  },
  summaryActions: {
    width: '100%',
    maxWidth: 300,
    marginTop: spacing.xl,
  },
});
