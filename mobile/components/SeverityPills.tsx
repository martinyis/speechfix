import { View, Text, StyleSheet, Pressable } from 'react-native';
import { colors, alpha } from '../theme';

export type CorrectionFilter = 'all' | 'error' | 'improvement' | 'polish';

interface SeverityPillsProps {
  errorCount: number;
  improvementCount: number;
  polishCount: number;
  activeFilter: CorrectionFilter;
  onFilterChange: (filter: CorrectionFilter) => void;
}

const PILLS: {
  key: CorrectionFilter;
  color: string;
  label: (n: number) => string;
}[] = [
  {
    key: 'error',
    color: colors.severityError,
    label: (n) => `${n} Error${n !== 1 ? 's' : ''}`,
  },
  {
    key: 'improvement',
    color: colors.severityImprovement,
    label: (n) => `${n} Improve`,
  },
  {
    key: 'polish',
    color: colors.severityPolish,
    label: (n) => `${n} Polish`,
  },
];

export function SeverityPills({
  errorCount,
  improvementCount,
  polishCount,
  activeFilter,
  onFilterChange,
}: SeverityPillsProps) {
  const counts: Record<CorrectionFilter, number> = {
    all: errorCount + improvementCount + polishCount,
    error: errorCount,
    improvement: improvementCount,
    polish: polishCount,
  };

  const visiblePills = PILLS.filter((p) => counts[p.key] > 0);
  if (visiblePills.length === 0) return null;

  return (
    <View style={styles.container}>
      {visiblePills.map((pill) => {
        const isActive = activeFilter === pill.key;
        return (
          <Pressable
            key={pill.key}
            style={[
              styles.pill,
              {
                backgroundColor: alpha(pill.color, isActive ? 0.18 : 0.08),
                borderColor: alpha(pill.color, isActive ? 0.35 : 0.18),
              },
            ]}
            onPress={() => onFilterChange(pill.key)}
          >
            <View style={[styles.dot, { backgroundColor: pill.color }]} />
            <Text
              style={[
                styles.pillText,
                { color: isActive ? pill.color : alpha(pill.color, 0.7) },
              ]}
            >
              {pill.label(counts[pill.key])}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 20,
    marginTop: 16,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 100,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  pillText: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});
