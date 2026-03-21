import { View, Text, StyleSheet } from 'react-native';

interface CorrectionCardProps {
  contextSnippet: string | null;
  originalText: string;
  correctedText: string;
  explanation: string | null;
  correctionType: string;
  severity: 'error' | 'improvement' | 'polish';
}

export function CorrectionCard({
  contextSnippet,
  originalText,
  correctedText,
  explanation,
  correctionType,
  severity,
}: CorrectionCardProps) {
  const cardStyle =
    severity === 'error'
      ? styles.errorCard
      : severity === 'improvement'
        ? styles.improvementCard
        : styles.polishCard;

  const badgeStyle =
    severity === 'error'
      ? styles.errorBadge
      : severity === 'improvement'
        ? styles.improvementBadge
        : styles.polishBadge;

  const badgeTextStyle =
    severity === 'error'
      ? styles.errorBadgeText
      : severity === 'improvement'
        ? styles.improvementBadgeText
        : styles.polishBadgeText;

  const badgeLabel =
    severity === 'error'
      ? 'ERROR'
      : severity === 'improvement'
        ? 'IMPROVEMENT'
        : 'POLISH';

  return (
    <View style={[styles.card, cardStyle]}>
      {contextSnippet ? (
        <Text style={styles.contextText} numberOfLines={2}>
          ...{contextSnippet}...
        </Text>
      ) : null}

      <View style={styles.correctionRow}>
        <Text style={styles.originalText}>{originalText}</Text>
        <Text style={styles.arrow}>{' \u2192 '}</Text>
        <Text style={styles.correctedText}>{correctedText}</Text>
      </View>

      {explanation ? (
        <Text style={styles.explanationText}>{explanation}</Text>
      ) : null}

      <View style={styles.footer}>
        <Text style={styles.typeLabel}>{formatType(correctionType)}</Text>
        <View style={[styles.badge, badgeStyle]}>
          <Text style={[styles.badgeText, badgeTextStyle]}>
            {badgeLabel}
          </Text>
        </View>
      </View>
    </View>
  );
}

function formatType(type: string): string {
  return type.replace(/_/g, ' ');
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 14,
    borderRadius: 10,
    backgroundColor: '#FAFAFA',
    borderLeftWidth: 3,
  },
  errorCard: {
    borderLeftColor: '#E53935',
  },
  improvementCard: {
    borderLeftColor: '#1E88E5',
  },
  polishCard: {
    borderLeftColor: '#26A69A',
  },
  contextText: {
    fontSize: 13,
    color: '#999',
    lineHeight: 18,
    marginBottom: 8,
    fontStyle: 'italic',
  },
  correctionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginBottom: 8,
  },
  originalText: {
    fontSize: 16,
    color: '#E53935',
    textDecorationLine: 'line-through',
  },
  arrow: {
    fontSize: 16,
    color: '#999',
  },
  correctedText: {
    fontSize: 16,
    color: '#2E7D32',
    fontWeight: '600',
  },
  explanationText: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
    marginBottom: 8,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  typeLabel: {
    fontSize: 11,
    color: '#BBB',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  errorBadge: {
    backgroundColor: '#FFEBEE',
  },
  improvementBadge: {
    backgroundColor: '#E3F2FD',
  },
  polishBadge: {
    backgroundColor: '#E0F2F1',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  errorBadgeText: {
    color: '#E53935',
  },
  improvementBadgeText: {
    color: '#1E88E5',
  },
  polishBadgeText: {
    color: '#26A69A',
  },
});
