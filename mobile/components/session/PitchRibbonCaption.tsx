/**
 * PitchRibbonCaption — sticky bubble shown when the user taps a point on the ribbon.
 * Auto-hides after 5s of inactivity.
 */

import { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { colors, alpha, fonts, spacing } from '../../theme';

interface PitchRibbonCaptionProps {
  visible: boolean;
  timeSeconds: number;
  sentence: string;
  confidence: number;
  onTimeout?: () => void;
}

export function PitchRibbonCaption({
  visible,
  timeSeconds,
  sentence,
  confidence,
  onTimeout,
}: PitchRibbonCaptionProps) {
  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => onTimeout?.(), 5000);
    return () => clearTimeout(t);
  }, [visible, timeSeconds, sentence, onTimeout]);

  if (!visible) return null;

  const m = Math.floor(timeSeconds / 60);
  const s = Math.floor(timeSeconds % 60);
  const timeLabel = `${m}:${s.toString().padStart(2, '0')}`;

  return (
    <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(150)} style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.time}>{timeLabel}</Text>
        <Text style={styles.stat}>Clarity {Math.round(confidence * 100)}%</Text>
      </View>
      {sentence ? <Text style={styles.sentence} numberOfLines={2}>{sentence}</Text> : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: alpha(colors.white, 0.06),
    borderRadius: 12,
    borderWidth: 1,
    borderColor: alpha(colors.white, 0.08),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  time: {
    fontSize: 12,
    fontFamily: fonts.bold,
    color: alpha(colors.white, 0.75),
  },
  stat: {
    fontSize: 12,
    fontFamily: fonts.medium,
    color: alpha(colors.white, 0.45),
  },
  sentence: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: alpha(colors.white, 0.85),
    lineHeight: 20,
  },
});
