import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
  Easing,
  FadeIn,
  FadeInDown,
} from 'react-native-reanimated';
import { ScreenHeader, GlassIconPillButton } from '../components/ui';
import PracticeRecordOrb from '../components/PracticeRecordOrb';
import { wordDiff, formatCorrectionTypeLabel } from '../lib/wordDiff';
import { usePracticeTasks } from '../hooks/usePracticeTasks';
import { usePracticeRecording } from '../hooks/usePracticeRecording';
import { authFetch } from '../lib/api';
import { colors, alpha, spacing, layout, fonts } from '../theme';
import type { PracticeMode, PracticeTask } from '../types/practice';

const SEVERITY_COLOR: Record<string, string> = {
  error: colors.severityError,
  improvement: colors.severityImprovement,
  polish: colors.severityPolish,
};

export default function PracticeSessionScreen() {
  const { correctionId, mode: modeParam, fromList, sessionId } = useLocalSearchParams<{
    correctionId?: string;
    mode?: string;
    fromList?: string;
    sessionId?: string;
  }>();
  const insets = useSafeAreaInsets();
  const isFromList = fromList === 'true';
  const isFromSession = !!sessionId;

  const [mode, setMode] = useState<PracticeMode>(
    (modeParam as PracticeMode) || 'say_it_right',
  );
  const [currentCorrectionId, setCurrentCorrectionId] = useState(Number(correctionId));
  const [scenario, setScenario] = useState<string | null>(null);
  const [answerRevealed, setAnswerRevealed] = useState(false);
  const [sessionQueue, setSessionQueue] = useState<number[]>([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const requeueCountRef = useRef<Record<number, number>>({});
  const [completionState, setCompletionState] = useState<'session_complete' | 'all_complete' | null>(null);

  const { data: tasks, refetch: refetchTasks } = usePracticeTasks();
  const recording = usePracticeRecording();

  // Find the current task from the cached task list
  const task = useMemo(() => {
    return tasks?.find((t) => t.correctionId === currentCorrectionId) ?? null;
  }, [tasks, currentCorrectionId]);

  // Load scenario from pre-generated task data, fallback to API if null
  useEffect(() => {
    if (mode !== 'use_it_naturally' || !currentCorrectionId) return;

    if (task?.scenario) {
      setScenario(task.scenario);
      return;
    }

    // Fallback: fetch on-demand if scenario wasn't pre-generated
    authFetch(`/practice/scenario?correctionId=${currentCorrectionId}`)
      .then((res) => res.json())
      .then((data) => {
        setScenario(data.scenario || 'Describe something that happened to you recently.');
      })
      .catch(() => {
        setScenario('Describe something that happened to you recently.');
      });
  }, [mode, currentCorrectionId, task?.scenario]);

  // Build session queue on mount for fromList or fromSession mode
  useEffect(() => {
    if ((isFromList || isFromSession) && tasks && sessionQueue.length === 0) {
      const unpracticed = isFromSession
        ? tasks.filter((t) => t.sessionId === Number(sessionId) && !t.practiced).map((t) => t.correctionId)
        : tasks.filter((t) => !t.practiced).map((t) => t.correctionId);
      if (unpracticed.length > 0) {
        setSessionQueue(unpracticed);
        setCurrentCorrectionId(unpracticed[0]);
      }
    }
  }, [isFromList, isFromSession, tasks]);

  // Find next unpracticed task (for fallback / use_it_naturally navigation)
  const nextTask = useMemo(() => {
    if (!tasks || (!isFromList && !isFromSession)) return null;
    const unpracticed = tasks.filter((t) => !t.practiced && t.correctionId !== currentCorrectionId);
    return unpracticed.length > 0 ? unpracticed[0] : null;
  }, [tasks, currentCorrectionId, isFromList, isFromSession]);

  // Handlers
  const handleStartRecording = useCallback(async () => {
    const t0 = Date.now();
    console.log(`[PracticeSession] >>>>>> RECORD BUTTON PRESSED (START) <<<<<<`);
    console.log(`[PracticeSession] handleStartRecording — mode: "${mode}", correctionId: ${currentCorrectionId}, recording.state: "${recording.state}"`);
    console.log(`[PracticeSession] handleStartRecording — task original: "${task?.originalText}", corrected: "${task?.correctedText}"`);
    if (mode === 'use_it_naturally') {
      console.log(`[PracticeSession] handleStartRecording — scenario: "${scenario}"`);
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    console.log(`[PracticeSession] handleStartRecording — t=${Date.now() - t0}ms — calling recording.start()...`);
    await recording.start();
    console.log(`[PracticeSession] handleStartRecording — t=${Date.now() - t0}ms — recording.start() resolved, recording.state: "${recording.state}"`);
  }, [recording, mode, currentCorrectionId, task, scenario]);

  const handleStopRecording = useCallback(async () => {
    const t0 = Date.now();
    console.log(`[PracticeSession] >>>>>> STOP BUTTON PRESSED <<<<<<`);
    console.log(`[PracticeSession] handleStopRecording — mode: "${mode}", correctionId: ${currentCorrectionId}, recording.state: "${recording.state}", elapsed: ${recording.elapsedSeconds}s`);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    console.log(`[PracticeSession] handleStopRecording — t=${Date.now() - t0}ms — calling recording.stop()...`);
    await recording.stop(currentCorrectionId, mode, scenario ?? undefined);
    console.log(`[PracticeSession] handleStopRecording — t=${Date.now() - t0}ms — recording.stop() resolved`);
  }, [recording, currentCorrectionId, mode, scenario]);

  // Auto-stop at max duration
  useEffect(() => {
    if (recording.state === 'recording' && recording.elapsedSeconds >= 15) {
      console.log(`[PracticeSession] AUTO-STOP triggered — elapsed: ${recording.elapsedSeconds}s`);
      handleStopRecording();
    }
  }, [recording.state, recording.elapsedSeconds, handleStopRecording]);

  const handleTryAgain = useCallback(() => {
    recording.reset();
    setAnswerRevealed(false);
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
      // Check if other sessions have unpracticed corrections
      const otherUnpracticed = fresh.filter(
        (t) => t.sessionId !== Number(sessionId) && !t.practiced,
      );
      setCompletionState(otherUnpracticed.length > 0 ? 'session_complete' : 'all_complete');
    } else if (isFromList) {
      const remaining = fresh.filter((t) => !t.practiced);
      if (remaining.length > 0) {
        setCompletionState('session_complete');
      } else {
        setCompletionState('all_complete');
      }
    } else {
      handleDone();
    }
  }, [refetchTasks, isFromSession, isFromList, sessionId, handleDone]);

  const handleNext = useCallback(() => {
    // Queue-based navigation for say_it_right from list or session
    if (mode === 'say_it_right' && sessionQueue.length > 0) {
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
        setAnswerRevealed(false);
        setScenario(null);
      } else {
        handleQueueExhausted();
      }
      return;
    }

    // Fallback for use_it_naturally or non-queue
    if (nextTask) {
      recording.reset();
      setCurrentCorrectionId(nextTask.correctionId);
      setScenario(null);
    } else {
      handleDone();
    }
  }, [mode, sessionQueue, queueIndex, recording, nextTask, handleDone, handleQueueExhausted]);

  const handleSkip = useCallback(() => {
    // Queue-based skip for say_it_right — always re-queue
    if (mode === 'say_it_right' && sessionQueue.length > 0) {
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
        setAnswerRevealed(false);
        setScenario(null);
      } else {
        handleQueueExhausted();
      }
      return;
    }

    // Fallback
    if (nextTask) {
      recording.reset();
      setCurrentCorrectionId(nextTask.correctionId);
      setScenario(null);
    } else {
      handleDone();
    }
  }, [mode, sessionQueue, queueIndex, recording, nextTask, handleDone, handleQueueExhausted]);

  // Haptics on result
  useEffect(() => {
    if (recording.state === 'result' && recording.result) {
      if (recording.result.passed) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }
    }
  }, [recording.state, recording.result]);

  const severityColor = task ? (SEVERITY_COLOR[task.severity] ?? colors.severityError) : colors.severityError;

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

  // Reset explanation state when switching corrections
  useEffect(() => {
    setExplanationExpanded(false);
    explanationAnim.value = 0;
  }, [currentCorrectionId]);

  // Dim content during recording
  const contentOpacity = useAnimatedStyle(() => ({
    opacity: withTiming(recording.state === 'recording' ? 0.6 : 1, { duration: 200 }),
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
      {/* Header with mode toggle */}
      <ScreenHeader
        variant="back"
        rightAction={
          <View style={styles.modeToggle}>
            <Pressable
              style={[styles.modePill, mode === 'say_it_right' && styles.modePillActive]}
              onPress={() => setMode('say_it_right')}
            >
              <Text style={[styles.modePillText, mode === 'say_it_right' && styles.modePillTextActive]}>
                Say It Right
              </Text>
            </Pressable>
            <Pressable
              style={[styles.modePill, mode === 'use_it_naturally' && styles.modePillActive]}
              onPress={() => setMode('use_it_naturally')}
            >
              <Text style={[styles.modePillText, mode === 'use_it_naturally' && styles.modePillTextActive]}>
                Use It Naturally
              </Text>
            </Pressable>
          </View>
        }
      />

      <View style={styles.body}>
        {/* Use It Naturally: full-screen result takeover (unchanged) */}
        {mode === 'use_it_naturally' && recording.state === 'result' && recording.result ? (
          <Animated.View style={styles.resultContainer} entering={FadeIn.duration(250)}>
            {recording.result.passed ? (
              <>
                <Animated.View entering={FadeInDown.duration(300).delay(100)}>
                  <Ionicons name="checkmark-circle" size={56} color={colors.severityPolish} />
                </Animated.View>
                <Text style={styles.resultTitle}>Nailed it</Text>
                <Text style={styles.resultFeedback}>{recording.result.feedback}</Text>
                <View style={styles.resultActions}>
                  {(isFromSession || isFromList) && nextTask ? (
                    <GlassIconPillButton label="Next" icon="arrow-forward" variant="primary" onPress={handleNext} fullWidth />
                  ) : (
                    <GlassIconPillButton label="Done" icon="checkmark" variant="primary" onPress={handleDone} fullWidth />
                  )}
                  <GlassIconPillButton label="Try Again" icon="refresh" variant="secondary" onPress={handleTryAgain} fullWidth />
                </View>
              </>
            ) : (
              <>
                <Animated.View entering={FadeInDown.duration(300).delay(100)}>
                  <Ionicons name="refresh-circle" size={56} color="#f59e0b" />
                </Animated.View>
                <Text style={styles.resultTitle}>Not quite</Text>
                <Text style={styles.resultFeedback}>{recording.result.feedback}</Text>
                {recording.result.transcript ? (
                  <View style={styles.transcriptBox}>
                    <Text style={styles.transcriptLabel}>What you said:</Text>
                    <Text style={styles.transcriptText}>{recording.result.transcript}</Text>
                  </View>
                ) : null}
                <View style={styles.resultActions}>
                  <GlassIconPillButton label="Try Again" icon="refresh" variant="primary" onPress={handleTryAgain} fullWidth />
                  {(isFromList || isFromSession) && (
                    <GlassIconPillButton label="Skip" icon="arrow-forward" variant="secondary" onPress={handleSkip} fullWidth />
                  )}
                </View>
              </>
            )}
          </Animated.View>
        ) : (
          <>
            {/* Prompt content — flat on background */}
            <Animated.View style={[
              styles.promptContainer,
              contentOpacity,
              mode === 'say_it_right' && recording.state === 'result' && styles.promptContainerResult,
            ]}>
              {mode === 'say_it_right' ? (
                <>
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

                  {/* Collapsable explanation + correction type */}
                  <View style={styles.hintArea}>
                    <View style={styles.hintRow}>
                      <View style={styles.correctionTypePill}>
                        <Text style={[styles.correctionTypePillText, { color: severityColor }]}>
                          {formatCorrectionTypeLabel(task.correctionType)}
                        </Text>
                      </View>
                      {task.explanation ? (
                        <Pressable onPress={toggleExplanation} hitSlop={8} style={styles.explainToggle}>
                          <Text style={styles.explainToggleText}>Why?</Text>
                          <Animated.View style={explanationChevronStyle}>
                            <Ionicons name="chevron-down" size={12} color={alpha(colors.white, 0.3)} />
                          </Animated.View>
                        </Pressable>
                      ) : null}
                    </View>
                    {task.explanation ? (
                      <Animated.View style={explanationBodyStyle}>
                        <Text style={styles.hintText}>{task.explanation}</Text>
                      </Animated.View>
                    ) : null}
                  </View>

                  {/* Instruction */}
                  <Text style={styles.instructionText}>Now say the corrected version</Text>

                  {/* Answer reveal section */}
                  {answerRevealed && (
                    <Animated.View entering={FadeInDown.duration(250)} style={styles.revealWrap}>
                      <Text style={styles.sectionLabel}>CORRECT VERSION</Text>
                      <View style={styles.targetRow}>
                        <View style={[styles.accentBar, { backgroundColor: severityColor }]} />
                        <Text style={styles.targetText}>{task.correctedText}</Text>
                      </View>
                      {task.explanation && (
                        <Text style={[styles.explanationText, { marginTop: 12 }]}>{task.explanation}</Text>
                      )}
                    </Animated.View>
                  )}

                  {/* Inline result for say_it_right */}
                  {recording.state === 'result' && recording.result && (
                    <Animated.View entering={FadeInDown.duration(250)} style={styles.inlineResultWrap}>
                      <View style={styles.resultRow}>
                        <Ionicons
                          name={recording.result.passed ? 'checkmark-circle' : 'close-circle'}
                          size={22}
                          color={recording.result.passed ? colors.severityPolish : '#f59e0b'}
                          style={styles.resultIcon}
                        />
                        <Text style={[
                          styles.resultLabel,
                          { color: recording.result.passed ? colors.severityPolish : '#f59e0b' },
                        ]}>
                          {recording.result.passed ? 'Correct' : 'Not quite'}
                        </Text>
                      </View>
                      <Text style={styles.resultFeedbackInline}>{recording.result.feedback}</Text>
                      {!recording.result.passed && recording.result.transcript ? (
                        <View style={styles.transcriptBox}>
                          <Text style={styles.transcriptLabel}>What you said:</Text>
                          <Text style={styles.transcriptText}>{recording.result.transcript}</Text>
                        </View>
                      ) : null}
                      <View style={styles.actionButtons}>
                        {!answerRevealed && !recording.result.passed && (
                          <GlassIconPillButton
                            label="See Answer"
                            icon="eye-outline"
                            variant="secondary"
                            onPress={() => setAnswerRevealed(true)}
                          />
                        )}
                        <GlassIconPillButton
                          label="Try Again"
                          icon="refresh"
                          variant="primary"
                          onPress={handleTryAgain}
                        />
                        {(isFromSession || (isFromList && nextTask)) && (
                          <GlassIconPillButton
                            label="Next"
                            icon="arrow-forward"
                            variant="secondary"
                            onPress={handleNext}
                          />
                        )}
                        {!isFromSession && !isFromList && (
                          <GlassIconPillButton
                            label="Done"
                            icon="checkmark"
                            variant="secondary"
                            onPress={handleDone}
                          />
                        )}
                      </View>
                    </Animated.View>
                  )}
                </>
              ) : (
                <>
                  {/* Full sentence with error underlined + collapsable explanation */}
                  <View style={styles.correctionContext}>
                    <Text style={styles.sectionLabel}>CORRECTION</Text>
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
                        // Fallback: inline original → corrected
                        return (
                          <>
                            <Text style={styles.inlineOriginal}>{task.originalText}</Text>
                            <Text style={{ color: alpha(colors.white, 0.15) }}> {'→'} </Text>
                            <Text style={styles.inlineCorrected}>{task.correctedText}</Text>
                          </>
                        );
                      })()}
                    </Text>

                    <View style={styles.hintRow}>
                      <View style={styles.correctionTypePill}>
                        <Text style={[styles.correctionTypePillText, { color: severityColor }]}>
                          {formatCorrectionTypeLabel(task.correctionType)}
                        </Text>
                      </View>
                      {task.explanation ? (
                        <Pressable onPress={toggleExplanation} hitSlop={8} style={styles.explainToggle}>
                          <Text style={styles.explainToggleText}>Why?</Text>
                          <Animated.View style={explanationChevronStyle}>
                            <Ionicons name="chevron-down" size={12} color={alpha(colors.white, 0.3)} />
                          </Animated.View>
                        </Pressable>
                      ) : null}
                    </View>
                    {task.explanation ? (
                      <Animated.View style={explanationBodyStyle}>
                        <Text style={styles.ruleText}>{task.explanation}</Text>
                      </Animated.View>
                    ) : null}
                  </View>

                  {/* Scenario — the star */}
                  <View style={styles.scenarioWrap}>
                    <Text style={styles.sectionLabel}>RESPOND TO THIS</Text>
                    <View style={styles.targetRow}>
                      <View style={[styles.accentBar, { backgroundColor: severityColor }]} />
                      <Text style={styles.scenarioText}>{scenario ?? '...'}</Text>
                    </View>
                    <Text style={styles.scenarioHint}>
                      Answer in your own words — use the corrected form naturally
                    </Text>
                  </View>
                </>
              )}
            </Animated.View>

            {/* Recording area — hidden when say_it_right has a result showing */}
            {!(mode === 'say_it_right' && recording.state === 'result') && (
              <View style={[styles.recordArea, { paddingBottom: insets.bottom + 16 }]}>
                {recording.state === 'evaluating' ? (
                  <View style={styles.evaluatingWrap}>
                    <ActivityIndicator size="small" color={colors.primary} />
                    <Text style={styles.evaluatingText}>Evaluating...</Text>
                  </View>
                ) : (
                  <PracticeRecordOrb
                    state={recording.state === 'idle' ? 'idle' : 'recording'}
                    audioLevel={recording.audioLevel}
                    onPress={recording.state === 'recording' ? handleStopRecording : handleStartRecording}
                  />
                )}

                {recording.error && (
                  <Text style={styles.errorText}>{recording.error}</Text>
                )}
              </View>
            )}
          </>
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

  // Mode toggle
  modeToggle: {
    flexDirection: 'row',
    gap: 4,
  },
  modePill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 100,
    backgroundColor: alpha(colors.white, 0.04),
  },
  modePillActive: {
    backgroundColor: alpha(colors.primary, 0.15),
  },
  modePillText: {
    fontSize: 11,
    fontFamily: fonts.semibold,
    color: alpha(colors.white, 0.3),
  },
  modePillTextActive: {
    color: colors.primary,
  },

  // Prompt content
  promptContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: layout.screenPadding + 4,
    gap: 32,
  },
  promptContainerResult: {
    justifyContent: 'flex-start',
    paddingTop: spacing.lg,
  },
  sectionLabel: {
    fontSize: 10,
    fontFamily: fonts.bold,
    letterSpacing: 1.5,
    color: alpha(colors.white, 0.2),
    marginBottom: 10,
  },

  // Say It Right — original sentence with underlined errors
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
  // Hint area
  hintArea: {
    gap: 10,
  },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
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
  instructionText: {
    fontSize: 13,
    fontFamily: fonts.semibold,
    color: alpha(colors.white, 0.2),
    textAlign: 'center' as const,
  },
  revealWrap: {
    gap: 0,
  },

  // Say It Right — target (hero, also used in answer reveal)
  targetRow: {
    flexDirection: 'row',
  },
  accentBar: {
    width: 3,
    borderRadius: 1.5,
    marginRight: 14,
    flexShrink: 0,
  },
  targetText: {
    flex: 1,
    fontSize: 22,
    fontFamily: fonts.bold,
    color: alpha(colors.white, 0.95),
    lineHeight: 32,
  },
  explanationText: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: alpha(colors.white, 0.2),
    lineHeight: 19,
    paddingHorizontal: 2,
  },

  // Use It Naturally — correction context
  correctionContext: {
    gap: 10,
  },
  inlineOriginal: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: alpha(colors.white, 0.3),
    textDecorationLine: 'line-through',
  },
  inlineCorrected: {
    fontSize: 14,
    fontFamily: fonts.semibold,
    color: alpha(colors.white, 0.55),
  },
  ruleText: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: alpha(colors.white, 0.2),
    lineHeight: 19,
  },

  // Use It Naturally — scenario (hero)
  scenarioWrap: {},
  scenarioText: {
    flex: 1,
    fontSize: 18,
    fontFamily: fonts.medium,
    color: alpha(colors.white, 0.88),
    lineHeight: 28,
  },
  scenarioHint: {
    fontSize: 12,
    fontFamily: fonts.medium,
    color: alpha(colors.white, 0.15),
    marginTop: 12,
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

  // Result
  resultContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: layout.screenPadding,
    gap: spacing.md,
  },
  resultTitle: {
    fontSize: 24,
    fontFamily: fonts.extrabold,
    color: colors.onSurface,
    letterSpacing: -0.5,
    marginTop: spacing.sm,
  },
  resultFeedback: {
    fontSize: 15,
    fontFamily: fonts.regular,
    color: alpha(colors.white, 0.5),
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 300,
  },
  transcriptBox: {
    marginTop: spacing.sm,
    padding: spacing.md,
    borderRadius: 12,
    backgroundColor: alpha(colors.white, 0.04),
    borderWidth: 1,
    borderColor: alpha(colors.white, 0.06),
    width: '100%',
    maxWidth: 300,
  },
  transcriptLabel: {
    fontSize: 11,
    fontFamily: fonts.semibold,
    color: alpha(colors.white, 0.3),
    marginBottom: 4,
  },
  transcriptText: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: alpha(colors.white, 0.45),
    lineHeight: 20,
  },
  resultActions: {
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xl,
    width: '100%',
    maxWidth: 300,
  },

  // Inline result for Say It Right
  inlineResultWrap: {
    gap: 12,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  resultIcon: {},
  resultLabel: {
    fontSize: 15,
    fontFamily: fonts.bold,
  },
  resultFeedbackInline: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: alpha(colors.white, 0.45),
    lineHeight: 20,
  },
  actionButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
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
