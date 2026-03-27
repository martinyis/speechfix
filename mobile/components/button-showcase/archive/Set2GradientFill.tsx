import React from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, alpha, borderRadius, typography } from '@/theme';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type GradientVariant = 'primary' | 'secondary' | 'accent' | 'danger' | 'ghost';
type ButtonSize = 'default' | 'small';

interface GradientFillButtonProps {
  label: string;
  variant?: GradientVariant;
  size?: ButtonSize;
  icon?: keyof typeof Ionicons.glyphMap;
  loading?: boolean;
  disabled?: boolean;
  onPress?: () => void;
}

// ---------------------------------------------------------------------------
// Gradient definitions
// ---------------------------------------------------------------------------

interface GradientDef {
  colors: [string, string];
  start: { x: number; y: number };
  end: { x: number; y: number };
}

const gradients: Record<Exclude<GradientVariant, 'ghost'>, GradientDef> = {
  primary: {
    colors: [colors.primary, colors.secondary],     // purple -> blue
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
  },
  secondary: {
    colors: [colors.surfaceContainerHigh, colors.surfaceContainer], // subtle dark
    start: { x: 0, y: 0 },
    end: { x: 1, y: 0 },
  },
  accent: {
    colors: [colors.tertiary, colors.primary],       // pink -> purple
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
  },
  danger: {
    colors: [colors.error, colors.tertiary],         // red -> pink
    start: { x: 0, y: 0 },
    end: { x: 1, y: 0 },
  },
};

// Ghost text uses primary color; secondary uses onSurfaceVariant for legibility
const textColorMap: Record<GradientVariant, string> = {
  primary: colors.white,
  secondary: colors.onSurfaceVariant,
  accent: colors.white,
  danger: colors.white,
  ghost: colors.primary,
};

// ---------------------------------------------------------------------------
// GradientFillButton
// ---------------------------------------------------------------------------

function GradientFillButton({
  label,
  variant = 'primary',
  size = 'default',
  icon,
  loading = false,
  disabled = false,
  onPress,
}: GradientFillButtonProps) {
  const isGhost = variant === 'ghost';
  const heightStyle = size === 'small' ? styles.buttonSmall : styles.buttonDefault;
  const textStyle = size === 'small' ? styles.textSmall : styles.textDefault;
  const iconSize = size === 'small' ? 14 : 18;

  const foreground = disabled
    ? alpha(textColorMap[variant], 0.35)
    : textColorMap[variant];

  // Ghost variant — no gradient, plain pressable
  if (isGhost) {
    return (
      <Pressable
        onPress={onPress}
        disabled={disabled || loading}
        style={({ pressed }) => [
          styles.button,
          heightStyle,
          styles.ghostBg,
          pressed && !disabled && { opacity: 0.8 },
        ]}
      >
        {loading ? (
          <ActivityIndicator size="small" color={foreground} />
        ) : (
          <View style={styles.innerRow}>
            {icon && (
              <Ionicons
                name={icon}
                size={iconSize}
                color={foreground}
                style={{ marginRight: spacing.sm }}
              />
            )}
            <Text style={[textStyle, { color: foreground }]}>{label}</Text>
          </View>
        )}
      </Pressable>
    );
  }

  // Filled variants with gradient
  const grad = gradients[variant];

  // Disabled: mute gradient by overlaying opacity
  const gradientColors: [string, string] = disabled
    ? [alpha(grad.colors[0], 0.25), alpha(grad.colors[1], 0.25)]
    : grad.colors;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.outerWrapper,
        pressed && !disabled && { opacity: 0.8 },
      ]}
    >
      <LinearGradient
        colors={gradientColors}
        start={grad.start}
        end={grad.end}
        style={[styles.button, heightStyle]}
      >
        {loading ? (
          <ActivityIndicator size="small" color={foreground} />
        ) : (
          <View style={styles.innerRow}>
            {icon && (
              <Ionicons
                name={icon}
                size={iconSize}
                color={foreground}
                style={{ marginRight: spacing.sm }}
              />
            )}
            <Text style={[textStyle, { color: foreground }]}>{label}</Text>
          </View>
        )}
      </LinearGradient>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Showcase rows
// ---------------------------------------------------------------------------

interface RowConfig {
  title: string;
  variant: GradientVariant;
}

const rows: RowConfig[] = [
  { title: 'Primary (Purple / Blue)', variant: 'primary' },
  { title: 'Secondary (Subtle Dark)', variant: 'secondary' },
  { title: 'Accent (Pink / Purple)', variant: 'accent' },
  { title: 'Danger (Red / Pink)', variant: 'danger' },
  { title: 'Ghost', variant: 'ghost' },
];

function VariantRow({ title, variant }: RowConfig) {
  return (
    <View style={styles.rowContainer}>
      <Text style={styles.rowLabel}>{title}</Text>
      <View style={styles.row}>
        <GradientFillButton label="Action" variant={variant} />
        <GradientFillButton label="Icon" variant={variant} icon="flash" />
        <GradientFillButton label="Sm" variant={variant} size="small" />
        <GradientFillButton label="Off" variant={variant} disabled />
        <GradientFillButton label="Wait" variant={variant} loading />
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Default export — full showcase
// ---------------------------------------------------------------------------

export default function Set2GradientFill() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Gradient Fill</Text>
      <Text style={styles.subtitle}>
        Rich linear-gradient backgrounds with white text on vibrant fills.
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
  outerWrapper: {
    borderRadius: borderRadius.default,
    overflow: 'hidden',
  },
  button: {
    borderRadius: borderRadius.default, // 16px — slightly squared
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
  ghostBg: {
    backgroundColor: 'transparent',
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
