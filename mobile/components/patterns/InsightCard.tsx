import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, alpha, typography, spacing } from '../../theme';
import { GradientText } from '../GradientText';
import type { PatternInsight } from './mockData';

interface InsightCardProps {
  insight: PatternInsight;
  compact?: boolean;
}

const TREND_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  up: 'trending-up',
  down: 'trending-down',
  neutral: 'remove-outline',
};

const TREND_COLORS: Record<string, string> = {
  up: colors.severityPolish,
  down: colors.error,
  neutral: alpha(colors.white, 0.4),
};

function InsightCardInner({ insight, compact = false }: InsightCardProps) {
  return (
    <View style={[styles.card, compact && styles.cardCompact]}>
      {/* Gradient background */}
      <LinearGradient
        colors={[
          alpha(colors.primary, 0.06),
          alpha(colors.secondary, 0.04),
          alpha(colors.white, 0.02),
        ]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Trend icon */}
      <View style={styles.trendIcon}>
        <Ionicons
          name={TREND_ICONS[insight.trend]}
          size={14}
          color={TREND_COLORS[insight.trend]}
        />
      </View>

      {/* Value */}
      <GradientText
        text={insight.value}
        style={compact ? styles.valueCompact : styles.valueFull}
        colors={[colors.primary, colors.secondary]}
      />

      {/* Description */}
      <Text style={[styles.description, compact && styles.descriptionCompact]} numberOfLines={2}>
        {insight.description}
      </Text>
    </View>
  );
}

export const InsightCard = React.memo(InsightCardInner);

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: alpha(colors.white, 0.06),
    padding: spacing.lg,
  },
  cardCompact: {
    flex: 1,
    padding: spacing.md,
  },
  trendIcon: {
    position: 'absolute',
    top: 12,
    right: 12,
  },
  valueFull: {
    ...typography.headlineLg,
    color: colors.onSurface,
  },
  valueCompact: {
    ...typography.headlineSm,
    color: colors.onSurface,
  },
  description: {
    ...typography.bodyMd,
    color: colors.onSurfaceVariant,
    marginTop: 4,
  },
  descriptionCompact: {
    ...typography.bodySm,
  },
});
