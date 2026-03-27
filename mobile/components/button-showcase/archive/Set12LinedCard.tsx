import React from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  colors,
  spacing,
  alpha,
  borderRadius,
  shadows,
  typography,
} from '@/theme';

// ---------------------------------------------------------------------------
// Set 12 — Lined Card (Set 4 × Set 7)
// Minimal line borders on floating card shapes with subtle elevation
// ---------------------------------------------------------------------------

type Variant = 'primary' | 'secondary' | 'accent' | 'danger';
type ButtonSize = 'default' | 'small';

interface LinedCardButtonProps {
  label: string;
  variant?: Variant;
  size?: ButtonSize;
  icon?: keyof typeof Ionicons.glyphMap;
  loading?: boolean;
  disabled?: boolean;
}

// ---------------------------------------------------------------------------
// Variant configuration
// ---------------------------------------------------------------------------

interface VariantConfig {
  borderColor: string;
  leftAccent: string | null;
  textColor: string;
  iconColor: string;
  disabledText: string;
}

const variantConfigs: Record<Variant, VariantConfig> = {
  primary: {
    borderColor: colors.primary,
    leftAccent: colors.primary,
    textColor: colors.primary,
    iconColor: colors.primary,
    disabledText: alpha(colors.primary, 0.25),
  },
  secondary: {
    borderColor: alpha(colors.onSurfaceVariant, 0.4),
    leftAccent: null,
    textColor: colors.onSurfaceVariant,
    iconColor: colors.onSurfaceVariant,
    disabledText: alpha(colors.onSurfaceVariant, 0.25),
  },
  accent: {
    borderColor: colors.secondary,
    leftAccent: colors.secondary,
    textColor: colors.secondary,
    iconColor: colors.secondary,
    disabledText: alpha(colors.secondary, 0.25),
  },
  danger: {
    borderColor: colors.error,
    leftAccent: null,
    textColor: colors.error,
    iconColor: colors.error,
    disabledText: alpha(colors.error, 0.25),
  },
};

// ---------------------------------------------------------------------------
// LinedCardButton
// ---------------------------------------------------------------------------

function LinedCardButton({
  label,
  variant = 'primary',
  size = 'default',
  icon,
  loading = false,
  disabled = false,
}: LinedCardButtonProps) {
  const config = variantConfigs[variant];

  const isSmall = size === 'small';
  const height = isSmall ? 42 : 52;
  const paddingH = isSmall ? spacing.xl : spacing.xxl;
  const iconSize = isSmall ? 15 : 17;
  const textColor = disabled ? config.disabledText : config.textColor;
  const iconColor = disabled ? config.disabledText : config.iconColor;
  const borderColor = disabled ? alpha(config.borderColor, 0.2) : config.borderColor;

  // Left accent stripe for primary/accent
  const leftBorder: ViewStyle = config.leftAccent
    ? {
        borderLeftWidth: 2,
        borderLeftColor: disabled ? alpha(config.leftAccent, 0.2) : config.leftAccent,
      }
    : {};

  return (
    <Pressable
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.card,
        {
          height,
          paddingHorizontal: paddingH,
          borderColor,
          opacity: disabled ? 0.55 : 1,
        },
        leftBorder,
        !disabled && (pressed ? shadows.sm : shadows.md),
        pressed && !disabled && { transform: [{ translateY: 1 }] },
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={iconColor} />
      ) : (
        <View style={styles.innerRow}>
          {icon && (
            <Ionicons
              name={icon}
              size={iconSize}
              color={iconColor}
              style={{ marginRight: spacing.sm }}
            />
          )}
          <Text
            style={[
              isSmall ? styles.textSmall : styles.textDefault,
              { color: textColor },
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
// Showcase rows
// ---------------------------------------------------------------------------

interface RowConfig {
  title: string;
  variant: Variant;
  icon: keyof typeof Ionicons.glyphMap;
}

const rows: RowConfig[] = [
  { title: 'Primary', variant: 'primary', icon: 'sparkles' },
  { title: 'Secondary', variant: 'secondary', icon: 'layers-outline' },
  { title: 'Accent', variant: 'accent', icon: 'flash-outline' },
  { title: 'Danger', variant: 'danger', icon: 'trash-outline' },
];

function VariantRow({ title, variant, icon }: RowConfig) {
  return (
    <View style={styles.rowContainer}>
      <Text style={styles.rowLabel}>{title}</Text>
      <View style={styles.row}>
        <LinedCardButton label={title} variant={variant} />
        <LinedCardButton label={title} variant={variant} icon={icon} />
        <LinedCardButton label="Sm" variant={variant} size="small" />
        <LinedCardButton label="Off" variant={variant} disabled />
        <LinedCardButton label="Wait" variant={variant} loading />
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Default export
// ---------------------------------------------------------------------------

export default function Set12LinedCard() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Set 12 — Lined Card</Text>
      <Text style={styles.subtitle}>
        Minimal line borders on floating card shapes with subtle elevation.
        Combines editorial restraint with tactile depth.
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

  // -- Row ------------------------------------------------------------------
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

  // -- Card button ----------------------------------------------------------
  card: {
    borderRadius: borderRadius.default,
    borderWidth: 1,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  innerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // -- Text -----------------------------------------------------------------
  textDefault: {
    fontSize: 15,
    fontWeight: '500',
    letterSpacing: 0.5,
    lineHeight: 15 * 1.35,
  },
  textSmall: {
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 0.5,
    lineHeight: 13 * 1.35,
  },
});
