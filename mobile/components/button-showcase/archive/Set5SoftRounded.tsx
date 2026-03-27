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
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, alpha, borderRadius, shadows, typography } from '@/theme';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SoftVariant = 'primary' | 'secondary' | 'tinted' | 'danger';
type ButtonSize = 'default' | 'small';

interface SoftRoundedButtonProps {
  label: string;
  variant?: SoftVariant;
  size?: ButtonSize;
  icon?: keyof typeof Ionicons.glyphMap;
  loading?: boolean;
  disabled?: boolean;
  onPress?: () => void;
}

// ---------------------------------------------------------------------------
// Variant style builders
// ---------------------------------------------------------------------------

function getVariantStyles(
  variant: SoftVariant,
  disabled: boolean,
): { container: ViewStyle; text: TextStyle; indicatorColor: string; iconColor: string } {
  const disabledOpacity = 0.4;

  switch (variant) {
    case 'primary': {
      const bg = disabled
        ? alpha(colors.primary, 0.35)
        : alpha(colors.primary, 0.9);
      return {
        container: {
          backgroundColor: bg,
          ...(!disabled && {
            shadowColor: colors.primary,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.2,
            shadowRadius: 12,
            elevation: 4,
          }),
        },
        text: {
          color: disabled ? alpha(colors.black, 0.35) : colors.black,
        },
        indicatorColor: disabled ? alpha(colors.black, 0.35) : colors.black,
        iconColor: disabled ? alpha(colors.black, 0.35) : colors.black,
      };
    }

    case 'secondary': {
      return {
        container: {
          backgroundColor: disabled
            ? alpha(colors.surfaceBright, 0.5)
            : colors.surfaceBright,
          borderWidth: 1,
          borderColor: disabled
            ? alpha(colors.white, 0.04)
            : alpha(colors.white, 0.08),
          ...shadows.sm,
          ...(disabled && { shadowOpacity: 0.1 }),
        },
        text: {
          color: disabled
            ? alpha(colors.onSurface, disabledOpacity)
            : colors.onSurface,
        },
        indicatorColor: disabled
          ? alpha(colors.onSurface, disabledOpacity)
          : colors.onSurface,
        iconColor: disabled
          ? alpha(colors.onSurface, disabledOpacity)
          : colors.onSurface,
      };
    }

    case 'tinted': {
      return {
        container: {
          backgroundColor: disabled
            ? alpha(colors.primary, 0.05)
            : alpha(colors.primary, 0.12),
          ...(!disabled && {
            shadowColor: colors.primary,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.08,
            shadowRadius: 8,
            elevation: 2,
          }),
        },
        text: {
          color: disabled
            ? alpha(colors.primary, disabledOpacity)
            : colors.primary,
        },
        indicatorColor: disabled
          ? alpha(colors.primary, disabledOpacity)
          : colors.primary,
        iconColor: disabled
          ? alpha(colors.primary, disabledOpacity)
          : colors.primary,
      };
    }

    case 'danger': {
      return {
        container: {
          backgroundColor: disabled
            ? alpha(colors.error, 0.05)
            : alpha(colors.error, 0.12),
          ...(!disabled && {
            shadowColor: colors.error,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 8,
            elevation: 2,
          }),
        },
        text: {
          color: disabled
            ? alpha(colors.error, disabledOpacity)
            : colors.error,
        },
        indicatorColor: disabled
          ? alpha(colors.error, disabledOpacity)
          : colors.error,
        iconColor: disabled
          ? alpha(colors.error, disabledOpacity)
          : colors.error,
      };
    }
  }
}

// ---------------------------------------------------------------------------
// SoftRoundedButton
// ---------------------------------------------------------------------------

function SoftRoundedButton({
  label,
  variant = 'primary',
  size = 'default',
  icon,
  loading = false,
  disabled = false,
  onPress,
}: SoftRoundedButtonProps) {
  const vs = getVariantStyles(variant, disabled);

  const heightStyle = size === 'small' ? styles.buttonSmall : styles.buttonDefault;
  const textStyle = size === 'small' ? styles.textSmall : styles.textDefault;
  const iconSize = size === 'small' ? 15 : 18;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        heightStyle,
        vs.container,
        pressed && !disabled && styles.pressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={vs.indicatorColor} />
      ) : (
        <View style={styles.innerRow}>
          {icon && (
            <Ionicons
              name={icon}
              size={iconSize}
              color={vs.iconColor}
              style={{ marginRight: spacing.sm }}
            />
          )}
          <Text style={[textStyle, vs.text]}>{label}</Text>
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
  variant: SoftVariant;
  icon: keyof typeof Ionicons.glyphMap;
}

const rows: RowConfig[] = [
  { title: 'Primary', variant: 'primary', icon: 'checkmark-circle' },
  { title: 'Secondary', variant: 'secondary', icon: 'settings-outline' },
  { title: 'Tinted', variant: 'tinted', icon: 'sparkles' },
  { title: 'Danger', variant: 'danger', icon: 'trash-outline' },
];

function VariantRow({ title, variant, icon }: RowConfig) {
  return (
    <View style={styles.rowContainer}>
      <Text style={styles.rowLabel}>{title}</Text>
      <View style={styles.row}>
        <SoftRoundedButton label="Action" variant={variant} />
        <SoftRoundedButton label="Icon" variant={variant} icon={icon} />
        <SoftRoundedButton label="Sm" variant={variant} size="small" />
        <SoftRoundedButton label="Off" variant={variant} disabled />
        <SoftRoundedButton label="Wait" variant={variant} loading />
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Default export -- full showcase
// ---------------------------------------------------------------------------

export default function Set5SoftRounded() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Soft Rounded</Text>
      <Text style={styles.subtitle}>
        Pillowy buttons with generous padding, large radius, and soft shadows.
        Comfortable, spacious, and inviting.
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
  button: {
    borderRadius: borderRadius.xl, // 48 — the key "soft pillow" radius
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xxl,
    overflow: 'hidden',
  },
  buttonDefault: {
    height: 52,
    minWidth: 80,
    paddingVertical: spacing.lg,
  },
  buttonSmall: {
    height: 40,
    minWidth: 60,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.97 }],
  },
  innerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // --- Text ---
  textDefault: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0,
  },
  textSmall: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0,
  },
});
