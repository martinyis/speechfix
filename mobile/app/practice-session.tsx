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
  useAnimatedStyle,
  withTiming,
  FadeIn,
  FadeInDown,
} from 'react-native-reanimated';
import { ScreenHeader, GlassIconPillButton } from '../components/ui';
import PracticeRecordOrb from '../components/PracticeRecordOrb';
import PracticeFeedbackPanel from '../components/PracticeFeedbackPanel';
import SuccessCelebration from '../components/SuccessCelebration';
import ErrorReasonHeader from '../components/practice/ErrorReasonHeader';
import { wordDiff } from '../lib/wordDiff';
import { usePracticeTasks } from '../hooks/usePracticeTasks';
import { usePracticeRecording } from '../hooks/usePracticeRecording';
import { colors, alpha, spacing, layout, fonts } from '../theme';
import { usePreloadSuccessSound, playSuccessSound } from '../lib/sounds';

const SEVERITY_COLOR: Record<string, string> = {
  error: colors.severityError,
  improvement: colors.severityImprovement,
  polish: colors.severityPolish,
};

export default function PracticeSessionScreen() {
  const { correctionId, fromList, sessionId } = useLocalSearchParams<{
    correctionId?: string;
    fromList?: string;
    sessionId?: string;
  }>();
  const insets = useSafeAreaInsets();
  const isFromList = fromList === 'true';
  const isFromSession = !!sessionId;

  const [currentCorrectionId, setCurrentCorrectionId] = useState(Number(correctionId));
  const [sessionQueue, setSessionQueue] = useState<number[]>([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const requeueCountRef = useRef<Record<number, number>>({});
  const [completionState, setCompletionState] = useState<'session_complete' | 'all_complete' | null>(null);

  const { data: tasks, refetch: refetchTasks } = usePracticeTasks();
  const recording = usePracticeRecording();

  // Preload success sound
  usePreloadSuccessSound();

  // Find the current task from the cached task list
  const task = useMemo(() => {
    return tasks?.find((t) => t.correctionId === currentCorrectionId) ?? null;
  }, [tasks, currentCorrectionId]);

  // Build session queue on mount for fromList or fromSession mode
  useEffect(() => {
    if ((isFromList || isFromSession) && tasks && sessionQueue.length === 0) {
      const unpracticed = isFromSession
        ? tasks.filter((t) => t.sessionId === Number(sessionId) && !t.practiced).map((t) => t.correctionId)
        : tasks.filter((t) => !t.practiced).map((t) => t.correctionId);
      if (unpracticed.length > 0) {
        setSessionQueue(unpracticed);
        const tappedIdx = unpracticed.indexOf(Number(correctionId));
        if (tappedIdx >= 0) {
          setQueueIndex(tappedIdx);
        }
      }
    }
  }, [isFromList, isFromSession, tasks]);

  // Handlers
  const handleStartRecording = useCallback(async () => {
    if (recording.state === 'result' && recording.result?.passed) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await recording.start();
  }, [recording]);

  const handleStopRecording = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await recording.stop(currentCorrectionId, 'say_it_right');
  }, [recording, currentCorrectionId]);

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
    refetchTasks();
    router.back();
  }, [refetchTasks]);

  const handleQueueExhausted = useCallback(async () => {
    const freshTasks = await refetchTasks();
    const fresh = freshTasks.data;
    if (!fresh) {
      handleDone();
      return;
    }

    if (isFromSession) {
      const otherUnpracticed = fresh.filter(
        (t) => t.sessionId !== Number(sessionId) && !t.practiced,
      );
      setCompletionState(otherUnpracticed.length > 0 ? 'session_complete' : 'all_complete');
    } else if (isFromList) {
      const remaining = fresh.filter((t) => !t.practiced);
      setCompletionState(remaining.length > 0 ? 'session_complete' : 'all_complete');
    } else {
      handleDone();
    }
  }, [refetchTasks, isFromSession, isFromList, sessionId, handleDone]);

  const handleNext = useCallback(() => {
    if (sessionQueue.length > 0) {
      const currentId = sessionQueue[queueIndex];
      const passed = recording.result?.passed;

      let newQueue = [...sessionQueue];
      if (!passed && currentId) {
        const count = requeueCountRef.current[currentId] || 0;
        if (count < 3) {
          requeueCountRef.current[currentId] = count + 1;
          newQueue = [...newQueue, currentId];
        }
      }

      const nextIdx = queueIndex + 1;
      if (nextIdx < newQueue.length) {
        setSessionQueue(newQueue);
        setQueueIndex(nextIdx);
        setCurrentCorrectionId(newQueue[nextIdx]);
        recording.reset();
      } else {
        handleQueueExhausted();
      }
      return;
    }

    handleDone();
  }, [sessionQueue, queueIndex, recording, handleDone, handleQueueExhausted]);

  const handleSkip = useCallback(() => {
    if (sessionQueue.length > 0) {
      const currentId = sessionQueue[queueIndex];

      let newQueue = [...sessionQueue];
      if (currentId) {
        const count = requeueCountRef.current[currentId] || 0;
        if (count < 3) {
          requeueCountRef.current[currentId] = count + 1;
          newQueue = [...newQueue, currentId];
        }
      }

      const nextIdx = queueIndex + 1;
      if (nextIdx < newQueue.length) {
        setSessionQueue(newQueue);
        setQueueIndex(nextIdx);
        setCurrentCorrectionId(newQueue[nextIdx]);
        recording.reset();
      } else {
        handleQueueExhausted();
      }
      return;
    }

    handleDone();
  }, [sessionQueue, queueIndex, recording, handleDone, handleQueueExhausted]);

  const severityColor = task ? (SEVERITY_COLOR[task.severity] ?? colors.severityError) : colors.severityError;

  // Compute orb state: success when passed, otherwise map normally
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

  // Fade out instruction text on success
  const instructionFadeStyle = useAnimatedStyle(() => ({
    opacity: withTiming(passed ? 0 : 1, { duration: 300 }),
  }));

  // Dim content during recording or failure result (not success)
  const contentOpacity = useAnimatedStyle(() => ({
    opacity: withTiming(
      recording.state === 'recording' ? 0.6
      : (recording.state === 'result' && !recording.result?.passed) ? 0.35
      : 1,
      { duration: 200 },
    ),
  }));

  if (!task) {
    return (
      <View style={styles.container}>
        <ScreenHeader variant="back" />
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  // -- Celebration screen --
  if (completionState) {
    return (
      <View style={styles.container}>
        <ScreenHeader variant="back" />
        <Animated.View style={styles.celebrationContainer} entering={FadeIn.duration(300)}>
          {completionState === 'session_complete' ? (
            <>
              <Animated.View entering={FadeInDown.duration(400).delay(100)}>
                <Ionicons name="trophy" size={64} color={colors.primary} />
              </Animated.View>
              <Text style={styles.celebrationTitle}>Session Complete</Text>
              <Text style={styles.celebrationSubtitle}>
                All corrections in this session have been practiced.
              </Text>
              <View style={styles.celebrationActions}>
                <GlassIconPillButton
                  label="Practice Next Session"
                  icon="arrow-forward"
                  variant="primary"
                  fullWidth
                  onPress={() => {
                    router.replace('/(tabs)/practice');
                  }}
                />
                <GlassIconPillButton
                  label="Done"
                  icon="checkmark"
                  variant="secondary"
                  fullWidth
                  onPress={() => {
                    router.back();
                  }}
                />
              </View>
            </>
          ) : (
            <>
              <Animated.View entering={FadeInDown.duration(400).delay(100)}>
                <Ionicons name="checkmark-circle" size={64} color={colors.severityPolish} />
              </Animated.View>
              <Text style={styles.celebrationTitle}>All Caught Up</Text>
              <Text style={styles.celebrationSubtitle}>
                Every correction has been practiced.
              </Text>
              <View style={styles.celebrationActions}>
                <GlassIconPillButton
                  label="New Session"
                  icon="mic"
                  variant="primary"
                  fullWidth
                  onPress={() => {
                    router.replace('/(tabs)');
                  }}
                />
              </View>
            </>
          )}
        </Animated.View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader variant="back" />
      <SuccessCelebration visible={!!passed} />

      <View style={styles.body}>
        {/* Prompt content */}
        <Animated.View style={[styles.promptContainer, contentOpacity]}>
          {/* Full sentence with error portion underlined */}
          <View style={styles.originalWrap}>
            <Text style={styles.sectionLabel}>YOUR ORIGINAL</Text>
            <Text style={styles.originalFullText}>
              {(() => {
                const ctx = task.contextSnippet;
                if (ctx) {
                  const idx = ctx.toLowerCase().indexOf(task.originalText.toLowerCase());
                  if (idx >= 0) {
                    const before = ctx.slice(0, idx);
                    const match = ctx.slice(idx, idx + task.originalText.length);
                    const after = ctx.slice(idx + task.originalText.length);
                    return (
                      <>
                        {before ? <Text>{before}</Text> : null}
                        <Text style={[styles.errorUnderline, { textDecorationColor: severityColor }]}>
                          {match}
                        </Text>
                        {after ? <Text>{after}</Text> : null}
                      </>
                    );
                  }
                }
                // Fallback: wordDiff on originalText
                return wordDiff(task.originalText, task.correctedText).map((seg, i) => (
                  <Text
                    key={i}
                    style={
                      seg.type === 'equal'
                        ? undefined
                        : [styles.errorUnderline, { textDecorationColor: severityColor }]
                    }
                  >
                    {i > 0 ? ' ' : ''}{seg.text}
                  </Text>
                ));
              })()}
            </Text>
          </View>

          <ErrorReasonHeader
            key={`err-${currentCorrectionId}`}
            correctionType={task.correctionType}
            severity={task.severity}
            explanation={task.explanation}
            shortReason={task.shortReason}
            originalText={task.originalText}
          />

          {/* Instruction */}
          <Animated.Text style={[styles.instructionText, instructionFadeStyle]}>Now say the corrected version</Animated.Text>
        </Animated.View>

        {/* Feedback panel (failure only) or recording/success area */}
        {recording.state === 'result' && recording.result && !recording.result.passed ? (
          <PracticeFeedbackPanel
            passed={false}
            feedback={recording.result.feedback}
            transcript={recording.result.transcript}
            correctAnswer={task.correctedText}
            explanation={task.explanation ?? undefined}
            onTryAgain={handleTryAgain}
            onNext={(isFromSession || isFromList) ? handleNext : undefined}
            onSkip={(isFromSession || isFromList) ? handleSkip : undefined}
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
  body: {
    flex: 1,
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

  // Original sentence with underlined errors
  originalWrap: {},
  originalFullText: {
    fontSize: 20,
    fontFamily: fonts.medium,
    color: alpha(colors.white, 0.85),
    lineHeight: 30,
  },
  errorUnderline: {
    textDecorationLine: 'underline' as const,
    textDecorationStyle: 'solid' as const,
  },
  instructionText: {
    fontSize: 13,
    fontFamily: fonts.semibold,
    color: alpha(colors.white, 0.2),
    textAlign: 'center' as const,
  },
  targetRow: {
    flexDirection: 'row',
  },
  accentBar: {
    width: 3,
    borderRadius: 1.5,
    marginRight: 14,
    flexShrink: 0,
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
