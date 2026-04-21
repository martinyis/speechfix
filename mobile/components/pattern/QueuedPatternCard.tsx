import { View, Text, StyleSheet } from 'react-native';
import { colors, alpha, fonts, layout } from '../../theme';
import type { QueuedPattern } from '../../types/practice';

const PATTERN_TYPE_LABEL: Record<string, string> = {
  overused_word: 'Overused Word',
  repetitive_starter: 'Sentence Starter',
  crutch_phrase: 'Crutch Phrase',
  hedging: 'Hedging',
  negative_framing: 'Negative Framing',
};

interface QueuedPatternCardProps {
  pattern: QueuedPattern;
}

export function QueuedPatternCard({ pattern }: QueuedPatternCardProps) {
  const examples = (pattern.exampleSentences ?? []).slice(0, 2);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title} numberOfLines={1}>
          {pattern.identifier ? `"${pattern.identifier}"` : PATTERN_TYPE_LABEL[pattern.type] ?? pattern.type}
        </Text>
        <Text style={styles.freq}>{pattern.frequency}x</Text>
      </View>
      {pattern.identifier && (
        <Text style={styles.typeLabel}>
          {PATTERN_TYPE_LABEL[pattern.type] ?? pattern.type}
        </Text>
      )}
      {examples.length > 0 && (
        <View style={styles.examplesWrap}>
          {examples.map((ex, i) => (
            <Text key={i} style={styles.example} numberOfLines={1}>
              "{ex}"
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: layout.screenPadding,
    paddingVertical: 12,
    gap: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 15,
    fontFamily: fonts.semibold,
    color: alpha(colors.white, 0.5),
    flex: 1,
  },
  freq: {
    fontSize: 12,
    fontFamily: fonts.bold,
    color: alpha(colors.white, 0.2),
    marginLeft: 8,
  },
  typeLabel: {
    fontSize: 11,
    fontFamily: fonts.medium,
    color: alpha(colors.white, 0.2),
  },
  examplesWrap: {
    marginTop: 4,
    gap: 2,
  },
  example: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: alpha(colors.white, 0.2),
    fontStyle: 'italic',
  },
});
