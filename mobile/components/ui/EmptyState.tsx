import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, alpha, fonts } from '@/theme';
import { GlassIconPillButton } from './GlassIconPillButton';

type EmptyStateProps = {
  icon?: string;
  iconColor?: string;
  title: string;
  subtitle?: string;
  action?: {
    label: string;
    onPress: () => void;
  };
  fullScreen?: boolean;
};

export function EmptyState({
  icon,
  iconColor = alpha(colors.white, 0.3),
  title,
  subtitle,
  action,
  fullScreen = false,
}: EmptyStateProps) {
  return (
    <View style={fullScreen ? styles.fullScreen : styles.inline}>
      {icon != null && (
        <Ionicons
          name={icon as any}
          size={fullScreen ? 48 : 32}
          color={iconColor}
        />
      )}
      <Text style={styles.title}>{title}</Text>
      {subtitle != null && <Text style={styles.subtitle}>{subtitle}</Text>}
      {action != null && (
        <GlassIconPillButton
          variant="primary"
          label={action.label}
          onPress={action.onPress}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fullScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    gap: spacing.sm,
    padding: spacing.xl,
  },
  inline: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: spacing.sm,
  },
  title: {
    ...typography.headlineSm,
    fontFamily: fonts.semibold,
    color: colors.white,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.bodyMd,
    color: alpha(colors.white, 0.35),
    textAlign: 'center',
  },
});
