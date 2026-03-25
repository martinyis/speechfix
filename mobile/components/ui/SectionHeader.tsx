import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, spacing, alpha, typography } from '@/theme';

type SectionHeaderProps = {
  label: string;
  subtitle?: string;
  size?: 'sm' | 'md' | 'lg';
  action?: {
    label: string;
    onPress: () => void;
  };
};

export function SectionHeader({
  label,
  subtitle,
  size = 'md',
  action,
}: SectionHeaderProps) {
  const titleStyle =
    size === 'sm'
      ? styles.titleSm
      : size === 'lg'
        ? styles.titleLg
        : styles.titleMd;

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Text style={titleStyle}>{label}</Text>
        {action != null && (
          <Pressable onPress={action.onPress} hitSlop={8}>
            <Text style={styles.actionText}>{action.label}</Text>
          </Pressable>
        )}
      </View>
      {subtitle != null && (
        <Text style={styles.subtitle}>{subtitle}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xxs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  // ── Size variants ─────────────────────────────────────────────────────
  titleSm: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: alpha(colors.white, 0.5),
  },
  titleMd: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.3,
    color: colors.onSurface,
  },
  titleLg: {
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -1,
    color: colors.onSurface,
  },

  subtitle: {
    ...typography.bodyMd,
    color: alpha(colors.white, 0.35),
  },

  actionText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
});
