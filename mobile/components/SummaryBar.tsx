import { View, Text, StyleSheet } from 'react-native';

interface SummaryBarProps {
  totalSentences: number;
  errorCount: number;
  improvementCount: number;
  polishCount: number;
  sentencesWithCorrections: number;
}

export function SummaryBar({
  totalSentences,
  errorCount,
  improvementCount,
  polishCount,
  sentencesWithCorrections,
}: SummaryBarProps) {
  const cleanSentences = Math.max(0, totalSentences - sentencesWithCorrections);
  const totalIssues = errorCount + improvementCount + polishCount;

  const counts: Array<{ count: number; label: string; dotStyle: object }> = [];
  if (errorCount > 0) {
    counts.push({
      count: errorCount,
      label: errorCount === 1 ? 'error' : 'errors',
      dotStyle: styles.errorDot,
    });
  }
  if (improvementCount > 0) {
    counts.push({
      count: improvementCount,
      label: improvementCount === 1 ? 'improvement' : 'improvements',
      dotStyle: styles.improvementDot,
    });
  }
  if (polishCount > 0) {
    counts.push({
      count: polishCount,
      label: polishCount === 1 ? 'polish' : 'polish',
      dotStyle: styles.polishDot,
    });
  }

  return (
    <View style={styles.container}>
      <Text style={styles.headline}>
        {cleanSentences} of {totalSentences} sentences clean
      </Text>
      <View style={styles.countsRow}>
        {counts.map((item, index) => (
          <View key={item.label} style={styles.countBadge}>
            {index > 0 && <Text style={styles.separator}>{'\u00B7'}</Text>}
            <View style={[styles.dot, item.dotStyle]} />
            <Text style={styles.countText}>
              {item.count} {item.label}
            </Text>
          </View>
        ))}
        {totalIssues === 0 && (
          <Text style={styles.cleanText}>No issues found</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
  },
  headline: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  countsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 8,
  },
  countBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  errorDot: {
    backgroundColor: '#E53935',
  },
  improvementDot: {
    backgroundColor: '#1E88E5',
  },
  polishDot: {
    backgroundColor: '#26A69A',
  },
  countText: {
    fontSize: 14,
    color: '#666',
  },
  separator: {
    fontSize: 14,
    color: '#999',
  },
  cleanText: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '500',
  },
});
