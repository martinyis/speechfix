import { View, Text, StyleSheet } from 'react-native';
import { colors, alpha, fonts, spacing } from '../../theme';
import type { SessionInsight } from '../../types/session';

interface Props {
  insights: SessionInsight[];
}

const PATTERN_TYPES: ReadonlySet<SessionInsight['type']> = new Set([
  'hedging_pattern',
  'repetitive_word',
  'discourse_pattern',
]);

const LABELS: Record<string, string> = {
  hedging_pattern: 'Hedging',
  repetitive_word: 'Repetition',
  discourse_pattern: 'Discourse',
};

export function SessionPatterns({ insights }: Props) {
  const patterns = insights.filter(i => PATTERN_TYPES.has(i.type));
  if (patterns.length === 0) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.sectionLabel}>Patterns</Text>
      {patterns.map((p, i) => (
        <View key={i} style={styles.row}>
          <Text style={styles.tag}>{LABELS[p.type] ?? 'Pattern'}</Text>
          <Text style={styles.description}>{p.description}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  sectionLabel: {
    fontSize: 11,
    fontFamily: fonts.bold,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: alpha(colors.white, 0.35),
    marginBottom: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 4,
  },
  tag: {
    fontSize: 10,
    fontFamily: fonts.bold,
    color: alpha(colors.primary, 0.85),
    letterSpacing: 1,
    textTransform: 'uppercase',
    paddingTop: 3,
    minWidth: 74,
  },
  description: {
    flex: 1,
    fontSize: 14,
    fontFamily: fonts.regular,
    color: alpha(colors.white, 0.65),
    lineHeight: 20,
  },
});
