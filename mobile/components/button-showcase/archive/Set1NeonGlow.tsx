import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, alpha, borderRadius, typography } from '@/theme';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type GlowVariant = 'primary' | 'secondary' | 'success' | 'danger' | 'ghost';
type ButtonSize = 'default' | 'small';

interface NeonGlowButtonProps {
  label: string;
  variant?: GlowVariant;
  size?: ButtonSize;
  icon?: keyof typeof Ionicons.glyphMap;
  loading?: boolean;
  disabled?: boolean;
  onPress?: () => void;
}

// ---------------------------------------------------------------------------
// Variant color map
// ---------------------------------------------------------------------------

const variantColors: Record<Exclude<GlowVariant, 'ghost'>, string> = {
  primary: colors.primary,       // #cc97ff purple
  secondary: colors.secondary,   // #699cff blue
  success: '#34d399',            // green (matches severityPolish)
  danger: colors.error,          // #ff6e84 red
};

// ---------------------------------------------------------------------------
// NeonGlowButton
// ---------------------------------------------------------------------------

function NeonGlowButton({
  label,
  variant = 'primary',
  size = 'default',
  icon,
  loading = false,
  disabled = false,
  onPress,
}: NeonGlowButtonProps) {
  const isGhost = variant === 'ghost';
  const glowColor = isGhost ? colors.primary : variantColors[variant];

  const heightStyle = size === 'small' ? styles.buttonSmall : styles.buttonDefault;
  const textStyle = size === 'small' ? styles.textSmall : styles.textDefault;
  const iconSize = size === 'small' ? 14 : 18;

  // Build dynamic styles for the outer glow wrapper
  const glowShadow: ViewStyle = isGhost
    ? {}
    : {
        shadowColor: glowColor,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: disabled ? 0.08 : 0.45,
        shadowRadius: disabled ? 4 : 16,
        elevation: disabled ? 2 : 8,
      };

  const borderStyle: ViewStyle = isGhost
    ? { borderWidth: 0, backgroundColor: 'transparent' }
    : {
        borderWidth: 1.5,
        borderColor: disabled ? alpha(glowColor, 0.25) : glowColor,
        backgroundColor: disabled
          ? alpha(glowColor, 0.03)
          : alpha(glowColor, 0.08),
      };

  const labelColor: TextStyle = {
    color: disabled
      ? alpha(isGhost ? colors.primary : glowColor, 0.35)
      : glowColor,
  };

  return (
    <View style={[styles.glowWrapper, glowShadow]}>
      <Pressable
        onPress={onPress}
        disabled={disabled || loading}
        style={({ pressed }) => [
          styles.button,
          heightStyle,
          borderStyle,
          pressed && !disabled && { opacity: 0.8 },
        ]}
      >
        {loading ? (
          <ActivityIndicator
            size="small"
            color={disabled ? alpha(glowColor, 0.35) : glowColor}
          />
        ) : (
          <View style={styles.innerRow}>
            {icon && (
              <Ionicons
                name={icon}
                size={iconSize}
                color={
                  disabled
                    ? alpha(isGhost ? colors.primary : glowColor, 0.35)
                    : glowColor
                }
                style={{ marginRight: spacing.sm }}
              />
            )}
            <Text style={[textStyle, labelColor]}>{label}</Text>
          </View>
        )}
      </Pressable>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Showcase rows
// ---------------------------------------------------------------------------

interface RowConfig {
  title: string;
  variant: GlowVariant;
}

const rows: RowConfig[] = [
  { title: 'Primary (Purple)', variant: 'primary' },
  { title: 'Secondary (Blue)', variant: 'secondary' },
  { title: 'Success (Green)', variant: 'success' },
  { title: 'Danger (Red)', variant: 'danger' },
  { title: 'Ghost', variant: 'ghost' },
];

function VariantRow({ title, variant }: RowConfig) {
  return (
    <View style={styles.rowContainer}>
      <Text style={styles.rowLabel}>{title}</Text>
      <View style={styles.row}>
        <NeonGlowButton label="Action" variant={variant} />
        <NeonGlowButton label="Icon" variant={variant} icon="sparkles" />
        <NeonGlowButton label="Sm" variant={variant} size="small" />
        <NeonGlowButton label="Off" variant={variant} disabled />
        <NeonGlowButton label="Wait" variant={variant} loading />
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Default export — full showcase
// ---------------------------------------------------------------------------

export default function Set1NeonGlow() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Neon Glow</Text>
      <Text style={styles.subtitle}>
        Vivid neon borders with outer glow shadows on a dark transparent fill.
      </Text>

      {rows.map((row) => (
        <VariantRow key={row.variant} {...row} />
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxxl,
    paddingBottom: spacing.xxxl,
  },
  title: {
    ...typography.headlineSm,
    color: colors.white,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.bodySm,
    color: colors.onSurfaceVariant,
    marginBottom: spacing.xxl,
  },

  // --- Row ---
  rowContainer: {
    marginBottom: spacing.xl,
  },
  rowLabel: {
    ...typography.labelMd,
    color: colors.onSurfaceVariant,
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    alignItems: 'center',
  },

  // --- Button ---
  glowWrapper: {
    borderRadius: borderRadius.lg,
  },
  button: {
    borderRadius: borderRadius.lg, // pill shape
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    overflow: 'hidden',
  },
  buttonDefault: {
    height: 48,
    minWidth: 72,
  },
  buttonSmall: {
    height: 36,
    minWidth: 56,
    paddingHorizontal: spacing.lg,
  },
  innerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // --- Text ---
  textDefault: {
    ...typography.bodyMdMedium,
    fontWeight: '600',
  },
  textSmall: {
    ...typography.bodySmMedium,
    fontWeight: '600',
  },
});
