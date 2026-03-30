import { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, alpha, fonts } from '../theme';
import type { FillerWord } from '../types/session';

interface SessionSummaryCardProps {
  clarityScore: number;
  errorCount: number;
  improvementCount: number;
  polishCount: number;
  fillerWords: FillerWord[];
  durationSeconds: number;
}

const SEVERITY_ITEMS: {
  key: 'error' | 'improvement' | 'polish';
  color: string;
  label: string;
}[] = [
  { key: 'error', color: colors.severityError, label: 'errors' },
  { key: 'improvement', color: colors.severityImprovement, label: 'improve' },
  { key: 'polish', color: colors.severityPolish, label: 'polish' },
];

const TOTAL_SEGMENTS = 20;

export function SessionSummaryCard({
  clarityScore,
  errorCount,
  improvementCount,
  polishCount,
  fillerWords,
  durationSeconds,
}: SessionSummaryCardProps) {
  const countsMap = { error: errorCount, improvement: improvementCount, polish: polishCount };
  const visibleSeverities = SEVERITY_ITEMS.filter((s) => countsMap[s.key] > 0);

  const totalFillers = fillerWords.reduce((sum, f) => sum + f.count, 0);
  const hasFillers = totalFillers > 0;
  const sorted = [...fillerWords].sort((a, b) => b.count - a.count).slice(0, 3);
  const fillersPerMinute =
    durationSeconds > 0 ? (totalFillers / (durationSeconds / 60)).toFixed(1) : null;
  const isHighImpact = totalFillers >= 5;

  const filledSegments = Math.round((clarityScore / 100) * TOTAL_SEGMENTS);

  // Pre-compute gradient colors for filled segments
  const segmentColors = useMemo(() => {
    const r1 = 204, g1 = 151, b1 = 255; // primary #cc97ff
    const r2 = 105, g2 = 156, b2 = 255; // secondary #699cff
    return Array.from({ length: TOTAL_SEGMENTS }, (_, i) => {
      if (i >= filledSegments) return null;
      const t = filledSegments <= 1 ? 0 : i / (filledSegments - 1);
      const r = Math.round(r1 + (r2 - r1) * t);
      const g = Math.round(g1 + (g2 - g1) * t);
      const b = Math.round(b1 + (b2 - b1) * t);
      return `rgb(${r}, ${g}, ${b})`;
    });
  }, [filledSegments]);

  return (
    <View style={styles.container}>
      {/* Score + segmented meter row */}
      <View style={styles.meterRow}>
        <Text style={styles.scoreValue}>{clarityScore}%</Text>

        <View style={styles.segmentsContainer}>
          {Array.from({ length: TOTAL_SEGMENTS }, (_, i) => {
            const isFilled = i < filledSegments;
            return (
              <View
                key={i}
                style={[
                  styles.segment,
                  isFilled
                    ? { backgroundColor: segmentColors[i]! }
                    : styles.segmentEmpty,
                ]}
              />
            );
          })}
        </View>
      </View>

      {/* Glow under the filled segments */}
      <View style={styles.glowRow}>
        <View style={styles.scoreSpacerGlow} />
        <LinearGradient
          colors={[alpha(colors.primary, 0.15), alpha(colors.secondary, 0.08), 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.segmentGlow, { width: `${Math.max(clarityScore, 5)}%` }]}
        />
      </View>

      {/* Summary text */}
      <View style={styles.summaryRow}>
        {visibleSeverities.length > 0 && (
          <View style={styles.severityRow}>
            {visibleSeverities.map((s, i) => (
              <View key={s.key} style={styles.severityItem}>
                {i > 0 && <Text style={styles.dot}>{'\u00B7'}</Text>}
                <View style={[styles.severityDot, { backgroundColor: s.color }]} />
                <Text style={[styles.severityText, { color: alpha(s.color, 0.85) }]}>
                  {countsMap[s.key]} {s.label}
                </Text>
              </View>
            ))}
          </View>
        )}

        {hasFillers && (
          <View style={styles.fillerRow}>
            <Text style={styles.fillerText}>
              {sorted.map((f) => `\u201C${f.word}\u201D x${f.count}`).join('  ')}
            </Text>
            {fillersPerMinute && (
              <Text style={styles.fillerRate}>{fillersPerMinute}/min</Text>
            )}
            {isHighImpact && (
              <View style={styles.highBadge}>
                <Text style={styles.highBadgeText}>High</Text>
              </View>
            )}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 12,
  },

  // Score + segments row
  meterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    gap: 14,
  },
  scoreValue: {
    fontSize: 28,
    color: colors.onSurface,
    letterSpacing: -1,
    fontFamily: fonts.extrabold,
    minWidth: 62,
  },
  segmentsContainer: {
    flex: 1,
    flexDirection: 'row',
    gap: 3,
    alignItems: 'center',
  },
  segment: {
    flex: 1,
    height: 6,
    borderRadius: 3,
  },
  segmentEmpty: {
    backgroundColor: alpha(colors.white, 0.06),
  },

  // Glow
  glowRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginTop: -2,
    height: 12,
  },
  scoreSpacerGlow: {
    width: 76,
  },
  segmentGlow: {
    height: 12,
    borderRadius: 6,
    opacity: 0.7,
  },

  // Summary
  summaryRow: {
    paddingHorizontal: 20,
    paddingTop: 10,
    gap: 6,
  },
  severityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 2,
  },
  severityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  severityDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  severityText: {
    fontSize: 12,
    fontFamily: fonts.semibold,
    letterSpacing: 0.2,
  },
  dot: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: alpha(colors.white, 0.15),
    marginHorizontal: 4,
  },

  // Fillers
  fillerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  fillerText: {
    fontSize: 12,
    fontFamily: fonts.medium,
    color: alpha(colors.white, 0.3),
  },
  fillerRate: {
    fontSize: 11,
    fontFamily: fonts.medium,
    color: alpha(colors.white, 0.2),
  },
  highBadge: {
    borderWidth: 1,
    borderColor: alpha(colors.severityError, 0.35),
    borderRadius: 100,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  highBadgeText: {
    fontSize: 9,
    fontFamily: fonts.semibold,
    color: colors.severityError,
    letterSpacing: 0.3,
  },
});
