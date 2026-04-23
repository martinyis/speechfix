import { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
  Easing,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
import { colors, alpha, fonts } from '../../theme';
import { wordDiff } from '../../lib/wordDiff';

export type DrillSeverity = 'error' | 'improvement' | 'polish';

const SEVERITY_COLOR: Record<DrillSeverity, string> = {
  error: colors.severityError,
  improvement: colors.severityImprovement,
  polish: colors.severityPolish,
};

export interface DrillPromptProps {
  originalText: string;
  correctedText: string;
  /** Surrounding sentence context. Null/absent for exercise items. */
  context?: string | null;
  severity: DrillSeverity;
  shortReason?: string | null;
  explanation: string | null;
}

/**
 * Faded-context + highlighted-target prompt for practice drills. The highlighted
 * span is what the user needs to fix and speak; the surrounding context is
 * deliberately demoted so the user reads-to-orient but speaks only the fix.
 */
export default function DrillPrompt({
  originalText,
  correctedText,
  context,
  severity,
  shortReason,
  explanation,
}: DrillPromptProps) {
  const sev = SEVERITY_COLOR[severity];
  const [expanded, setExpanded] = useState(false);
  const chevronRot = useSharedValue(0);

  const toggle = useCallback(() => {
    const next = !expanded;
    setExpanded(next);
    chevronRot.value = withTiming(next ? 1 : 0, {
      duration: 200,
      easing: Easing.out(Easing.cubic),
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [expanded, chevronRot]);

  useEffect(() => {
    setExpanded(false);
    chevronRot.value = 0;
  }, [originalText, correctedText, explanation, chevronRot]);

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${interpolate(chevronRot.value, [0, 1], [0, 180])}deg` }],
  }));

  const tag = shortReason?.trim() || null;

  return (
    <View style={styles.wrap}>
      {renderContext(context, originalText, correctedText, sev)}

      <View style={styles.diagRowWrap}>
        <View style={styles.diagRow}>
          <Ionicons name="arrow-up" size={13} color={sev} />
          <Text style={styles.fixText} numberOfLines={1}>
            Fix
            {tag ? (
              <>
                {'  '}
                <Text style={[styles.tag, { color: sev }]}>{tag}</Text>
              </>
            ) : null}
          </Text>
          {explanation ? (
            <Pressable onPress={toggle} hitSlop={10} style={styles.whyBtn}>
              <Text style={styles.whyText}>{expanded ? 'Less' : 'Why?'}</Text>
              <Animated.View style={chevronStyle}>
                <Ionicons
                  name="chevron-down"
                  size={12}
                  color={alpha(colors.white, 0.4)}
                />
              </Animated.View>
            </Pressable>
          ) : null}
        </View>

        {expanded && explanation ? (
          <Animated.View
            entering={FadeIn.duration(160)}
            exiting={FadeOut.duration(120)}
            style={styles.explanationWrap}
          >
            <Text style={styles.explanation}>{explanation}</Text>
          </Animated.View>
        ) : null}
      </View>
    </View>
  );
}

function renderContext(
  context: string | null | undefined,
  originalText: string,
  correctedText: string,
  sev: string,
) {
  if (context) {
    const idx = context.toLowerCase().indexOf(originalText.toLowerCase());
    if (idx >= 0) {
      const before = context.slice(0, idx);
      const match = context.slice(idx, idx + originalText.length);
      const after = context.slice(idx + originalText.length);
      return (
        <Text style={styles.contextBase}>
          {before ? <Text>{before}</Text> : null}
          <Text style={[styles.target, { textDecorationColor: sev }]}>{match}</Text>
          {after ? <Text>{after}</Text> : null}
        </Text>
      );
    }
  }
  // Fallback (exercise items, or context lookup failure): diff original↔corrected.
  return (
    <Text style={styles.contextBase}>
      {wordDiff(originalText, correctedText).map((seg, i) => (
        <Text
          key={i}
          style={
            seg.type === 'equal'
              ? undefined
              : [styles.target, { textDecorationColor: sev }]
          }
        >
          {i > 0 ? ' ' : ''}{seg.text}
        </Text>
      ))}
    </Text>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 18,
  },
  contextBase: {
    fontSize: 20,
    lineHeight: 30,
    fontFamily: fonts.medium,
    color: alpha(colors.white, 0.22),
  },
  target: {
    color: alpha(colors.white, 0.98),
    fontFamily: fonts.bold,
    textDecorationLine: 'underline',
    textDecorationStyle: 'solid',
  },
  diagRowWrap: {
    position: 'relative',
  },
  diagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  explanationWrap: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    paddingTop: 10,
  },
  fixText: {
    flex: 1,
    fontSize: 13,
    fontFamily: fonts.semibold,
    color: alpha(colors.white, 0.55),
    letterSpacing: 0.2,
  },
  tag: {
    fontFamily: fonts.bold,
  },
  whyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  whyText: {
    fontSize: 12,
    fontFamily: fonts.semibold,
    color: alpha(colors.white, 0.4),
  },
  explanation: {
    fontSize: 13,
    lineHeight: 20,
    fontFamily: fonts.medium,
    color: alpha(colors.white, 0.5),
    fontStyle: 'italic',
  },
});
