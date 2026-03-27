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
  useAnimatedStyle,
  withTiming,
  FadeIn,
  FadeInDown,
} from 'react-native-reanimated';
import { ScreenHeader } from '../components/ui';
import PracticeRecordOrb from '../components/PracticeRecordOrb';
import { usePracticeTasks } from '../hooks/usePracticeTasks';
import { usePracticeRecording } from '../hooks/usePracticeRecording';
import { authFetch } from '../lib/api';
import { colors, alpha, spacing, layout } from '../theme';
import type { PracticeMode, PracticeTask } from '../types/practice';

const SEVERITY_COLOR: Record<string, string> = {
  error: colors.severityError,
  improvement: colors.severityImprovement,
  polish: colors.severityPolish,
};

export default function PracticeSessionScreen() {
  const { correctionId, mode: modeParam, fromList } = useLocalSearchParams<{
    correctionId: string;
    mode?: string;
    fromList?: string;
  }>();
  const insets = useSafeAreaInsets();
  const isFromList = fromList === 'true';

  const [mode, setMode] = useState<PracticeMode>(
    (modeParam as PracticeMode) || 'say_it_right',
  );
  const [currentCorrectionId, setCurrentCorrectionId] = useState(Number(correctionId));
  const [scenario, setScenario] = useState<string | null>(null);
  const [scenarioLoading, setScenarioLoading] = useState(false);
  const scenarioCacheRef = useRef<Record<number, string>>({});

  const { data: tasks, refetch: refetchTasks } = usePracticeTasks();
  const recording = usePracticeRecording();

  // Find the current task from the cached task list
  const task = useMemo(() => {
    return tasks?.find((t) => t.correctionId === currentCorrectionId) ?? null;
  }, [tasks, currentCorrectionId]);

  // Fetch scenario when switching to "use_it_naturally" mode
  useEffect(() => {
    if (mode !== 'use_it_naturally' || !currentCorrectionId) return;
    const cached = scenarioCacheRef.current[currentCorrectionId];
    if (cached) {
      setScenario(cached);
      return;
    }

    setScenarioLoading(true);
    authFetch(`/practice/scenario?correctionId=${currentCorrectionId}`)
      .then((res) => res.json())
      .then((data) => {
        const s = data.scenario || 'Describe something that happened to you recently.';
        scenarioCacheRef.current[currentCorrectionId] = s;
        setScenario(s);
      })
      .catch(() => {
        setScenario('Describe something that happened to you recently.');
      })
      .finally(() => setScenarioLoading(false));
  }, [mode, currentCorrectionId]);

  // Find next unpracticed task
  const nextTask = useMemo(() => {
    if (!tasks || !isFromList) return null;
    const unpracticed = tasks.filter((t) => !t.practiced && t.correctionId !== currentCorrectionId);
    return unpracticed.length > 0 ? unpracticed[0] : null;
  }, [tasks, currentCorrectionId, isFromList]);

  // Handlers
  const handleStartRecording = useCallback(async () => {
    console.log('[PracticeSession] Record button pressed — state:', recording.state);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await recording.start();
    console.log('[PracticeSession] recording.start() resolved — state:', recording.state);
  }, [recording]);

  const handleStopRecording = useCallback(async () => {
    console.log('[PracticeSession] Stop button pressed — state:', recording.state, 'elapsed:', recording.elapsedSeconds);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await recording.stop(currentCorrectionId, mode, scenario ?? undefined);
    console.log('[PracticeSession] recording.stop() resolved');
  }, [recording, currentCorrectionId, mode, scenario]);

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

  const handleNext = useCallback(() => {
    if (nextTask) {
      recording.reset();
      setCurrentCorrectionId(nextTask.correctionId);
      setScenario(null);
    } else {
      handleDone();
    }
  }, [nextTask, recording, handleDone]);

  const handleSkip = useCallback(() => {
    if (nextTask) {
      recording.reset();
      setCurrentCorrectionId(nextTask.correctionId);
      setScenario(null);
    } else {
      handleDone();
    }
  }, [nextTask, recording, handleDone]);

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
        {/* Phase 3: Result */}
        {recording.state === 'result' && recording.result ? (
          <Animated.View style={styles.resultContainer} entering={FadeIn.duration(250)}>
            {recording.result.passed ? (
              <>
                <Animated.View entering={FadeInDown.duration(300).delay(100)}>
                  <Ionicons name="checkmark-circle" size={56} color={colors.severityPolish} />
                </Animated.View>
                <Text style={styles.resultTitle}>Nailed it</Text>
                <Text style={styles.resultFeedback}>{recording.result.feedback}</Text>
                <View style={styles.resultActions}>
                  {isFromList && nextTask ? (
                    <Pressable style={styles.primaryButton} onPress={handleNext}>
                      <Text style={styles.primaryButtonText}>Next</Text>
                    </Pressable>
                  ) : (
                    <Pressable style={styles.primaryButton} onPress={handleDone}>
                      <Text style={styles.primaryButtonText}>Done</Text>
                    </Pressable>
                  )}
                  <Pressable style={styles.ghostButton} onPress={handleTryAgain}>
                    <Text style={styles.ghostButtonText}>Try Again</Text>
                  </Pressable>
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
                  <Pressable style={styles.primaryButton} onPress={handleTryAgain}>
                    <Text style={styles.primaryButtonText}>Try Again</Text>
                  </Pressable>
                  {isFromList && (
                    <Pressable style={styles.ghostButton} onPress={handleSkip}>
                      <Text style={styles.ghostButtonText}>Skip</Text>
                    </Pressable>
                  )}
                </View>
              </>
            )}
          </Animated.View>
        ) : (
          <>
            {/* Prompt content — flat on background */}
            <Animated.View style={[styles.promptContainer, contentOpacity]}>
              {mode === 'say_it_right' ? (
                <>
                  {/* Original text with stylized strikethrough */}
                  <View style={styles.originalWrap}>
                    <Text style={styles.sectionLabel}>YOU SAID</Text>
                    <View style={styles.strikethroughWrap}>
                      <Text style={styles.originalText}>{task.originalText}</Text>
                      <View style={[styles.strikethroughBar, { backgroundColor: alpha(severityColor, 0.4) }]} />
                    </View>
                  </View>

                  {/* Target text — hero element with accent bar */}
                  <View style={styles.targetWrap}>
                    <Text style={styles.sectionLabel}>SAY THIS</Text>
                    <View style={styles.targetRow}>
                      <View style={[styles.accentBar, { backgroundColor: severityColor }]} />
                      <Text style={styles.targetText}>{task.correctedText}</Text>
                    </View>
                  </View>

                  {/* Explanation — subtle footnote */}
                  {task.explanation && (
                    <Text style={styles.explanationText}>{task.explanation}</Text>
                  )}
                </>
              ) : (
                <>
                  {/* Compact inline correction */}
                  <View style={styles.correctionContext}>
                    <Text style={styles.sectionLabel}>CORRECTION</Text>
                    <View style={styles.inlineCorrection}>
                      <Text style={styles.inlineOriginal}>{task.originalText}</Text>
                      <Ionicons name="arrow-forward" size={12} color={alpha(colors.white, 0.15)} />
                      <Text style={styles.inlineCorrected}>{task.correctedText}</Text>
                    </View>
                    {task.explanation && (
                      <Text style={styles.ruleText}>{task.explanation}</Text>
                    )}
                  </View>

                  {/* Scenario — the star */}
                  <View style={styles.scenarioWrap}>
                    <Text style={styles.sectionLabel}>RESPOND TO THIS</Text>
                    {scenarioLoading ? (
                      <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: 12 }} />
                    ) : (
                      <View style={styles.targetRow}>
                        <View style={[styles.accentBar, { backgroundColor: severityColor }]} />
                        <Text style={styles.scenarioText}>{scenario ?? '...'}</Text>
                      </View>
                    )}
                    <Text style={styles.scenarioHint}>
                      Answer in your own words — use the corrected form naturally
                    </Text>
                  </View>
                </>
              )}
            </Animated.View>

            {/* Recording area */}
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
    fontWeight: '600',
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
  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
    color: alpha(colors.white, 0.2),
    marginBottom: 10,
  },

  // Say It Right — original
  originalWrap: {},
  strikethroughWrap: {
    position: 'relative',
  },
  originalText: {
    fontSize: 17,
    fontWeight: '400',
    color: alpha(colors.white, 0.35),
    lineHeight: 26,
  },
  strikethroughBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '50%',
    height: 2,
    borderRadius: 1,
  },

  // Say It Right — target (hero)
  targetWrap: {},
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
    fontWeight: '700',
    color: alpha(colors.white, 0.95),
    lineHeight: 32,
  },
  explanationText: {
    fontSize: 13,
    color: alpha(colors.white, 0.2),
    lineHeight: 19,
    paddingHorizontal: 2,
  },

  // Use It Naturally — correction context
  correctionContext: {},
  inlineCorrection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  inlineOriginal: {
    fontSize: 14,
    fontWeight: '400',
    color: alpha(colors.white, 0.3),
    textDecorationLine: 'line-through',
  },
  inlineCorrected: {
    fontSize: 14,
    fontWeight: '600',
    color: alpha(colors.white, 0.55),
  },
  ruleText: {
    fontSize: 13,
    color: alpha(colors.white, 0.2),
    lineHeight: 19,
  },

  // Use It Naturally — scenario (hero)
  scenarioWrap: {},
  scenarioText: {
    flex: 1,
    fontSize: 18,
    fontWeight: '500',
    color: alpha(colors.white, 0.88),
    lineHeight: 28,
  },
  scenarioHint: {
    fontSize: 12,
    fontWeight: '500',
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
    fontWeight: '500',
    color: alpha(colors.white, 0.5),
  },
  errorText: {
    fontSize: 13,
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
    fontWeight: '800',
    color: colors.onSurface,
    letterSpacing: -0.5,
    marginTop: spacing.sm,
  },
  resultFeedback: {
    fontSize: 15,
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
    fontWeight: '600',
    color: alpha(colors.white, 0.3),
    marginBottom: 4,
  },
  transcriptText: {
    fontSize: 14,
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
  primaryButton: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 32,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.black,
  },
  ghostButton: {
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 32,
    alignSelf: 'stretch',
    alignItems: 'center',
    backgroundColor: alpha(colors.white, 0.05),
    borderWidth: 1,
    borderColor: alpha(colors.white, 0.08),
  },
  ghostButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: alpha(colors.white, 0.5),
  },
});
