import React from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, alpha, borderRadius, typography } from '@/theme';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type OutlinedVariant = 'primary' | 'secondary' | 'accent' | 'danger';
type ButtonSize = 'default' | 'small';

interface OutlinedGradientButtonProps {
  label: string;
  variant?: OutlinedVariant;
  size?: ButtonSize;
  icon?: keyof typeof Ionicons.glyphMap;
  loading?: boolean;
  disabled?: boolean;
  onPress?: () => void;
}

// ---------------------------------------------------------------------------
// Gradient border definitions
// ---------------------------------------------------------------------------

interface GradientBorderDef {
  colors: [string, string];
  start: { x: number; y: number };
  end: { x: number; y: number };
  textColor: string;
  tintBg: string; // very subtle interior tint
}

const variantDefs: Record<OutlinedVariant, GradientBorderDef> = {
  primary: {
    colors: [colors.primary, colors.secondary],
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
    textColor: colors.primary,
    tintBg: alpha(colors.primary, 0.04),
  },
  secondary: {
    colors: [colors.outline, colors.outlineVariant],
    start: { x: 0, y: 0 },
    end: { x: 1, y: 0 },
    textColor: colors.onSurfaceVariant,
    tintBg: alpha(colors.white, 0.02),
  },
  accent: {
    colors: [colors.tertiary, colors.primary],
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
    textColor: colors.tertiary,
    tintBg: alpha(colors.tertiary, 0.04),
  },
  danger: {
    colors: [colors.error, colors.tertiary],
    start: { x: 0, y: 0 },
    end: { x: 1, y: 0 },
    textColor: colors.error,
    tintBg: alpha(colors.error, 0.04),
  },
};

// ---------------------------------------------------------------------------
// Border thickness constant
// ---------------------------------------------------------------------------

const BORDER_WIDTH = 1.5;

// ---------------------------------------------------------------------------
// OutlinedGradientButton
// ---------------------------------------------------------------------------

function OutlinedGradientButton({
  label,
  variant = 'primary',
  size = 'default',
  icon,
  loading = false,
  disabled = false,
  onPress,
}: OutlinedGradientButtonProps) {
  const def = variantDefs[variant];
  const heightStyle = size === 'small' ? styles.buttonSmall : styles.buttonDefault;
  const textStyle = size === 'small' ? styles.textSmall : styles.textDefault;
  const iconSz = size === 'small' ? 14 : 18;

  const foreground = disabled ? alpha(def.textColor, 0.3) : def.textColor;

  // Mute gradient colors when disabled
  const gradientColors: [string, string] = disabled
    ? [alpha(def.colors[0], 0.2), alpha(def.colors[1], 0.2)]
    : def.colors;

  const innerBg: ViewStyle = {
    backgroundColor: disabled ? alpha(colors.background, 0.95) : def.tintBg,
  };

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.outerWrapper,
        pressed && !disabled && { opacity: 0.8 },
      ]}
    >
      {/* Gradient acts as the visible border */}
      <LinearGradient
        colors={gradientColors}
        start={def.start}
        end={def.end}
        style={[styles.gradientBorder, heightStyle]}
      >
        {/* Inner content sits on top, revealing the gradient as a thin border */}
        <View style={[styles.innerContent, innerBg]}>
          {loading ? (
            <ActivityIndicator size="small" color={foreground} />
          ) : (
            <View style={styles.innerRow}>
              {icon && (
                <Ionicons
                  name={icon}
                  size={iconSz}
                  color={foreground}
                  style={{ marginRight: spacing.sm }}
                />
              )}
              <Text style={[textStyle, { color: foreground }]}>{label}</Text>
            </View>
          )}
        </View>
      </LinearGradient>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Showcase rows
// ---------------------------------------------------------------------------

interface RowConfig {
  title: string;
  variant: OutlinedVariant;
  icon: keyof typeof Ionicons.glyphMap;
}

const rows: RowConfig[] = [
  { title: 'Primary (Purple / Blue)', variant: 'primary', icon: 'sparkles' },
  { title: 'Secondary (Gray)', variant: 'secondary', icon: 'ellipsis-horizontal' },
  { title: 'Accent (Pink / Purple)', variant: 'accent', icon: 'heart' },
  { title: 'Danger (Red / Pink)', variant: 'danger', icon: 'trash' },
];

function VariantRow({ title, variant, icon }: RowConfig) {
  return (
    <View style={styles.rowContainer}>
      <Text style={styles.rowLabel}>{title}</Text>
      <View style={styles.row}>
        <OutlinedGradientButton label="Action" variant={variant} />
        <OutlinedGradientButton label="Icon" variant={variant} icon={icon} />
        <OutlinedGradientButton label="Sm" variant={variant} size="small" />
        <OutlinedGradientButton label="Off" variant={variant} disabled />
        <OutlinedGradientButton label="Wait" variant={variant} loading />
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Default export -- full showcase
// ---------------------------------------------------------------------------

export default function Set9OutlinedGradient() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Outlined Gradient</Text>
      <Text style={styles.subtitle}>
        Transparent buttons with gradient-colored borders and subtle interior tints.
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

const INNER_RADIUS = borderRadius.default - BORDER_WIDTH;

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
  outerWrapper: {
    borderRadius: borderRadius.default,
  },
  gradientBorder: {
    borderRadius: borderRadius.default,
    padding: BORDER_WIDTH,
    justifyContent: 'center',
    alignItems: 'center',
  },
  innerContent: {
    flex: 1,
    width: '100%',
    borderRadius: INNER_RADIUS,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  buttonDefault: {
    minWidth: 72,
    height: 48,
  },
  buttonSmall: {
    minWidth: 56,
    height: 36,
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
