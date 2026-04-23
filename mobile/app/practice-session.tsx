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
import { SuccessScreen } from '../components/success';
import PracticeRecordOrb from '../components/orbs/PracticeRecordOrb';
import PracticeFeedbackPanel from '../components/PracticeFeedbackPanel';
import SuccessCelebration from '../components/SuccessCelebration';
import DrillPrompt from '../components/practice/DrillPrompt';
import { usePracticeTasks } from '../hooks/data/usePracticeTasks';
import { usePracticeRecording } from '../hooks/recording/usePracticeRecording';
import { colors, alpha, spacing, layout, fonts } from '../theme';
import { usePreloadSuccessSound, playSuccessSound } from '../lib/sounds';

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
  if (completionState === 'session_complete') {
    return (
      <SuccessScreen
        eyebrow="Session"
        title="Session Complete"
        subtitle="All corrections in this session have been practiced."
        tone="victorious"
        actions={[
          {
            label: 'Practice Next Session',
            icon: 'arrow-forward',
            variant: 'primary',
            onPress: () => router.replace('/(tabs)/practice'),
          },
          {
            label: 'Done',
            icon: 'checkmark',
            variant: 'secondary',
            onPress: () => router.back(),
          },
        ]}
      />
    );
  }
  if (completionState === 'all_complete') {
    return (
      <SuccessScreen
        eyebrow="Inbox zero"
        title="All Caught Up"
        subtitle="Every correction has been practiced."
        tone="polish"
        actions={[
          {
            label: 'New Session',
            icon: 'mic',
            variant: 'success',
            onPress: () => router.replace('/(tabs)'),
          },
        ]}
      />
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader variant="back" />
      <SuccessCelebration visible={!!passed} />

      <View style={styles.body}>
        {/* Prompt content */}
        <Animated.ScrollView
          style={[styles.promptScroll, contentOpacity]}
          contentContainerStyle={styles.promptContainer}
          showsVerticalScrollIndicator={false}
        >
          <DrillPrompt
            key={`err-${currentCorrectionId}`}
            originalText={task.originalText}
            correctedText={task.correctedText}
            context={task.contextSnippet}
            severity={task.severity}
            shortReason={task.shortReason}
            explanation={task.explanation}
          />
        </Animated.ScrollView>

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
