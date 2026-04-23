import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
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
import { SuccessScreen } from '../components/success';
import PracticeRecordOrb from '../components/orbs/PracticeRecordOrb';
import PracticeFeedbackPanel from '../components/PracticeFeedbackPanel';
import SuccessCelebration from '../components/SuccessCelebration';
import { usePatternTasks } from '../hooks/data/usePatternTasks';
import { usePatternPracticeRecording } from '../hooks/recording/usePatternPracticeRecording';
import { authFetch } from '../lib/api';
import { usePreloadSuccessSound, playSuccessSound } from '../lib/sounds';
import { colors, alpha, spacing, layout, fonts } from '../theme';

const REFRAME_TYPES = ['hedging', 'negative_framing'];

const REFRAME_LABELS: Record<string, string> = {
  hedging: 'Hedging',
  negative_framing: 'Negative Framing',
};

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

// Icon per pattern type. Reframes get a "sparkles" feel; repeated-use patterns
// get a "repeat" feel. Keeps the header lightly themed without a headline.
function patternIcon(patternType: string): IoniconName {
  switch (patternType) {
    case 'hedging':
    case 'negative_framing':
      return 'sparkles-outline';
    case 'overused_word':
    case 'crutch_phrase':
    case 'repetitive_starter':
      return 'repeat-outline';
    default:
      return 'sparkles-outline';
  }
}

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

/**
 * Locate `sentence` inside `context` (case-insensitive). Returns the three
 * slices so callers can render the before/after portions faded and the
 * matched portion at full brightness. Returns null when the sentence can't
 * be found — callers fall back to rendering the sentence on its own.
 */
function splitContextAroundSentence(
  context: string,
  sentence: string,
): { before: string; matched: string; after: string } | null {
  if (!context || !sentence) return null;
  const idx = context.toLowerCase().indexOf(sentence.toLowerCase());
  if (idx < 0) return null;
  const before = context.slice(0, idx);
  const matched = context.slice(idx, idx + sentence.length);
  const after = context.slice(idx + sentence.length);
  if (!before && !after) return null; // no surrounding context to render
  return { before, matched, after };
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
  const params = useLocalSearchParams<{
    patternId?: string;
    fromDrillAgain?: string;
    generating?: string;
  }>();

  const { data: patternData, refetch: refetchPatterns } = usePatternTasks();
  const recording = usePatternPracticeRecording();
  usePreloadSuccessSound();

  const active = patternData?.active ?? null;

  // Drill-again loading state. The sheet navigates here with
  // `fromDrillAgain=1` and `generating=1` when the backend had to generate a
  // fresh exercise pool (no un-practiced exercises existed). Show a loading
  // panel until exercises actually land on the active pattern or until the
  // user-facing timeout elapses.
  const fromDrillAgain = params.fromDrillAgain === '1';
  const generatingExercises = params.generating === '1';
  const drillAgainPatternId = params.patternId ? Number(params.patternId) : null;

  // Keep polling pattern-tasks while we're waiting for fresh exercises. We
  // clear this once the active pattern matches and has exercises.
  const [drillAgainPolling, setDrillAgainPolling] = useState(
    fromDrillAgain && generatingExercises,
  );

  useEffect(() => {
    if (!drillAgainPolling) return;
    const interval = setInterval(() => {
      refetchPatterns();
    }, 1500);
    // Safety net: if generation hangs, stop polling after 30s so the user
    // isn't stuck on an infinite spinner.
    const timeout = setTimeout(() => setDrillAgainPolling(false), 30_000);
    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [drillAgainPolling, refetchPatterns]);

  useEffect(() => {
    if (!drillAgainPolling) return;
    // Exit loading once exercises have arrived for the target pattern.
    const activeMatchesTarget =
      drillAgainPatternId != null && active?.patternId === drillAgainPatternId;
    if (active && active.exercises.length > 0 && activeMatchesTarget) {
      setDrillAgainPolling(false);
    }
  }, [active, drillAgainPatternId, drillAgainPolling]);

  const showGeneratingPanel = drillAgainPolling;

  // Queue management
  const [exerciseQueue, setExerciseQueue] = useState<number[]>([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const requeueCountRef = useRef<Record<number, number>>({});
  const [completionState, setCompletionState] = useState<
    'level_complete' | 'pattern_complete' | null
  >(null);
  const [altIndex, setAltIndex] = useState(0);

  // Snapshot of the active pattern + completion context flags, captured at
  // the moment we transition to pattern_complete. The SuccessScreen copy
  // below picks one of three states from these flags; capturing via ref
  // avoids flicker if patternData refetches underneath us.
  const completionSnapshotRef = useRef<{
    identifier: string | null;
    type: string;
    totalExercises: number;
    isFirstEverDrill: boolean;
    isRedrill: boolean;
  } | null>(null);

  // Capture a snapshot of the active pattern + derived drill-completion
  // context (first-ever vs re-drill vs subsequent). Called right before we
  // flip completionState to 'pattern_complete'. Prefers server-provided
  // flags from the recording result; falls back to client-derived flags
  // from the current patternData snapshot if the server didn't emit them.
  const capturePatternCompletionSnapshot = useCallback(() => {
    if (!active) return;

    const result = recording.result as
      | (Record<string, unknown> & {
          isFirstEverDrill?: boolean;
          isRedrill?: boolean;
        })
      | null;

    // Client-side fallback computation:
    //  - isRedrill: this pattern came back from mastery (isReturning=true)
    //    OR any exercise has practiceCount > 1 (re-run via drill-again).
    //  - isFirstEverDrill: user has no mastered patterns yet AND no other
    //    watching patterns (the one we're finalizing may have already
    //    moved to watching server-side, so watchingCount <= 1 is the
    //    "nothing completed before" signal).
    const anyExerciseRedrilled = active.exercises.some(
      (e) => e.practiceCount > 1,
    );
    const clientIsRedrill = active.isReturning || anyExerciseRedrilled;

    const masteredCount = patternData?.masteredCount ?? 0;
    const watchingCount = patternData?.watchingCount ?? 0;
    const clientIsFirstEverDrill = masteredCount === 0 && watchingCount <= 1;

    const isRedrill =
      typeof result?.isRedrill === 'boolean' ? result.isRedrill : clientIsRedrill;
    const isFirstEverDrill =
      typeof result?.isFirstEverDrill === 'boolean'
        ? result.isFirstEverDrill
        : clientIsFirstEverDrill;

    completionSnapshotRef.current = {
      identifier: active.identifier,
      type: active.type,
      totalExercises: active.exercises.length,
      isFirstEverDrill,
      isRedrill,
    };
  }, [active, patternData, recording.result]);

  // Build exercise queue on mount / when active changes.
  // Heal orphan state: if the active pattern has no exercises at the current
  // level, or every exercise is already practiced, surface the pattern-complete
  // screen so the user can tap through. That POSTs /pattern-complete, which
  // finalizes the pattern server-side and promotes the next queued one.
  useEffect(() => {
    if (!active || completionState !== null) return;
    if (exerciseQueue.length > 0) return;

    const unpracticed = active.exercises
      .filter((e) => !e.practiced)
      .map((e) => e.id);

    if (unpracticed.length > 0) {
      setExerciseQueue(unpracticed);
      return;
    }

    // Orphan state: active pattern with nothing left to practice.
    // No exercises at all (L2 generation failed) → fall back to pattern-complete
    // rather than hang on a loader. Otherwise it's a classic "user backed out
    // before acknowledging completion" — same handling.
    capturePatternCompletionSnapshot();
    setCompletionState('pattern_complete');
  }, [active, completionState, exerciseQueue.length, capturePatternCompletionSnapshot]);

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
      capturePatternCompletionSnapshot();
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
        capturePatternCompletionSnapshot();
        setCompletionState('pattern_complete');
      }
    }
  }, [exerciseQueue, queueIndex, recording, active, capturePatternCompletionSnapshot]);

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

  if (showGeneratingPanel) {
    return (
      <View style={styles.container}>
        <ScreenHeader variant="back" />
        <View style={styles.generatingWrap}>
          <View style={styles.generatingPanel}>
            <Text style={styles.generatingTitle}>Generating exercises…</Text>
            <ActivityIndicator
              size="large"
              color={colors.primary}
              style={styles.generatingSpinner}
            />
            <Text style={styles.generatingHint}>
              This usually takes a few seconds.
            </Text>
          </View>
        </View>
      </View>
    );
  }

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
      <SuccessScreen
        eyebrow="Level 1"
        title="Level 1 Complete"
        subtitle="Now try without hints. Same patterns, no guidance."
        tone="victorious"
        actions={[
          {
            label: 'Start Level 2',
            icon: 'arrow-forward',
            variant: 'primary',
            onPress: handleLevelTransition,
          },
        ]}
      />
    );
  }

  // Pattern completion screen. Drill completion is NOT mastery — finishing
  // L1+L2 moves the pattern to "watching" and real speech sessions decide
  // whether it actually graduates. Copy picks one of three states:
  //   1. isRedrill       → State B ("Back in watching")
  //   2. isFirstEverDrill → State A (full onboarding copy)
  //   3. default         → State C (short "Watching … Keep recording.")
  if (completionState === 'pattern_complete') {
    const snapshot = completionSnapshotRef.current;
    const identifier =
      snapshot?.identifier ?? active.identifier ?? null;
    const totalExercises =
      snapshot?.totalExercises ?? active.exercises.length;
    const isFirstEverDrill = snapshot?.isFirstEverDrill ?? false;
    const isRedrill = snapshot?.isRedrill ?? false;
    const typeLabel =
      REFRAME_LABELS[snapshot?.type ?? active.type] ??
      snapshot?.type ?? active.type;
    // Fallback identifier when the pattern was detected without a specific
    // word (e.g. a reframe category). Keep quotes to match copy spec.
    const displayIdentifier = identifier ?? typeLabel;

    let title: string;
    let subtitle: string;
    if (isRedrill) {
      // State B — re-drill (pattern came back / drilled again).
      title = 'Back in watching';
      subtitle = 'One or two clean sessions should be enough.';
    } else if (isFirstEverDrill) {
      // State A — first-ever drill completion. Explain the new model.
      title = 'Now we watch';
      subtitle = `We'll listen for "${displayIdentifier}" in your next sessions. When the frequency drops, it graduates to mastered.`;
    } else {
      // State C — subsequent drill, user already knows the flow.
      title = 'Now we watch';
      subtitle = `Watching "${displayIdentifier}". Keep recording.`;
    }

    return (
      <SuccessScreen
        eyebrow="Drill complete"
        title={title}
        subtitle={subtitle}
        tone="calm"
        stats={[
          {
            label: 'Exercises completed',
            value: `${totalExercises}/${totalExercises}`,
          },
          { label: 'Next step', value: 'Record a session' },
        ]}
        actions={[
          {
            label: 'Done',
            icon: 'checkmark',
            variant: 'primary',
            onPress: handlePatternComplete,
          },
        ]}
      />
    );
  }

  const isReframe = REFRAME_TYPES.includes(currentExercise.patternType);
  const isLevel2 = currentExercise.level === 2;

  const hasMore = queueIndex + 1 < exerciseQueue.length ||
    (!recording.result?.passed && (requeueCountRef.current[currentExerciseId] || 0) < 3);

  // Prefer rendering the original sentence inside its surrounding session
  // context (faded) so the user recognizes the moment from their real speech.
  // Falls back to the sentence alone when context is missing or the sentence
  // can't be located inside it (legacy rows, or minor transcript drift).
  const contextSplit = currentExercise.fullContext
    ? splitContextAroundSentence(currentExercise.fullContext, currentExercise.originalSentence)
    : null;
  const brightSentence = contextSplit ? contextSplit.matched : currentExercise.originalSentence;

  const sentenceParts = isReframe && currentExercise.highlightPhrases
    ? highlightPhrases(brightSentence, currentExercise.highlightPhrases)
    : currentExercise.targetWord
      ? highlightTarget(brightSentence, currentExercise.targetWord)
      : [{ text: brightSentence, highlight: false }];

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

        <Animated.ScrollView
          style={[styles.promptScroll, contentOpacity]}
          contentContainerStyle={styles.promptContainer}
          showsVerticalScrollIndicator={false}
        >
          {isReframe ? (
            <>
              <View>
                <View style={styles.sectionLabelRow}>
                  <Ionicons
                    name={patternIcon(currentExercise.patternType)}
                    size={12}
                    color={alpha(colors.tertiary, 0.75)}
                  />
                  <Text style={styles.sectionLabel}>REFRAME</Text>
                </View>
                <Text style={styles.targetWord}>
                  {REFRAME_LABELS[currentExercise.patternType] ?? currentExercise.patternType}
                </Text>
              </View>

              <View>
                <Text style={styles.sectionLabel}>YOUR ORIGINAL</Text>
                <Text style={styles.originalText}>
                  {contextSplit?.before ? (
                    <Text style={styles.contextFaded}>{contextSplit.before}</Text>
                  ) : null}
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
                  {contextSplit?.after ? (
                    <Text style={styles.contextFaded}>{contextSplit.after}</Text>
                  ) : null}
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
                <View style={styles.sectionLabelRow}>
                  <Ionicons
                    name={patternIcon(currentExercise.patternType)}
                    size={12}
                    color={alpha(colors.tertiary, 0.75)}
                  />
                  <Text style={styles.sectionLabel}>TARGET</Text>
                </View>
                <Text style={styles.targetWord}>"{currentExercise.targetWord}"</Text>
              </View>

              <View>
                <Text style={styles.sectionLabel}>YOUR ORIGINAL</Text>
                <Text style={styles.originalText}>
                  {contextSplit?.before ? (
                    <Text style={styles.contextFaded}>{contextSplit.before}</Text>
                  ) : null}
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
                  {contextSplit?.after ? (
                    <Text style={styles.contextFaded}>{contextSplit.after}</Text>
                  ) : null}
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
        </Animated.ScrollView>

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
            <PracticeRecordOrb
              state={orbState}
              audioLevel={recording.audioLevel}
              onPress={recording.state === 'recording' ? handleStopRecording : handleStartRecording}
            />

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

  // Drill-again "Generating exercises..." loading panel
  generatingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: layout.screenPadding,
  },
  generatingPanel: {
    backgroundColor: alpha(colors.white, 0.05),
    borderColor: alpha(colors.white, 0.1),
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 32,
    paddingHorizontal: 28,
    alignItems: 'center',
    gap: spacing.md,
    minWidth: 260,
  },
  generatingTitle: {
    fontSize: 20,
    fontFamily: fonts.extrabold,
    letterSpacing: -0.5,
    color: colors.onSurface,
    textAlign: 'center',
  },
  generatingSpinner: {
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
  },
  generatingHint: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: alpha(colors.white, 0.5),
    textAlign: 'center',
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
  sectionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
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
  contextFaded: {
    color: alpha(colors.white, 0.22),
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
  errorText: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: colors.severityError,
    textAlign: 'center',
  },

});
