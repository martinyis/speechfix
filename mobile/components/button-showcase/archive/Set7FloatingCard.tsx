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
  glass,
} from '@/theme';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CardVariant = 'primary' | 'secondary' | 'accent' | 'danger';
type ButtonSize = 'default' | 'small';

interface FloatingCardButtonProps {
  label: string;
  variant?: CardVariant;
  size?: ButtonSize;
  icon?: keyof typeof Ionicons.glyphMap;
  loading?: boolean;
  disabled?: boolean;
  onPress?: () => void;
}

// ---------------------------------------------------------------------------
// Variant configuration
// ---------------------------------------------------------------------------

interface VariantConfig {
  backgroundColor: string;
  borderColor: string;
  leftBorderColor: string | null;
  textColor: string;
  iconColor: string;
  disabledTextColor: string;
}

const variantConfigs: Record<CardVariant, VariantConfig> = {
  primary: {
    backgroundColor: glass.cardElevated.backgroundColor,
    borderColor: glass.cardElevated.borderColor,
    leftBorderColor: colors.primary,
    textColor: colors.onSurface,
    iconColor: colors.primary,
    disabledTextColor: alpha(colors.onSurface, 0.3),
  },
  secondary: {
    backgroundColor: glass.card.backgroundColor,
    borderColor: glass.card.borderColor,
    leftBorderColor: null,
    textColor: colors.onSurfaceVariant,
    iconColor: colors.onSurfaceVariant,
    disabledTextColor: alpha(colors.onSurfaceVariant, 0.3),
  },
  accent: {
    backgroundColor: alpha(colors.primary, 0.1),
    borderColor: alpha(colors.primary, 0.18),
    leftBorderColor: null,
    textColor: colors.primary,
    iconColor: colors.primary,
    disabledTextColor: alpha(colors.primary, 0.25),
  },
  danger: {
    backgroundColor: alpha(colors.error, 0.08),
    borderColor: alpha(colors.error, 0.16),
    leftBorderColor: null,
    textColor: colors.error,
    iconColor: colors.error,
    disabledTextColor: alpha(colors.error, 0.25),
  },
};

// ---------------------------------------------------------------------------
// FloatingCardButton
// ---------------------------------------------------------------------------

function FloatingCardButton({
  label,
  variant = 'primary',
  size = 'default',
  icon,
  loading = false,
  disabled = false,
  onPress,
}: FloatingCardButtonProps) {
  const config = variantConfigs[variant];

  const isSmall = size === 'small';
  const height = isSmall ? 44 : 54;
  const paddingH = isSmall ? spacing.xl : spacing.xxl;
  const iconSize = isSmall ? 16 : 18;
  const textColor = disabled ? config.disabledTextColor : config.textColor;
  const iconColor = disabled ? config.disabledTextColor : config.iconColor;

  // Left accent border for primary variant
  const leftBorder: ViewStyle = config.leftBorderColor
    ? {
        borderLeftWidth: 3,
        borderLeftColor: disabled
          ? alpha(config.leftBorderColor, 0.25)
          : config.leftBorderColor,
      }
    : {};

  // Shadow transitions: md normally, sm on press
  const normalShadow = disabled
    ? {}
    : shadows.md;

  const pressedShadow = shadows.sm;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.card,
        {
          height,
          paddingHorizontal: paddingH,
          backgroundColor: config.backgroundColor,
          borderColor: config.borderColor,
          opacity: disabled ? 0.55 : 1,
        },
        leftBorder,
        !disabled && (pressed ? pressedShadow : normalShadow),
        pressed && !disabled && { transform: [{ translateY: 1 }] },
      ]}
    >
      {/* Top edge highlight for glass depth */}
      <View
        style={[
          StyleSheet.absoluteFill,
          styles.innerHighlight,
        ]}
        pointerEvents="none"
      />

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
  variant: CardVariant;
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
        <FloatingCardButton label={title} variant={variant} />
        <FloatingCardButton label={title} variant={variant} icon={icon} />
        <FloatingCardButton label="Sm" variant={variant} size="small" />
        <FloatingCardButton label="Off" variant={variant} disabled />
        <FloatingCardButton label="Wait" variant={variant} loading />
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Default export
// ---------------------------------------------------------------------------

export default function Set7FloatingCard() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Set 7 — Floating Card</Text>
      <Text style={styles.subtitle}>
        Glass card buttons with floating shadows that compress on press.
        Primary features an accent left border indicator.
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
    color: colors.white,
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
    borderWidth: glass.cardElevated.borderWidth,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  innerHighlight: {
    borderRadius: borderRadius.default,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: alpha(colors.white, 0.1),
  },
  innerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // -- Text -----------------------------------------------------------------
  textDefault: {
    ...typography.bodyMdMedium,
    fontWeight: '600',
    letterSpacing: 0.15,
  },
  textSmall: {
    ...typography.bodySmMedium,
    fontWeight: '600',
    letterSpacing: 0.15,
  },
});
