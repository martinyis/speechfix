import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, alpha, typography, spacing, fonts } from '../../theme';
import { GlassCard } from '../ui/GlassCard';
import { MiniScoreRing } from './MiniScoreRing';
import type { PatternCategory } from './mockData';

interface CategoryCardProps {
  category: PatternCategory;
  variant: 'large' | 'small';
}

function CategoryCardInner({ category, variant }: CategoryCardProps) {
  const isPositive = category.trend >= 0;
  const trendColor = isPositive ? colors.severityPolish : colors.error;
  const trendIcon: keyof typeof Ionicons.glyphMap = isPositive
    ? 'arrow-up'
    : 'arrow-down';

  if (variant === 'large') {
    return (
      <GlassCard>
        <View style={styles.largeLayout}>
          <MiniScoreRing score={category.score} color={category.color} />

          <View style={styles.largeContent}>
            <Text style={styles.categoryName}>{category.name}</Text>
            <Text style={styles.categoryDescription} numberOfLines={1}>
              {category.description}
            </Text>
            <TrendBadge trend={category.trend} color={trendColor} icon={trendIcon} />
          </View>
        </View>
      </GlassCard>
    );
  }

  // Small variant — vertical layout
  return (
    <GlassCard style={styles.smallCard}>
      <View style={styles.smallLayout}>
        <MiniScoreRing score={category.score} color={category.color} />
        <Text style={styles.smallName}>{category.name}</Text>
        <TrendBadge trend={category.trend} color={trendColor} icon={trendIcon} />
      </View>
    </GlassCard>
  );
}

interface TrendBadgeProps {
  trend: number;
  color: string;
  icon: keyof typeof Ionicons.glyphMap;
}

function TrendBadge({ trend, color, icon }: TrendBadgeProps) {
  return (
    <View style={[styles.trendBadge, { backgroundColor: alpha(color, 0.12) }]}>
      <Ionicons name={icon} size={10} color={color} />
      <Text style={[styles.trendText, { color }]}>
        {Math.abs(trend)}%
      </Text>
    </View>
  );
}

export const CategoryCard = React.memo(CategoryCardInner);

const styles = StyleSheet.create({
  // Large variant
  largeLayout: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  largeContent: {
    flex: 1,
    gap: 4,
  },
  categoryName: {
    ...typography.headlineSm,
    color: colors.onSurface,
    fontSize: 18,
  },
  categoryDescription: {
    ...typography.bodySm,
    color: colors.onSurfaceVariant,
  },

  // Small variant
  smallCard: {
    flex: 1,
  },
  smallLayout: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  smallName: {
    ...typography.bodyMdMedium,
    color: colors.onSurface,
  },

  // Trend badge
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderRadius: 100,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  trendText: {
    fontSize: 11,
    fontFamily: fonts.bold,
  },
});
