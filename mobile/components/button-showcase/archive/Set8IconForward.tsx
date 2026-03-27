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
// Types
// ---------------------------------------------------------------------------

type IconVariant = 'primary' | 'secondary' | 'success' | 'danger';
type ButtonSize = 'default' | 'small';

interface IconForwardButtonProps {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  variant?: IconVariant;
  size?: ButtonSize;
  iconOnly?: boolean;
  loading?: boolean;
  disabled?: boolean;
  onPress?: () => void;
}

// ---------------------------------------------------------------------------
// Variant configuration
// ---------------------------------------------------------------------------

interface VariantConfig {
  circleBg: string;
  circleBgDisabled: string;
  iconColor: string;
  textColor: string;
  disabledTextColor: string;
}

const variantConfigs: Record<IconVariant, VariantConfig> = {
  primary: {
    circleBg: colors.primary,
    circleBgDisabled: alpha(colors.primary, 0.2),
    iconColor: colors.black,
    textColor: colors.onSurface,
    disabledTextColor: alpha(colors.onSurface, 0.3),
  },
  secondary: {
    circleBg: alpha(colors.white, 0.12),
    circleBgDisabled: alpha(colors.white, 0.06),
    iconColor: colors.onSurfaceVariant,
    textColor: colors.onSurfaceVariant,
    disabledTextColor: alpha(colors.onSurfaceVariant, 0.3),
  },
  success: {
    circleBg: colors.severityPolish,
    circleBgDisabled: alpha(colors.severityPolish, 0.2),
    iconColor: colors.black,
    textColor: colors.onSurface,
    disabledTextColor: alpha(colors.onSurface, 0.3),
  },
  danger: {
    circleBg: colors.error,
    circleBgDisabled: alpha(colors.error, 0.2),
    iconColor: colors.white,
    textColor: colors.error,
    disabledTextColor: alpha(colors.error, 0.25),
  },
};

// ---------------------------------------------------------------------------
// IconForwardButton
// ---------------------------------------------------------------------------

function IconForwardButton({
  label,
  icon,
  variant = 'primary',
  size = 'default',
  iconOnly = false,
  loading = false,
  disabled = false,
  onPress,
}: IconForwardButtonProps) {
  const config = variantConfigs[variant];

  const isSmall = size === 'small';
  const circleSize = isSmall ? 30 : 36;
  const iconSize = isSmall ? 16 : 20;
  const textColor = disabled ? config.disabledTextColor : config.textColor;
  const circleBg = disabled ? config.circleBgDisabled : config.circleBg;
  const circleIconColor = disabled
    ? alpha(config.iconColor, 0.4)
    : config.iconColor;

  // Icon-only mode: just the circle, no card background
  if (iconOnly) {
    return (
      <Pressable
        onPress={onPress}
        disabled={disabled || loading}
        style={({ pressed }) => [
          styles.iconOnlyButton,
          {
            width: circleSize,
            height: circleSize,
            borderRadius: borderRadius.full,
            backgroundColor: circleBg,
            opacity: disabled ? 0.55 : pressed ? 0.8 : 1,
          },
          pressed && !disabled && { transform: [{ scale: 0.92 }] },
        ]}
      >
        {loading ? (
          <ActivityIndicator size="small" color={circleIconColor} />
        ) : (
          <Ionicons name={icon} size={iconSize} color={circleIconColor} />
        )}
      </Pressable>
    );
  }

  // Standard mode: glass card with icon circle + text
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.cardButton,
        isSmall ? styles.cardSmall : styles.cardDefault,
        {
          opacity: disabled ? 0.55 : pressed ? 0.85 : 1,
        },
        pressed && !disabled && { transform: [{ scale: 0.98 }] },
      ]}
    >
      {/* Top edge highlight for glass depth */}
      <View
        style={[StyleSheet.absoluteFill, styles.innerHighlight]}
        pointerEvents="none"
      />

      <View style={styles.contentRow}>
        {/* Icon circle */}
        <View
          style={[
            styles.iconCircle,
            {
              width: circleSize,
              height: circleSize,
              backgroundColor: circleBg,
            },
          ]}
        >
          {loading ? (
            <ActivityIndicator size="small" color={circleIconColor} />
          ) : (
            <Ionicons
              name={icon}
              size={iconSize}
              color={circleIconColor}
            />
          )}
        </View>

        {/* Label */}
        <Text
          style={[
            isSmall ? styles.textSmall : styles.textDefault,
            { color: textColor },
          ]}
          numberOfLines={1}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Showcase rows
// ---------------------------------------------------------------------------

interface RowConfig {
  title: string;
  variant: IconVariant;
  icon: keyof typeof Ionicons.glyphMap;
}

const rows: RowConfig[] = [
  { title: 'Primary', variant: 'primary', icon: 'sparkles' },
  { title: 'Secondary', variant: 'secondary', icon: 'settings-outline' },
  { title: 'Success', variant: 'success', icon: 'checkmark-sharp' },
  { title: 'Danger', variant: 'danger', icon: 'trash-outline' },
];

function VariantRow({ title, variant, icon }: RowConfig) {
  return (
    <View style={styles.rowContainer}>
      <Text style={styles.rowLabel}>{title}</Text>
      <View style={styles.row}>
        <IconForwardButton label={title} icon={icon} variant={variant} />
        <IconForwardButton
          label="Sm"
          icon={icon}
          variant={variant}
          size="small"
        />
        <IconForwardButton
          label="Off"
          icon={icon}
          variant={variant}
          disabled
        />
        <IconForwardButton
          label="Wait"
          icon={icon}
          variant={variant}
          loading
        />
        <IconForwardButton
          label=""
          icon={icon}
          variant={variant}
          iconOnly
        />
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Default export
// ---------------------------------------------------------------------------

export default function Set8IconForward() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Set 8 — Icon-Forward</Text>
      <Text style={styles.subtitle}>
        Icon-dominant buttons with colored circle backgrounds. Includes an
        icon-only variant for toolbar-style actions.
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

  // -- Card button (with glass background) ----------------------------------
  cardButton: {
    ...glass.cardElevated,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    ...shadows.sm,
  },
  cardDefault: {
    height: 54,
    paddingHorizontal: spacing.lg,
    paddingRight: spacing.xl,
  },
  cardSmall: {
    height: 44,
    paddingHorizontal: spacing.md,
    paddingRight: spacing.lg,
  },

  // -- Inner highlight for glass depth --------------------------------------
  innerHighlight: {
    borderRadius: borderRadius.default,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: alpha(colors.white, 0.08),
  },

  // -- Content layout -------------------------------------------------------
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },

  // -- Icon circle ----------------------------------------------------------
  iconCircle: {
    borderRadius: borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // -- Icon-only button (no card bg) ----------------------------------------
  iconOnlyButton: {
    justifyContent: 'center',
    alignItems: 'center',
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
