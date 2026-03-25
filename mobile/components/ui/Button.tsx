import React from 'react';
import {
  Pressable,
  Text,
  ActivityIndicator,
  StyleSheet,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, alpha } from '@/theme';

type ButtonProps = {
  variant?: 'primary' | 'secondary' | 'tinted' | 'danger';
  size?: 'sm' | 'md';
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  icon?: string;
  fullWidth?: boolean;
};

const variantStyles: Record<
  NonNullable<ButtonProps['variant']>,
  { container: ViewStyle; text: TextStyle; spinnerColor: string }
> = {
  primary: {
    container: {
      backgroundColor: colors.primary,
    },
    text: { color: colors.black },
    spinnerColor: colors.black,
  },
  secondary: {
    container: {
      backgroundColor: alpha(colors.white, 0.05),
      borderWidth: 1,
      borderColor: alpha(colors.white, 0.08),
    },
    text: { color: alpha(colors.white, 0.5) },
    spinnerColor: alpha(colors.white, 0.5),
  },
  tinted: {
    container: {
      backgroundColor: alpha(colors.primary, 0.15),
      borderWidth: 1,
      borderColor: alpha(colors.primary, 0.25),
    },
    text: { color: colors.primary },
    spinnerColor: colors.primary,
  },
  danger: {
    container: {
      backgroundColor: alpha(colors.error, 0.06),
      borderWidth: 1,
      borderColor: alpha(colors.error, 0.2),
    },
    text: { color: colors.error },
    spinnerColor: colors.error,
  },
};

const sizeStyles: Record<
  NonNullable<ButtonProps['size']>,
  { container: ViewStyle; text: TextStyle; iconSize: number }
> = {
  md: {
    container: {
      paddingVertical: 12,
      paddingHorizontal: 24,
      borderRadius: 32,
    },
    text: { fontSize: 15, fontWeight: '700' },
    iconSize: 18,
  },
  sm: {
    container: {
      paddingVertical: 8,
      paddingHorizontal: 16,
      borderRadius: 12,
    },
    text: { fontSize: 13, fontWeight: '700' },
    iconSize: 16,
  },
};

export function Button({
  variant = 'primary',
  size = 'md',
  label,
  onPress,
  loading = false,
  disabled = false,
  icon,
  fullWidth = false,
}: ButtonProps) {
  const v = variantStyles[variant];
  const s = sizeStyles[size];
  const inactive = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      style={[
        styles.base,
        v.container,
        s.container,
        fullWidth && styles.fullWidth,
        inactive && styles.inactive,
      ]}
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive }}
    >
      {loading ? (
        <ActivityIndicator size="small" color={v.spinnerColor} />
      ) : (
        <>
          {icon != null && (
            <Ionicons
              name={icon as any}
              size={s.iconSize}
              color={v.text.color as string}
              style={{ marginRight: spacing.xs }}
            />
          )}
          <Text style={[styles.label, v.text, s.text]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  fullWidth: {
    alignSelf: 'stretch',
  },
  inactive: {
    opacity: 0.6,
  },
  label: {
    textAlign: 'center',
  },
});
