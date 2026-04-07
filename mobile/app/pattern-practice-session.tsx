import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, {
  useAnimatedStyle,
  withTiming,
  FadeIn,
  FadeInDown,
} from 'react-native-reanimated';
import { ScreenHeader, GlassIconPillButton } from '../components/ui';
import PracticeRecordOrb from '../components/PracticeRecordOrb';
import PracticeFeedbackPanel from '../components/PracticeFeedbackPanel';
import SuccessCelebration from '../components/SuccessCelebration';
import { usePatternTasks } from '../hooks/usePatternTasks';
import { usePatternPracticeRecording } from '../hooks/usePatternPracticeRecording';
import { authFetch } from '../lib/api';
import { usePreloadSuccessSound, playSuccessSound } from '../lib/sounds';
import { colors, alpha, spacing, layout, fonts } from '../theme';

const REFRAME_TYPES = ['hedging', 'negative_framing'];

const REFRAME_LABELS: Record<string, string> = {
  hedging: 'Hedging',
  negative_framing: 'Negative Framing',
};

const INSTRUCTION_LABELS: Record<string, (identifier: string | null) => string> = {
  overused_word: (id) => `Say it without "${id}"`,
  repetitive_starter: () => 'Start it differently',
  crutch_phrase: (id) => `Say it without "${id}"`,
  hedging: () => 'Say it like you mean it',
  negative_framing: () => 'Flip it positive',
};

function highlightTarget(sentence: string, target: string) {
  const parts: { text: string; highlight: boolean }[] = [];
  const lower = sentence.toLowerCase();
  const targetLower = target.toLowerCase();
  let searchFrom = 0;

  while (searchFrom < sentence.length) {
    const found = lower.indexOf(targetLower, searchFrom);
    if (found === -1) {
      parts.push({ text: sentence.slice(searchFrom), highlight: false });
      break;
    }
    if (found > searchFrom) {
      parts.push({ text: sentence.slice(searchFrom, found), highlight: false });
    }
    parts.push({ text: sentence.slice(found, found + target.length), highlight: true });
    searchFrom = found + target.length;
  }

  return parts;
}

function highlightPhrases(sentence: string, phrases: string[]) {
  const ranges: { start: number; end: number }[] = [];
  const lower = sentence.toLowerCase();

  for (const phrase of phrases) {
    const phraseLower = phrase.toLowerCase();
    let searchFrom = 0;
    while (searchFrom < sentence.length) {
      const found = lower.indexOf(phraseLower, searchFrom);
      if (found === -1) break;
      ranges.push({ start: found, end: found + phrase.length });
      searchFrom = found + phrase.length;
    }
  }

  if (ranges.length === 0) {
    return [{ text: sentence, highlight: false }];
  }

  ranges.sort((a, b) => a.start - b.start);
  const merged: { start: number; end: number }[] = [ranges[0]];
  for (let i = 1; i < ranges.length; i++) {
    const last = merged[merged.length - 1];
    if (ranges[i].start <= last.end) {
      last.end = Math.max(last.end, ranges[i].end);
    } else {
      merged.push(ranges[i]);
    }
  }

  const parts: { text: string; highlight: boolean }[] = [];
  let cursor = 0;
  for (const range of merged) {
    if (range.start > cursor) {
      parts.push({ text: sentence.slice(cursor, range.start), highlight: false });
    }
    parts.push({ text: sentence.slice(range.start, range.end), highlight: true });
    cursor = range.end;
  }
  if (cursor < sentence.length) {
    parts.push({ text: sentence.slice(cursor), highlight: false });
  }

  return parts;
}

export default function PatternPracticeSessionScreen() {
  const insets = useSafeAreaInsets();

  const { data: patternData, refetch: refetchPatterns } = usePatternTasks();
  const recording = usePatternPracticeRecording();
  usePreloadSuccessSound();

  const active = patternData?.active ?? null;

  // Queue management
  const [exerciseQueue, setExerciseQueue] = useState<number[]>([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const requeueCountRef = useRef<Record<number, number>>({});
  const [completionState, setCompletionState] = useState<
    'level_complete' | 'pattern_complete' | null
  >(null);
  const [altIndex, setAltIndex] = useState(0);

  // Build exercise queue on mount / when active changes
  useEffect(() => {
    if (active && exerciseQueue.length === 0) {
      const unpracticed = active.exercises
        .filter((e) => !e.practiced)
        .map((e) => e.id);
      if (unpracticed.length > 0) {
        setExerciseQueue(unpracticed);
      }
    }
  }, [active]);

  const currentExerciseId = exerciseQueue[queueIndex];
  const currentExercise = useMemo(() => {
    return active?.exercises.find((e) => e.id === currentExerciseId) ?? null;
  }, [active, currentExerciseId]);

  // Handlers
  const handleStartRecording = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await recording.start();
  }, [recording]);

  const handleStopRecording = useCallback(async () => {
    if (!currentExerciseId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await recording.stop(currentExerciseId);
  }, [recording, currentExerciseId]);

  // Auto-stop at max duration
  useEffect(() => {
    if (recording.state === 'recording' && recording.elapsedSeconds >= 15) {
      handleStopRecording();
    }
  }, [recording.state, recording.elapsedSeconds, handleStopRecording]);

  const handleTryAgain = useCallback(() => {
    recording.reset();
  }, [recording]);

  const handleDone = useCallback(() => {
    refetchPatterns();
    router.back();
  }, [refetchPatterns]);

  // Handle level transition — refetch to get L2 exercises then rebuild queue
  const handleLevelTransition = useCallback(async () => {
    await refetchPatterns();
    // Reset queue state so useEffect rebuilds from new exercises
    setExerciseQueue([]);
    setQueueIndex(0);
    requeueCountRef.current = {};
    setCompletionState(null);
    setAltIndex(0);
    recording.reset();
  }, [refetchPatterns, recording]);

  // Handle full pattern completion
  const handlePatternComplete = useCallback(async () => {
    try {
      await authFetch('/practice/pattern-complete', { method: 'POST' });
    } catch {}
    refetchPatterns();
    router.back();
  }, [refetchPatterns]);

  const handleNext = useCallback(() => {
    const currentId = exerciseQueue[queueIndex];
    const passed = recording.result?.passed;
    const levelCompleted = (recording.result as any)?.levelCompleted;
    const patternCompleted = (recording.result as any)?.patternCompleted;

    // Check server-signaled completion first
    if (passed && patternCompleted) {
      setCompletionState('pattern_complete');
      return;
    }
    if (passed && levelCompleted === 1) {
      setCompletionState('level_complete');
      return;
    }

    let newQueue = [...exerciseQueue];
    if (!passed && currentId) {
      const count = requeueCountRef.current[currentId] || 0;
      if (count < 3) {
        requeueCountRef.current[currentId] = count + 1;
        newQueue = [...newQueue, currentId];
      }
    }

    const nextIdx = queueIndex + 1;
    if (nextIdx < newQueue.length) {
      setExerciseQueue(newQueue);
      setQueueIndex(nextIdx);
      setAltIndex(0);
      recording.reset();
    } else {
      // Client-side: all exercises done but server didn't signal
      // This means either level or pattern is complete
      if (active?.currentLevel === 1) {
        setCompletionState('level_complete');
      } else {
        setCompletionState('pattern_complete');
      }
    }
  }, [exerciseQueue, queueIndex, recording, active]);

  // Compute orb state
  const passed = recording.state === 'result' && recording.result?.passed;
  const orbState: 'idle' | 'recording' | 'evaluating' | 'success' =
    passed ? 'success'
    : recording.state === 'recording' ? 'recording'
    : recording.state === 'evaluating' ? 'evaluating'
    : 'idle';

  // Auto-advance on success
  useEffect(() => {
    if (!passed) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    playSuccessSound();
    const timer = setTimeout(handleNext, 1500);
    return () => clearTimeout(timer);
  }, [passed]);

  // Dim content during recording or failure result
  const contentOpacity = useAnimatedStyle(() => ({
    opacity: withTiming(
      recording.state === 'recording' ? 0.6
      : (recording.state === 'result' && !recording.result?.passed) ? 0.35
      : 1,
      { duration: 200 },
    ),
  }));

  if (!active || !currentExercise) {
    return (
      <View style={styles.container}>
        <ScreenHeader variant="back" />
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  // Level transition screen
  if (completionState === 'level_complete') {
    return (
      <View style={styles.container}>
        <ScreenHeader variant="back" />
        <Animated.View style={styles.celebrationContainer} entering={FadeIn.duration(300)}>
          <Animated.View entering={FadeInDown.duration(400).delay(100)}>
            <Ionicons name="ribbon" size={64} color={colors.primary} />
          </Animated.View>
          <Text style={styles.celebrationTitle}>Level 1 Complete</Text>
          <Text style={styles.celebrationSubtitle}>
            Now try without hints. Same patterns, no guidance.
          </Text>
          <View style={styles.celebrationActions}>
            <GlassIconPillButton
              label="Start Level 2"
              icon="arrow-forward"
              variant="primary"
              fullWidth
              onPress={handleLevelTransition}
            />
          </View>
        </Animated.View>
      </View>
    );
  }

  // Pattern completion screen
  if (completionState === 'pattern_complete') {
    return (
      <View style={styles.container}>
        <ScreenHeader variant="back" />
        <Animated.View style={styles.celebrationContainer} entering={FadeIn.duration(300)}>
          <Animated.View entering={FadeInDown.duration(400).delay(100)}>
            <Ionicons name="trophy" size={64} color={colors.primary} />
          </Animated.View>
          <Text style={styles.celebrationTitle}>Pattern Complete</Text>
          <Text style={styles.celebrationSubtitle}>
            {active.identifier
              ? `You've mastered "${active.identifier}". On to the next one.`
              : `All ${REFRAME_LABELS[active.type] ?? active.type} exercises complete.`}
          </Text>
          <View style={styles.celebrationActions}>
            <GlassIconPillButton
              label="Back to Practice"
              icon="arrow-back"
              variant="primary"
              fullWidth
              onPress={handlePatternComplete}
            />
          </View>
        </Animated.View>
      </View>
    );
  }

  const isReframe = REFRAME_TYPES.includes(currentExercise.patternType);
  const isLevel2 = currentExercise.level === 2;

  const hasMore = queueIndex + 1 < exerciseQueue.length ||
    (!recording.result?.passed && (requeueCountRef.current[currentExerciseId] || 0) < 3);

  const sentenceParts = isReframe && currentExercise.highlightPhrases
    ? highlightPhrases(currentExercise.originalSentence, currentExercise.highlightPhrases)
    : currentExercise.targetWord
      ? highlightTarget(currentExercise.originalSentence, currentExercise.targetWord)
      : [{ text: currentExercise.originalSentence, highlight: false }];

  const instructionFn = INSTRUCTION_LABELS[currentExercise.patternType];
  const instructionText = instructionFn
    ? instructionFn(active.identifier)
    : 'Say it differently';

  return (
    <View style={styles.container}>
      <ScreenHeader variant="back" />
      <SuccessCelebration visible={!!passed} />

      <View style={styles.body}>
        {/* Level indicator */}
        <View style={styles.levelIndicator}>
          <Text style={styles.levelText}>
            {isLevel2 ? 'LEVEL 2 — FREE' : 'LEVEL 1 — GUIDED'}
          </Text>
        </View>

        <Animated.View style={[styles.promptContainer, contentOpacity]}>
          {isReframe ? (
            <>
              <View>
                <Text style={styles.sectionLabel}>REFRAME</Text>
                <Text style={styles.targetWord}>
                  {REFRAME_LABELS[currentExercise.patternType] ?? currentExercise.patternType}
                </Text>
              </View>

              <View>
                <Text style={styles.sectionLabel}>YOUR ORIGINAL</Text>
                <Text style={styles.originalText}>
                  {sentenceParts.map((part, i) =>
                    part.highlight ? (
                      <Text
                        key={i}
                        style={{
                          backgroundColor: alpha(colors.tertiary, 0.15),
                          color: colors.tertiary,
                        }}
                      >
                        {part.text}
                      </Text>
                    ) : (
                      <Text key={i}>{part.text}</Text>
                    ),
                  )}
                </Text>
              </View>

              {/* Show suggested reframe hint only at Level 1 */}
              {!isLevel2 && currentExercise.suggestedReframe && (
                <View>
                  <Text style={styles.sectionLabel}>TRY SAYING</Text>
                  <Text style={styles.altWord}>{currentExercise.suggestedReframe}</Text>
                </View>
              )}

              <Text style={styles.instructionText}>{instructionText}</Text>
            </>
          ) : (
            <>
              <View>
                <Text style={styles.sectionLabel}>TARGET</Text>
                <Text style={styles.targetWord}>"{currentExercise.targetWord}"</Text>
              </View>

              <View>
                <Text style={styles.sectionLabel}>YOUR ORIGINAL</Text>
                <Text style={styles.originalText}>
                  {sentenceParts.map((part, i) =>
                    part.highlight ? (
                      <Text
                        key={i}
                        style={{
                          backgroundColor: alpha(colors.tertiary, 0.15),
                          color: colors.tertiary,
                        }}
                      >
                        {part.text}
                      </Text>
                    ) : (
                      <Text key={i}>{part.text}</Text>
                    ),
                  )}
                </Text>
              </View>

              {/* Show alternatives hint only at Level 1 */}
              {!isLevel2 && currentExercise.alternatives.length > 0 && (
                <View>
                  <Text style={styles.sectionLabel}>TRY SAYING IT LIKE</Text>
                  <Pressable
                    onPress={() => {
                      if (currentExercise.alternatives.length > 1) {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setAltIndex((prev) => (prev + 1) % currentExercise.alternatives.length);
                      }
                    }}
                    style={styles.altTappable}
                  >
                    <Text style={styles.altWord}>
                      {currentExercise.alternatives[altIndex % currentExercise.alternatives.length]}
                    </Text>
                    {currentExercise.alternatives.length > 1 && (
                      <Ionicons name="shuffle" size={20} color={alpha(colors.white, 0.25)} />
                    )}
                  </Pressable>
                </View>
              )}

              <Text style={styles.instructionText}>{instructionText}</Text>
            </>
          )}
        </Animated.View>

        {/* Feedback panel (failure only) or recording/success area */}
        {recording.state === 'result' && recording.result && !recording.result.passed ? (
          <PracticeFeedbackPanel
            passed={false}
            feedback={recording.result.feedback}
            transcript={recording.result.transcript}
            correctAnswer={isReframe && !isLevel2 ? (currentExercise.suggestedReframe ?? undefined) : undefined}
            onTryAgain={handleTryAgain}
            onNext={hasMore ? handleNext : undefined}
            onDone={handleDone}
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
                onPress={recording.state === 'recording' ? handleStopRecording : handleStartRecording}
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

  // Level indicator
  levelIndicator: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  levelText: {
    fontSize: 10,
    fontFamily: fonts.bold,
    letterSpacing: 2,
    color: alpha(colors.primary, 0.5),
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
  targetWord: {
    fontSize: 28,
    fontFamily: fonts.extrabold,
    color: colors.tertiary,
    letterSpacing: -0.5,
  },
  originalText: {
    fontSize: 20,
    fontFamily: fonts.medium,
    color: alpha(colors.white, 0.85),
    lineHeight: 30,
  },
  altTappable: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  altWord: {
    fontSize: 22,
    fontFamily: fonts.semibold,
    color: alpha(colors.white, 0.85),
    lineHeight: 28,
  },
  instructionText: {
    fontSize: 13,
    fontFamily: fonts.semibold,
    color: alpha(colors.white, 0.2),
    textAlign: 'center',
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

  // Celebration
  celebrationContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: layout.screenPadding,
    gap: spacing.md,
  },
  celebrationTitle: {
    fontSize: 26,
    fontFamily: fonts.extrabold,
    color: colors.onSurface,
    letterSpacing: -0.5,
    marginTop: spacing.sm,
  },
  celebrationSubtitle: {
    fontSize: 15,
    fontFamily: fonts.regular,
    color: alpha(colors.white, 0.45),
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 280,
  },
  celebrationActions: {
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xl,
    width: '100%',
    maxWidth: 300,
  },
});
