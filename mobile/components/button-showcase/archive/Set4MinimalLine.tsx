import React from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  colors,
  spacing,
  borderRadius,
  typography,
} from '@/theme';

// ---------------------------------------------------------------------------
// Variant definitions
// ---------------------------------------------------------------------------

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

const variantStyles: Record<
  Variant,
  {
    borderColor: string;
    borderWidth: number;
    text: string;
    indicator: string;
    underline: boolean;
  }
> = {
  primary: {
    borderColor: colors.primary,
    borderWidth: 1,
    text: colors.primary,
    indicator: colors.primary,
    underline: false,
  },
  secondary: {
    borderColor: colors.onSurfaceVariant,
    borderWidth: 1,
    text: colors.onSurfaceVariant,
    indicator: colors.onSurfaceVariant,
    underline: false,
  },
  ghost: {
    borderColor: 'transparent',
    borderWidth: 0,
    text: colors.onSurface,
    indicator: colors.onSurface,
    underline: true,
  },
  danger: {
    borderColor: colors.error,
    borderWidth: 1,
    text: colors.error,
    indicator: colors.error,
    underline: false,
  },
};

// ---------------------------------------------------------------------------
// MinimalLineButton
// ---------------------------------------------------------------------------

interface MinimalLineButtonProps {
  label: string;
  variant?: Variant;
  icon?: keyof typeof Ionicons.glyphMap;
  small?: boolean;
  disabled?: boolean;
  loading?: boolean;
}

function MinimalLineButton({
  label,
  variant = 'primary',
  icon,
  small = false,
  disabled = false,
  loading = false,
}: MinimalLineButtonProps) {
  const v = variantStyles[variant];

  const paddingVertical = small ? spacing.sm - 2 : spacing.md;
  const paddingHorizontal = small ? spacing.lg - 2 : spacing.xl;
  const fontSize = small ? 13 : 15;
  const iconSize = small ? 14 : 17;

  return (
    <Pressable
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.btn,
        {
          borderColor: v.borderColor,
          borderWidth: v.borderWidth,
          paddingVertical,
          paddingHorizontal,
          opacity: disabled ? 0.3 : pressed ? 0.8 : 1,
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={v.indicator} />
      ) : (
        <View style={styles.btnContent}>
          {icon && (
            <Ionicons
              name={icon}
              size={iconSize}
              color={v.text}
              style={{ marginRight: spacing.sm }}
            />
          )}
          <Text
            style={[
              styles.btnLabel,
              {
                color: v.text,
                fontSize,
                lineHeight: fontSize * 1.35,
                textDecorationLine: v.underline ? 'underline' : 'none',
                textDecorationColor: v.text,
              },
            ]}
          >
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Row helper
// ---------------------------------------------------------------------------

function VariantRow({
  title,
  variant,
  icon,
}: {
  title: string;
  variant: Variant;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{title}</Text>

      <View style={styles.buttonsWrap}>
        <MinimalLineButton label={title} variant={variant} />
        <MinimalLineButton label={title} variant={variant} icon={icon} />
        <MinimalLineButton label={title} variant={variant} small />
        <MinimalLineButton label={title} variant={variant} disabled />
        <MinimalLineButton label={title} variant={variant} loading />
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Set4MinimalLine (default export)
// ---------------------------------------------------------------------------

export default function Set4MinimalLine() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Set 4 — Minimal Line</Text>
      <Text style={styles.subtitle}>
        Ultra-minimalist outlined buttons with refined typography
      </Text>

      <VariantRow title="Primary" variant="primary" icon="sparkles" />
      <VariantRow title="Secondary" variant="secondary" icon="arrow-forward" />
      <VariantRow title="Ghost" variant="ghost" icon="eye-outline" />
      <VariantRow title="Danger" variant="danger" icon="trash-outline" />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.xl,
  },
  title: {
    ...typography.headlineSm,
    color: colors.onSurface,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.bodySm,
    color: colors.onSurfaceVariant,
    marginBottom: spacing.xxl,
  },

  // -- Row -------------------------------------------------------------------
  row: {
    marginBottom: spacing.xl,
  },
  rowLabel: {
    ...typography.labelMd,
    color: colors.onSurfaceVariant,
    marginBottom: spacing.md,
  },
  buttonsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    alignItems: 'center',
  },

  // -- Button ----------------------------------------------------------------
  btn: {
    borderRadius: borderRadius.sm,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
  },
  btnContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  btnLabel: {
    fontWeight: '500',
    letterSpacing: 0.5,
  },
});
