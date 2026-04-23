import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
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
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { ScreenHeader, GlassIconPillButton } from '../components/ui';
import { SuccessScreen } from '../components/success';
import PracticeRecordOrb from '../components/orbs/PracticeRecordOrb';
import PracticeFeedbackPanel from '../components/PracticeFeedbackPanel';
import SuccessCelebration from '../components/SuccessCelebration';
import DrillPrompt from '../components/practice/DrillPrompt';
import { useWeakSpots } from '../hooks/data/useWeakSpots';
import { useDrillRecording } from '../hooks/recording/useDrillRecording';
import { authFetch } from '../lib/api';
import { usePreloadSuccessSound, playSuccessSound } from '../lib/sounds';
import { colors, alpha, spacing, layout, fonts } from '../theme';
import type { DrillItem, DrillSummary } from '../types/practice';

export default function WeakSpotDrillScreen() {
  const { weakSpotId } = useLocalSearchParams<{ weakSpotId: string }>();
  const insets = useSafeAreaInsets();
  const { data } = useWeakSpots();
  const recording = useDrillRecording();
  usePreloadSuccessSound();

  const weakSpot = useMemo(() => {
    return data?.activeSpots.find((ws) => ws.id === Number(weakSpotId)) ?? null;
  }, [data, weakSpotId]);

  // Build drill queue: unpracticed corrections first, then unpracticed exercises
  const initialQueue = useMemo((): DrillItem[] => {
    if (!weakSpot) return [];
    const items: DrillItem[] = [
      ...weakSpot.corrections.filter((c) => !c.practiced).map((c): DrillItem => ({ type: 'correction', data: c })),
      ...weakSpot.exercises.filter((e) => !e.practiced).map((e): DrillItem => ({ type: 'exercise', data: e })),
    ];
    return items;
  }, [weakSpot]);

  const [queue, setQueue] = useState<DrillItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [passedSet, setPassedSet] = useState<Set<string>>(new Set());
  const retriesRef = useRef(0);
  const [summary, setSummary] = useState<DrillSummary | null>(null);

  // Initialize queue when data arrives; if all practiced, complete immediately
  useEffect(() => {
    if (weakSpot && initialQueue.length === 0 && queue.length === 0 && !summary) {
      completeDrill();
      return;
    }
    if (initialQueue.length > 0 && queue.length === 0) {
      setQueue(initialQueue);
    }
  }, [initialQueue, weakSpot]);

  const currentItem = queue[currentIndex] ?? null;

  // Total items across ALL corrections + exercises (practiced and unpracticed)
  const totalAllItems = weakSpot ? weakSpot.corrections.length + weakSpot.exercises.length : 0;
  const alreadyPracticed = weakSpot
    ? weakSpot.corrections.filter(c => c.practiced).length + weakSpot.exercises.filter(e => e.practiced).length
    : 0;

  // Unique key for a drill item
  const itemKey = useCallback((item: DrillItem) => {
    return `${item.type}-${item.data.id}`;
  }, []);

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
          totalItems: totalAllItems,
          retriesCount: retriesRef.current,
          resolved: false,
          nextReviewAt: null,
          srsStage: 0,
        });
      }
    } catch {
      setSummary({
        totalItems: totalAllItems,
        retriesCount: retriesRef.current,
        resolved: false,
        nextReviewAt: null,
        srsStage: 0,
      });
    }
  }, [weakSpotId, totalAllItems]);

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
    const totalItems = summary.totalItems;
    const firstTryCount = totalItems - (summary.retriesCount > 0 ? Math.min(summary.retriesCount, totalItems) : 0);

    const stats: { label: string; value: string }[] = [
      { label: 'Correct on first try', value: `${firstTryCount}/${totalItems}` },
    ];
    if (summary.retriesCount > 0) {
      stats.push({ label: 'Retries', value: String(summary.retriesCount) });
    }
    if (!summary.resolved && summary.nextReviewAt) {
      stats.push({ label: 'Next review', value: formatNextReview(summary.nextReviewAt) });
    }

    return (
      <SuccessScreen
        eyebrow="Drill"
        title={summary.resolved ? 'Resolved' : 'Drill Complete'}
        subtitle={
          summary.resolved
            ? 'You cleared this weak spot. It\u2019s retired.'
            : 'Queue cleared. One more strong round and this is retired.'
        }
        tone={summary.resolved ? 'polish' : 'victorious'}
        stats={stats}
        actions={[
          {
            label: 'Done',
            icon: 'checkmark',
            variant: summary.resolved ? 'success' : 'primary',
            onPress: () => router.back(),
          },
        ]}
      />
    );
  }

  const progressFraction = totalAllItems > 0 ? (alreadyPracticed + passedSet.size) / totalAllItems : 0;

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

      {(() => {
        const { originalText, correctedText, explanation, severity } = currentItem.data;
        const context = currentItem.type === 'correction' ? currentItem.data.fullContext : null;
        const shortReason = currentItem.type === 'correction' ? currentItem.data.shortReason : null;

        return (
          <View style={styles.body}>
            <Animated.ScrollView
              style={[styles.promptScroll, contentOpacity]}
              contentContainerStyle={styles.promptContainer}
              showsVerticalScrollIndicator={false}
            >
              <DrillPrompt
                key={`${currentItem.type}-${currentItem.data.id}`}
                originalText={originalText}
                correctedText={correctedText}
                context={context}
                severity={severity}
                shortReason={shortReason}
                explanation={explanation}
              />
            </Animated.ScrollView>

            {recording.state === 'result' && recording.result && !recording.result.passed ? (
              <PracticeFeedbackPanel
                passed={false}
                feedback={recording.result.feedback}
                transcript={recording.result.transcript}
                correctAnswer={correctedText}
                onTryAgain={handleTryAgain}
                onSkip={handleSkipToEnd}
                onDone={() => router.back()}
                bottomInset={insets.bottom}
              />
            ) : (
              <View style={[styles.recordArea, { paddingBottom: insets.bottom + 16 }]}>
                <PracticeRecordOrb
                  state={orbState}
                  audioLevel={recording.audioLevel}
                  onPress={() => { recording.state === 'recording' ? handleStopRecording() : handleStartRecording(); }}
                />

                {recording.error && (
                  <Text style={styles.errorText}>{recording.error}</Text>
                )}
              </View>
            )}
          </View>
        );
      })()}
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
  promptScroll: {
    flex: 1,
  },
  promptContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: layout.screenPadding + 4,
    paddingVertical: spacing.md,
    gap: 32,
  },
  // Record area
  recordArea: {
    alignItems: 'center',
    gap: spacing.md,
  },
  errorText: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: colors.severityError,
    textAlign: 'center',
  },

});
