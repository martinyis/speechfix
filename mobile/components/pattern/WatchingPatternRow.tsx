import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors, alpha, layout, typography, spacing } from '../../theme';
import { StateIndicator } from './StateIndicator';
import type { WatchingPattern } from '../../types/practice';

const PATTERN_TYPE_LABEL: Record<string, string> = {
  overused_word: 'Overused Word',
  repetitive_starter: 'Sentence Starter',
  crutch_phrase: 'Crutch Phrase',
  hedging: 'Hedging',
  negative_framing: 'Negative Framing',
};

interface WatchingPatternRowProps {
  pattern: WatchingPattern;
  onPress: (pattern: WatchingPattern) => void;
}

export function WatchingPatternRow({ pattern, onPress }: WatchingPatternRowProps) {
  const count = pattern.cleanSessionCount;
  const target = pattern.cleanSessionTarget || 3;
  const lastClean = pattern.sessionsHistory[0]?.wasClean ?? true;

  let metaText: string;
  let metaColor: string;

  if (count >= target) {
    metaText = 'Ready to graduate';
    metaColor = colors.severityPolish;
  } else if (!lastClean && pattern.sessionsHistory.length > 0) {
    metaText = `Watching · ${count} of ${target} clean — last session still had it`;
    metaColor = alpha(colors.secondary, 0.7);
  } else {
    metaText = `Watching · ${count} of ${target} sessions clean`;
    metaColor = alpha(colors.secondary, 0.7);
  }

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress(pattern);
  };

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      accessibilityRole="button"
      accessibilityLabel={
        pattern.identifier
          ? `Watching pattern ${pattern.identifier}`
          : `Watching ${PATTERN_TYPE_LABEL[pattern.type] ?? pattern.type}`
      }
    >
      <StateIndicator state="watching" />

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
        </View>

        <View style={styles.rightCol}>
          <Text style={[styles.meta, { color: metaColor }]} numberOfLines={2}>
            {metaText}
          </Text>
          <Ionicons
            name="chevron-forward"
            size={16}
            color={alpha(colors.white, 0.3)}
            style={styles.chevron}
          />
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
    paddingVertical: 14,
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
    flexShrink: 1,
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
  rightCol: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
  meta: {
    ...typography.labelSm,
    textAlign: 'right',
    flexShrink: 1,
  },
  chevron: {
    marginLeft: 2,
  },
});
