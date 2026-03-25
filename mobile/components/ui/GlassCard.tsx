import React from 'react';
import { View, Pressable, StyleSheet, type ViewStyle } from 'react-native';
import { glass, spacing, alpha, colors } from '@/theme';

type GlassCardProps = {
  elevated?: boolean;
  onPress?: () => void;
  selected?: boolean;
  dashed?: boolean;
  style?: ViewStyle;
  children: React.ReactNode;
};

export function GlassCard({
  elevated = false,
  onPress,
  selected = false,
  dashed = false,
  style,
  children,
}: GlassCardProps) {
  const base = elevated ? glass.cardElevated : glass.card;

  const composedStyle: ViewStyle[] = [
    styles.container,
    base,
    selected && styles.selected,
    dashed && styles.dashed,
    style,
  ].filter(Boolean) as ViewStyle[];

  if (onPress != null) {
    return (
      <Pressable onPress={onPress} style={composedStyle}>
        {children}
      </Pressable>
    );
  }

  return <View style={composedStyle}>{children}</View>;
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
  },
  selected: {
    borderColor: alpha(colors.primary, 0.4),
    backgroundColor: alpha(colors.primary, 0.08),
  },
  dashed: {
    borderStyle: 'dashed',
  },
});
