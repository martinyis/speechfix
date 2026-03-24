import { View, Text, StyleSheet } from 'react-native';
import { colors, alpha } from '../theme';

interface Props {
  fillerWords: { word: string; count: number }[];
  durationSeconds?: number;
}

const FILLER_COLORS = [colors.primary, colors.secondary, colors.tertiary];

export function FillerChips({ fillerWords, durationSeconds }: Props) {
  if (fillerWords.length === 0) return null;

  const sorted = [...fillerWords].sort((a, b) => b.count - a.count);
  const totalCount = sorted.reduce((sum, f) => sum + f.count, 0);
  const isHighImpact = totalCount >= 5;
  const fillersPerMinute =
    durationSeconds && durationSeconds > 0
      ? (totalCount / (durationSeconds / 60)).toFixed(1)
      : null;

  return (
    <View style={styles.section}>
      {/* Section header */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <Text style={styles.sectionLabel}>FILLER FREQUENCY</Text>
          {fillersPerMinute && (
            <Text style={styles.perMinute}>{fillersPerMinute} per minute</Text>
          )}
        </View>
        {isHighImpact && (
          <View style={styles.impactBadge}>
            <Text style={styles.impactBadgeText}>High Impact</Text>
          </View>
        )}
      </View>

      {/* Filler grid */}
      <View style={styles.grid}>
        {sorted.map((filler, index) => {
          const color =
            index < FILLER_COLORS.length
              ? FILLER_COLORS[index]
              : alpha(colors.white, 0.5);

          return (
            <View key={filler.word} style={styles.gridItem}>
              <View style={styles.gridItemContent}>
                <Text style={[styles.fillerWord, { color }]}>
                  {filler.word}
                </Text>
                <Text style={styles.fillerCount}>x{filler.count}</Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    paddingHorizontal: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: alpha(colors.white, 0.25),
    letterSpacing: 3,
    textTransform: 'uppercase',
  },
  perMinute: {
    fontSize: 12,
    fontWeight: '500',
    color: alpha(colors.white, 0.35),
  },
  impactBadge: {
    borderWidth: 1,
    borderColor: alpha(colors.severityError, 0.4),
    borderRadius: 100,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  impactBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.severityError,
    letterSpacing: 0.5,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  gridItem: {
    width: '50%',
    paddingBottom: 0,
  },
  gridItemContent: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: alpha(colors.white, 0.05),
    paddingRight: 16,
  },
  fillerWord: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  fillerCount: {
    fontSize: 15,
    fontWeight: '500',
    color: alpha(colors.white, 0.35),
  },
});
