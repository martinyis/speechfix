import { View, Text, StyleSheet } from 'react-native';

interface SessionInsightCardProps {
  type: 'repetitive_word' | 'hedging_pattern' | 'discourse_pattern';
  description: string;
}

const TYPE_LABELS: Record<string, string> = {
  repetitive_word: 'Repetitive Word',
  hedging_pattern: 'Hedging Pattern',
  discourse_pattern: 'Discourse Pattern',
};

export function SessionInsightCard({ type, description }: SessionInsightCardProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.typeLabel}>{TYPE_LABELS[type] ?? type}</Text>
      <Text style={styles.description}>{description}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#F3F0FF',
    borderLeftWidth: 3,
    borderLeftColor: '#7C4DFF',
  },
  typeLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#7C4DFF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  description: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
});
