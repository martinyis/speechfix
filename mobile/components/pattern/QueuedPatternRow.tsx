import { View, Text, StyleSheet, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import { colors, alpha, fonts, layout, spacing, typography } from '../../theme';
import { StateIndicator } from './StateIndicator';
import type { QueuedPattern } from '../../types/practice';

const PATTERN_TYPE_LABEL: Record<string, string> = {
  overused_word: 'Overused Word',
  repetitive_starter: 'Sentence Starter',
  crutch_phrase: 'Crutch Phrase',
  hedging: 'Hedging',
  negative_framing: 'Negative Framing',
};

interface QueuedPatternRowProps {
  pattern: QueuedPattern;
  onPress: (pattern: QueuedPattern) => void;
  onLongPress: (pattern: QueuedPattern) => void;
}

export function QueuedPatternRow({
  pattern,
  onPress,
  onLongPress,
}: QueuedPatternRowProps) {
  const example = (pattern.exampleSentences ?? [])[0];

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress(pattern);
  };

  const handleLongPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onLongPress(pattern);
  };

  const progressFraction =
    pattern.levelProgress && pattern.levelProgress.completed > 0
      ? `${pattern.levelProgress.completed}/${pattern.levelProgress.total}`
      : null;

  return (
    <Pressable
      onPress={handlePress}
      onLongPress={handleLongPress}
      delayLongPress={500}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      accessibilityRole="button"
      accessibilityLabel={
        pattern.identifier
          ? `Queued pattern ${pattern.identifier}. Tap to make active, long-press for options.`
          : `Queued ${PATTERN_TYPE_LABEL[pattern.type] ?? pattern.type}. Tap to make active, long-press for options.`
      }
    >
      <StateIndicator state="queued" />

      <View style={styles.body}>
        <View style={styles.leftCol}>
          <Text style={styles.identifier} numberOfLines={1}>
            {pattern.identifier
              ? `"${pattern.identifier}"`
              : PATTERN_TYPE_LABEL[pattern.type] ?? pattern.type}
          </Text>
          <Text style={styles.typeLabel} numberOfLines={1}>
            {PATTERN_TYPE_LABEL[pattern.type] ?? pattern.type}
          </Text>
          {example != null && example.length > 0 && (
            <Text style={styles.example} numberOfLines={1}>
              "{example}"
            </Text>
          )}
        </View>

        <View style={styles.metaCol}>
          {progressFraction != null && (
            <>
              <Text style={styles.progressChip}>{progressFraction}</Text>
              <Text style={styles.metaSep}>·</Text>
            </>
          )}
          <Text style={styles.freq}>{pattern.frequency}×</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: layout.screenPadding,
    paddingVertical: 12,
    gap: spacing.md,
  },
  rowPressed: {
    backgroundColor: alpha(colors.white, 0.03),
  },
  body: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  leftCol: {
    flex: 1,
    gap: 2,
  },
  identifier: {
    ...typography.bodyMdMedium,
    color: colors.onSurface,
  },
  typeLabel: {
    ...typography.labelSm,
    color: alpha(colors.white, 0.5),
  },
  example: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: alpha(colors.white, 0.2),
    fontStyle: 'italic',
    marginTop: 2,
  },
  metaCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  progressChip: {
    ...typography.labelSm,
    color: alpha(colors.primary, 0.5),
  },
  metaSep: {
    ...typography.labelSm,
    color: alpha(colors.white, 0.15),
  },
  freq: {
    ...typography.labelSm,
    color: alpha(colors.white, 0.3),
  },
});
