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
  alpha,
  borderRadius,
  shadows,
  typography,
  glass,
} from '@/theme';

// ---------------------------------------------------------------------------
// Variant definitions
// ---------------------------------------------------------------------------

type Variant = 'primary' | 'secondary' | 'accent' | 'danger';

const variantStyles: Record<
  Variant,
  {
    bg: string;
    border: string;
    text: string;
    indicator: string;
    innerGlow: string;
  }
> = {
  primary: {
    bg: alpha(colors.primary, 0.14),
    border: alpha(colors.primary, 0.28),
    text: colors.primary,
    indicator: colors.primary,
    innerGlow: alpha(colors.primary, 0.06),
  },
  secondary: {
    bg: alpha(colors.white, 0.08),
    border: alpha(colors.white, 0.16),
    text: colors.white,
    indicator: colors.white,
    innerGlow: alpha(colors.white, 0.04),
  },
  accent: {
    bg: glass.card.backgroundColor,
    border: glass.card.borderColor,
    text: colors.onSurface,
    indicator: colors.onSurface,
    innerGlow: alpha(colors.white, 0.03),
  },
  danger: {
    bg: alpha(colors.error, 0.12),
    border: alpha(colors.error, 0.24),
    text: colors.error,
    indicator: colors.error,
    innerGlow: alpha(colors.error, 0.05),
  },
};

// ---------------------------------------------------------------------------
// GlassPillButton
// ---------------------------------------------------------------------------

interface GlassPillButtonProps {
  label: string;
  variant?: Variant;
  icon?: keyof typeof Ionicons.glyphMap;
  small?: boolean;
  disabled?: boolean;
  loading?: boolean;
}

function GlassPillButton({
  label,
  variant = 'primary',
  icon,
  small = false,
  disabled = false,
  loading = false,
}: GlassPillButtonProps) {
  const v = variantStyles[variant];

  const paddingVertical = small ? spacing.sm : spacing.md + 2;
  const paddingHorizontal = small ? spacing.lg : spacing.xl;
  const fontSize = small ? 13 : 15;
  const iconSize = small ? 15 : 18;

  return (
    <Pressable
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.pill,
        {
          backgroundColor: v.bg,
          borderColor: v.border,
          paddingVertical,
          paddingHorizontal,
          opacity: disabled ? 0.35 : pressed ? 0.8 : 1,
        },
      ]}
    >
      {/* Inner glow layer for glassy depth */}
      <View
        style={[
          StyleSheet.absoluteFill,
          {
            borderRadius: borderRadius.full,
            backgroundColor: v.innerGlow,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: alpha(colors.white, 0.12),
          },
        ]}
        pointerEvents="none"
      />

      {loading ? (
        <ActivityIndicator size="small" color={v.indicator} />
      ) : (
        <View style={styles.pillContent}>
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
              styles.pillLabel,
              {
                color: v.text,
                fontSize,
                lineHeight: fontSize * 1.3,
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
        <GlassPillButton label={title} variant={variant} />
        <GlassPillButton label={title} variant={variant} icon={icon} />
        <GlassPillButton label={title} variant={variant} small />
        <GlassPillButton label={title} variant={variant} disabled />
        <GlassPillButton label={title} variant={variant} loading />
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Set3GlassPill (default export)
// ---------------------------------------------------------------------------

export default function Set3GlassPill() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Set 3 — Glass Pill</Text>
      <Text style={styles.subtitle}>
        Frosted glass buttons with tinted transparency and pill shape
      </Text>

      <VariantRow title="Primary" variant="primary" icon="sparkles" />
      <VariantRow title="Secondary" variant="secondary" icon="arrow-forward" />
      <VariantRow title="Accent" variant="accent" icon="diamond-outline" />
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

  // -- Pill button -----------------------------------------------------------
  pill: {
    borderRadius: borderRadius.full,
    borderWidth: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
    ...shadows.sm,
  },
  pillContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pillLabel: {
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
