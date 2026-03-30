import React, { useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
  interpolateColor,
  Easing,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import {
  colors,
  spacing,
  alpha,
  borderRadius,
  shadows,
  fonts,
} from '@/theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// ---------------------------------------------------------------------------
// Variant system
// ---------------------------------------------------------------------------

type Variant = 'primary' | 'secondary' | 'success' | 'danger';

interface VariantConfig {
  pillBg: string;
  pillBgPressed: string;
  pillBorder: string;
  pillBorderPressed: string;
  innerGlow: string;
  circleBg: string;
  circleIcon: string;
  text: string;
  indicator: string;
  glowColor: string;
}

const variantConfigs: Record<Variant, VariantConfig> = {
  primary: {
    pillBg: alpha(colors.primary, 0.12),
    pillBgPressed: alpha(colors.primary, 0.18),
    pillBorder: alpha(colors.primary, 0.24),
    pillBorderPressed: alpha(colors.primary, 0.44),
    innerGlow: alpha(colors.primary, 0.06),
    circleBg: colors.primary,
    circleIcon: colors.black,
    text: colors.primary,
    indicator: colors.primary,
    glowColor: colors.primary,
  },
  secondary: {
    pillBg: alpha(colors.white, 0.06),
    pillBgPressed: alpha(colors.white, 0.12),
    pillBorder: alpha(colors.white, 0.14),
    pillBorderPressed: alpha(colors.white, 0.34),
    innerGlow: alpha(colors.white, 0.03),
    circleBg: alpha(colors.white, 0.12),
    circleIcon: colors.onSurfaceVariant,
    text: colors.onSurfaceVariant,
    indicator: colors.onSurfaceVariant,
    glowColor: colors.white,
  },
  success: {
    pillBg: alpha(colors.severityPolish, 0.10),
    pillBgPressed: alpha(colors.severityPolish, 0.16),
    pillBorder: alpha(colors.severityPolish, 0.22),
    pillBorderPressed: alpha(colors.severityPolish, 0.42),
    innerGlow: alpha(colors.severityPolish, 0.05),
    circleBg: colors.severityPolish,
    circleIcon: colors.black,
    text: colors.severityPolish,
    indicator: colors.severityPolish,
    glowColor: colors.severityPolish,
  },
  danger: {
    pillBg: alpha(colors.error, 0.10),
    pillBgPressed: alpha(colors.error, 0.20),
    pillBorder: alpha(colors.error, 0.22),
    pillBorderPressed: alpha(colors.error, 0.50),
    innerGlow: alpha(colors.error, 0.05),
    circleBg: colors.error,
    circleIcon: colors.white,
    text: colors.error,
    indicator: colors.error,
    glowColor: colors.error,
  },
};

// ---------------------------------------------------------------------------
// Glow animation config
// ---------------------------------------------------------------------------

interface GlowConfig {
  shadowOpacityRest: number;
  shadowOpacityPress: number;
  shadowRadiusRest: number;
  shadowRadiusPress: number;
  pressDuration: number;
  releaseDuration: number;
}

const standardGlow: GlowConfig = {
  shadowOpacityRest: 0,
  shadowOpacityPress: 0.35,
  shadowRadiusRest: 0,
  shadowRadiusPress: 14,
  pressDuration: 220,
  releaseDuration: 280,
};

const destructiveGlow: GlowConfig = {
  shadowOpacityRest: 0,
  shadowOpacityPress: 0.45,
  shadowRadiusRest: 0,
  shadowRadiusPress: 18,
  pressDuration: 180,
  releaseDuration: 350,
};

// ---------------------------------------------------------------------------
// GlassIconPillButton
// ---------------------------------------------------------------------------

export interface GlassIconPillButtonProps {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  variant?: Variant;
  small?: boolean;
  iconOnly?: boolean;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  active?: boolean;
  noIcon?: boolean;
  onPress?: () => void;
}

export function GlassIconPillButton({
  label,
  icon,
  variant = 'primary',
  small = false,
  iconOnly = false,
  disabled = false,
  loading = false,
  fullWidth = false,
  active,
  noIcon = false,
  onPress,
}: GlassIconPillButtonProps) {
  const resolvedVariant = active !== undefined ? (active ? 'primary' : 'secondary') : variant;
  const v = variantConfigs[resolvedVariant];
  const cfg = resolvedVariant === 'danger' ? destructiveGlow : standardGlow;

  const circleSize = small ? 26 : 32;
  const iconSz = small ? 14 : 17;
  const fontSize = small ? 13 : 15;
  const paddingV = small ? spacing.xs + 2 : spacing.sm;
  const paddingR = noIcon ? (small ? spacing.lg : spacing.xl) : (small ? spacing.lg : spacing.xl);
  const paddingL = noIcon ? (small ? spacing.lg : spacing.xl) : (small ? spacing.xs + 2 : spacing.sm);

  const showIcon = !noIcon && icon;

  const pressed = useSharedValue(0);
  const easing = Easing.out(Easing.cubic);

  const pillAnimStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      pressed.value,
      [0, 1],
      [v.pillBg, v.pillBgPressed],
    ),
    borderColor: interpolateColor(
      pressed.value,
      [0, 1],
      [v.pillBorder, v.pillBorderPressed],
    ),
  }));

  const bloomStyle = useAnimatedStyle(() => ({
    shadowOpacity: interpolate(pressed.value, [0, 1], [cfg.shadowOpacityRest, cfg.shadowOpacityPress]),
    shadowRadius: interpolate(pressed.value, [0, 1], [cfg.shadowRadiusRest, cfg.shadowRadiusPress]),
    shadowColor: v.glowColor,
    shadowOffset: { width: 0, height: 0 },
    elevation: interpolate(pressed.value, [0, 1], [2, 8]),
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pressed.value, [0, 1], [0.4, 1.0]),
  }));

  const handlePressIn = useCallback(() => {
    pressed.value = withTiming(1, {
      duration: cfg.pressDuration,
      easing,
    });
    if (resolvedVariant === 'danger') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, [resolvedVariant, cfg.pressDuration]);

  const handlePressOut = useCallback(() => {
    pressed.value = withTiming(0, {
      duration: cfg.releaseDuration,
      easing,
    });
  }, [cfg.releaseDuration]);

  if (iconOnly) {
    return (
      <AnimatedPressable
        disabled={disabled || loading}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={onPress}
        style={[
          styles.pill,
          {
            width: small ? 38 : 46,
            height: small ? 38 : 46,
            paddingHorizontal: 0,
            paddingVertical: 0,
            opacity: disabled ? 0.35 : 1,
          },
          pillAnimStyle,
          bloomStyle,
        ]}
      >
        <Animated.View
          style={[StyleSheet.absoluteFill, styles.innerGlow, { backgroundColor: v.innerGlow }, glowStyle]}
          pointerEvents="none"
        />
        {loading ? (
          <ActivityIndicator size="small" color={v.indicator} />
        ) : (
          <View style={[styles.iconCircle, { width: circleSize, height: circleSize, backgroundColor: v.circleBg }]}>
            {icon && <Ionicons name={icon} size={iconSz} color={v.circleIcon} />}
          </View>
        )}
      </AnimatedPressable>
    );
  }

  return (
    <AnimatedPressable
      disabled={disabled || loading}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={onPress}
      style={[
        styles.pill,
        {
          paddingVertical: paddingV,
          paddingLeft: paddingL,
          paddingRight: paddingR,
          opacity: disabled ? 0.35 : 1,
        },
        pillAnimStyle,
        bloomStyle,
        fullWidth && { alignSelf: 'stretch' as const },
      ]}
    >
      <Animated.View
        style={[StyleSheet.absoluteFill, styles.innerGlow, { backgroundColor: v.innerGlow }, glowStyle]}
        pointerEvents="none"
      />

      {loading ? (
        <ActivityIndicator size="small" color={v.indicator} />
      ) : (
        <View style={styles.content}>
          {showIcon && (
            <View style={[styles.iconCircle, { width: circleSize, height: circleSize, backgroundColor: v.circleBg }]}>
              <Ionicons name={icon} size={iconSz} color={v.circleIcon} />
            </View>
          )}
          <Text
            style={[styles.label, { color: v.text, fontSize, lineHeight: fontSize * 1.3 }]}
            numberOfLines={1}
          >
            {label}
          </Text>
        </View>
      )}
    </AnimatedPressable>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  pill: {
    borderRadius: borderRadius.full,
    borderWidth: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
    ...shadows.sm,
  },
  innerGlow: {
    borderRadius: borderRadius.full,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: alpha(colors.white, 0.12),
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconCircle: {
    borderRadius: borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  label: {
    fontFamily: fonts.semibold,
    letterSpacing: 0.2,
  },
});
