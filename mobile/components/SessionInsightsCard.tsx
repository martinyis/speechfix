import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, alpha, fonts, spacing, layout, glass } from '../theme';
import { formatDuration } from '../lib/formatters';
import type { SessionInsight } from '../types/session';

interface SessionInsightsCardProps {
  insights: SessionInsight[];
  durationSeconds: number;
  isLoading?: boolean;
}

export function SessionInsightsCard({
  insights,
  durationSeconds,
  isLoading,
}: SessionInsightsCardProps) {
  const qualityAssessment = insights.find((i) => i.type === 'quality_assessment');
  const metrics = insights.filter((i) => i.type === 'metric');
  const strengths = insights.filter((i) => i.type === 'strength');
  const focusAreas = insights.filter((i) => i.type === 'focus_area');

  if (isLoading) {
    return (
      <View style={[styles.card, styles.loadingCard]}>
        <ActivityIndicator size="small" color={colors.primary} />
        <Text style={styles.loadingText}>Generating insights...</Text>
      </View>
    );
  }

  // Don't render if no meaningful insights
  if (!qualityAssessment && metrics.length === 0) return null;

  return (
    <View style={styles.card}>
      {/* Header row */}
      <View style={styles.headerRow}>
        <Text style={styles.headerLabel}>SESSION BRIEF</Text>
        <Text style={styles.durationLabel}>{formatDuration(durationSeconds)}</Text>
      </View>

      {/* Quality assessment */}
      {qualityAssessment && (
        <Text style={styles.qualityText}>
          "{qualityAssessment.description}"
        </Text>
      )}

      {/* Metrics row */}
      {metrics.length > 0 && (
        <View style={styles.metricsRow}>
          {metrics.slice(0, 4).map((m, i) => (
            <View key={i} style={styles.metricCard}>
              <Text style={styles.metricValue}>
                {m.value != null ? m.value : '-'}
              </Text>
              <Text style={styles.metricLabel} numberOfLines={1}>
                {m.description.toLowerCase()}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Strengths */}
      {strengths.length > 0 && (
        <View style={styles.insightRow}>
          <Ionicons name="add-circle" size={14} color={colors.severityPolish} />
          <Text style={styles.insightText}>
            {strengths.map((s) => s.description).join(', ')}
          </Text>
        </View>
      )}

      {/* Focus areas */}
      {focusAreas.length > 0 && (
        <View style={styles.insightRow}>
          <Ionicons name="remove-circle" size={14} color={colors.severityImprovement} />
          <Text style={styles.insightText}>
            {focusAreas.map((f) => f.description).join(', ')}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: layout.screenPadding,
    marginBottom: spacing.lg,
    padding: spacing.lg,
    ...glass.card,
  },
  loadingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  loadingText: {
    fontSize: 14,
    fontFamily: fonts.medium,
    color: alpha(colors.white, 0.4),
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  headerLabel: {
    fontSize: 11,
    fontFamily: fonts.bold,
    color: alpha(colors.white, 0.25),
    letterSpacing: 1.2,
  },
  durationLabel: {
    fontSize: 13,
    fontFamily: fonts.medium,
    color: alpha(colors.white, 0.3),
  },
  qualityText: {
    fontSize: 15,
    fontFamily: fonts.regular,
    color: alpha(colors.white, 0.7),
    lineHeight: 22,
    fontStyle: 'italic',
    marginBottom: spacing.lg,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: spacing.lg,
  },
  metricCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: alpha(colors.white, 0.04),
    borderWidth: 1,
    borderColor: alpha(colors.white, 0.06),
  },
  metricValue: {
    fontSize: 18,
    fontFamily: fonts.extrabold,
    color: colors.onSurface,
    letterSpacing: -0.5,
  },
  metricLabel: {
    fontSize: 10,
    fontFamily: fonts.medium,
    color: alpha(colors.white, 0.3),
    marginTop: 2,
  },
  insightRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 6,
  },
  insightText: {
    flex: 1,
    fontSize: 13,
    fontFamily: fonts.regular,
    color: alpha(colors.white, 0.5),
    lineHeight: 18,
  },
});
