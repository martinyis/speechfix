import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
  Easing,
  FadeInDown,
} from 'react-native-reanimated';
import { GlassIconPillButton } from './ui';
import {
  colors,
  alpha,
  spacing,
  layout,
  fonts,
} from '../theme';

interface PracticeFeedbackPanelProps {
  passed: boolean;
  feedback: string;
  transcript?: string;
  correctAnswer?: string;
  explanation?: string;
  onTryAgain: () => void;
  onNext?: () => void;
  onSkip?: () => void;
  onDone?: () => void;
  autoAdvanceDelay?: number;
  bottomInset?: number;
}

export default function PracticeFeedbackPanel({
  feedback,
  transcript,
  correctAnswer,
  explanation,
  onTryAgain,
  onNext,
  onSkip,
  onDone,
  bottomInset = 0,
}: PracticeFeedbackPanelProps) {
  const [correctVersionExpanded, setCorrectVersionExpanded] = useState(false);

  // Correct version collapsible
  const collapseAnim = useSharedValue(0);

  // Haptic on mount
  useEffect(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const toggleCorrectVersion = useCallback(() => {
    const next = !correctVersionExpanded;
    setCorrectVersionExpanded(next);
    collapseAnim.value = withTiming(next ? 1 : 0, {
      duration: 250,
      easing: Easing.out(Easing.cubic),
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [correctVersionExpanded, collapseAnim]);

  // Animated styles
  const collapseBodyStyle = useAnimatedStyle(() => ({
    height: interpolate(collapseAnim.value, [0, 1], [0, 80]),
    opacity: interpolate(collapseAnim.value, [0, 0.4, 1], [0, 0, 1]),
    overflow: 'hidden' as const,
  }));

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${interpolate(collapseAnim.value, [0, 1], [0, 180])}deg` },
    ],
  }));

  return (
    <Animated.View
      entering={FadeInDown.duration(300)}
      style={[styles.container, { paddingBottom: bottomInset + spacing.lg }]}
    >
      <View style={styles.content}>
          {/* Transcript */}
          {transcript ? (
            <View>
              <Text style={styles.sectionLabel}>WHAT YOU SAID</Text>
              <Text style={styles.transcriptText}>{transcript}</Text>
            </View>
          ) : null}

          {/* AI feedback */}
          <Text style={styles.feedbackText}>{feedback}</Text>

          {/* Collapsible Correct Version */}
          {correctAnswer ? (
            <View>
              <Pressable
                onPress={toggleCorrectVersion}
                hitSlop={8}
                style={styles.collapseHeader}
              >
                <Text style={styles.collapseHeaderText}>Correct Version</Text>
                <Animated.View style={chevronStyle}>
                  <Ionicons
                    name="chevron-down"
                    size={14}
                    color={alpha(colors.white, 0.3)}
                  />
                </Animated.View>
              </Pressable>
              <Animated.View style={collapseBodyStyle}>
                <View style={styles.correctAnswerRow}>
                  <View style={styles.correctAnswerBar} />
                  <Text style={styles.correctAnswerText}>{correctAnswer}</Text>
                </View>
                {explanation ? (
                  <Text style={styles.explanationText}>{explanation}</Text>
                ) : null}
              </Animated.View>
            </View>
          ) : null}

          {/* Buttons */}
          <View style={styles.buttonRow}>
            <GlassIconPillButton
              label="Try Again"
              icon="refresh"
              variant="primary"
              onPress={onTryAgain}
            />
            {onSkip ? (
              <GlassIconPillButton
                label="Skip"
                icon="arrow-forward"
                variant="secondary"
                onPress={onSkip}
              />
            ) : onNext ? (
              <GlassIconPillButton
                label="Next"
                icon="arrow-forward"
                variant="secondary"
                onPress={onNext}
              />
            ) : onDone ? (
              <GlassIconPillButton
                label="Done"
                icon="checkmark"
                variant="secondary"
                onPress={onDone}
              />
            ) : null}
          </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: layout.screenPadding,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  sectionLabel: {
    fontSize: 10,
    fontFamily: fonts.bold,
    letterSpacing: 1.5,
    color: alpha(colors.white, 0.2),
    marginBottom: spacing.sm,
  },
  transcriptText: {
    fontSize: 15,
    fontFamily: fonts.medium,
    color: alpha(colors.white, 0.6),
    lineHeight: 22,
  },
  feedbackText: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: alpha(colors.white, 0.5),
    lineHeight: 20,
  },
  collapseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
  },
  collapseHeaderText: {
    fontSize: 13,
    fontFamily: fonts.semibold,
    color: alpha(colors.white, 0.35),
  },
  correctAnswerRow: {
    flexDirection: 'row',
    marginTop: spacing.xs,
  },
  correctAnswerBar: {
    width: 3,
    borderRadius: 1.5,
    backgroundColor: colors.severityPolish,
    marginRight: spacing.md,
    flexShrink: 0,
  },
  correctAnswerText: {
    flex: 1,
    fontSize: 16,
    fontFamily: fonts.bold,
    color: alpha(colors.white, 0.9),
    lineHeight: 24,
  },
  explanationText: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: alpha(colors.white, 0.2),
    lineHeight: 19,
    marginTop: spacing.sm,
    paddingLeft: 15,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
});
