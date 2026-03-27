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
import { colors, spacing, alpha, typography } from '@/theme';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type EdgeVariant = 'primary' | 'secondary' | 'accent' | 'danger';
type ButtonSize = 'default' | 'small';

interface SharpEdgeButtonProps {
  label: string;
  variant?: EdgeVariant;
  size?: ButtonSize;
  icon?: keyof typeof Ionicons.glyphMap;
  loading?: boolean;
  disabled?: boolean;
  onPress?: () => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SHARP_RADIUS = 3;
const BORDER_WIDTH = 2;
const LETTER_SPACING = 1.5;

// ---------------------------------------------------------------------------
// Variant style builders
// ---------------------------------------------------------------------------

function getVariantStyles(
  variant: EdgeVariant,
  disabled: boolean,
): { container: ViewStyle; text: TextStyle; indicatorColor: string; iconColor: string } {
  const disabledOpacity = 0.3;

  switch (variant) {
    case 'primary': {
      return {
        container: {
          backgroundColor: disabled
            ? alpha(colors.primary, 0.35)
            : colors.primary,
          borderWidth: BORDER_WIDTH,
          borderColor: disabled
            ? alpha(colors.primary, 0.35)
            : colors.primary,
        },
        text: {
          color: disabled ? alpha(colors.black, disabledOpacity) : colors.black,
        },
        indicatorColor: disabled
          ? alpha(colors.black, disabledOpacity)
          : colors.black,
        iconColor: disabled
          ? alpha(colors.black, disabledOpacity)
          : colors.black,
      };
    }

    case 'secondary': {
      return {
        container: {
          backgroundColor: 'transparent',
          borderWidth: BORDER_WIDTH,
          borderColor: disabled
            ? alpha(colors.white, disabledOpacity)
            : colors.white,
        },
        text: {
          color: disabled
            ? alpha(colors.white, disabledOpacity)
            : colors.white,
        },
        indicatorColor: disabled
          ? alpha(colors.white, disabledOpacity)
          : colors.white,
        iconColor: disabled
          ? alpha(colors.white, disabledOpacity)
          : colors.white,
      };
    }

    case 'accent': {
      return {
        container: {
          backgroundColor: 'transparent',
          borderWidth: BORDER_WIDTH,
          borderColor: disabled
            ? alpha(colors.primary, disabledOpacity)
            : colors.primary,
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
            ? alpha(colors.error, 0.04)
            : alpha(colors.error, 0.1),
          borderWidth: BORDER_WIDTH,
          borderColor: disabled
            ? alpha(colors.error, disabledOpacity)
            : colors.error,
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
// SharpEdgeButton
// ---------------------------------------------------------------------------

function SharpEdgeButton({
  label,
  variant = 'primary',
  size = 'default',
  icon,
  loading = false,
  disabled = false,
  onPress,
}: SharpEdgeButtonProps) {
  const vs = getVariantStyles(variant, disabled);

  const heightStyle = size === 'small' ? styles.buttonSmall : styles.buttonDefault;
  const textStyle = size === 'small' ? styles.textSmall : styles.textDefault;
  const iconSize = size === 'small' ? 14 : 17;

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
  variant: EdgeVariant;
  icon: keyof typeof Ionicons.glyphMap;
}

const rows: RowConfig[] = [
  { title: 'Primary', variant: 'primary', icon: 'flash' },
  { title: 'Secondary', variant: 'secondary', icon: 'arrow-forward' },
  { title: 'Accent', variant: 'accent', icon: 'diamond-outline' },
  { title: 'Danger', variant: 'danger', icon: 'alert-circle-outline' },
];

function VariantRow({ title, variant, icon }: RowConfig) {
  return (
    <View style={styles.rowContainer}>
      <Text style={styles.rowLabel}>{title}</Text>
      <View style={styles.row}>
        <SharpEdgeButton label="Action" variant={variant} />
        <SharpEdgeButton label="Icon" variant={variant} icon={icon} />
        <SharpEdgeButton label="Sm" variant={variant} size="small" />
        <SharpEdgeButton label="Off" variant={variant} disabled />
        <SharpEdgeButton label="Wait" variant={variant} loading />
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Default export -- full showcase
// ---------------------------------------------------------------------------

export default function Set6SharpEdge() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sharp Edge</Text>
      <Text style={styles.subtitle}>
        Brutalist editorial buttons. Angular corners, bold borders, uppercase
        type with wide letter spacing. Confident and decisive.
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
    borderRadius: SHARP_RADIUS,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    overflow: 'hidden',
  },
  buttonDefault: {
    height: 48,
    minWidth: 76,
  },
  buttonSmall: {
    height: 36,
    minWidth: 56,
    paddingHorizontal: spacing.lg,
  },
  pressed: {
    opacity: 0.8,
  },
  innerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // --- Text ---
  textDefault: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: LETTER_SPACING,
    textTransform: 'uppercase',
  },
  textSmall: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: LETTER_SPACING,
    textTransform: 'uppercase',
  },
});
