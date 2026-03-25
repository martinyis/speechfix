import React from 'react';
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { colors, typography, spacing, layout, alpha } from '@/theme';

type RightAction = {
  label: string;
  onPress: () => void;
  loading?: boolean;
  color?: string;
};

type ScreenHeaderProps = {
  variant?: 'back' | 'modal' | 'large';
  title?: string;
  subtitle?: string;
  onBack?: () => void;
  backLabel?: string;
  rightAction?: RightAction | React.ReactNode;
};

export function ScreenHeader({
  variant = 'back',
  title,
  subtitle,
  onBack,
  backLabel = 'Back',
  rightAction,
}: ScreenHeaderProps) {
  const insets = useSafeAreaInsets();
  const handleBack = onBack ?? (() => router.back());

  if (variant === 'large') {
    return (
      <View
        style={[styles.largeContainer, { paddingTop: insets.top + spacing.sm }]}
      >
        {/* Very subtle glass backdrop */}
        <BlurView intensity={15} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={styles.largeOverlay} />

        <Text style={styles.largeTitle}>{title}</Text>
        {subtitle != null && (
          <Text style={styles.largeSubtitle}>{subtitle}</Text>
        )}
        <LinearGradient
          colors={[colors.primary, colors.secondary, 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.accentLine}
        />
      </View>
    );
  }

  if (variant === 'modal') {
    return (
      <View
        style={[styles.modalContainer, { paddingTop: insets.top + spacing.sm }]}
      >
        {/* Very subtle glass backdrop */}
        <BlurView intensity={15} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={styles.modalOverlay} />

        <GlassBackButton onPress={handleBack} label={backLabel} />
        <Text style={styles.modalTitle} numberOfLines={1}>
          {title}
        </Text>
        <View style={styles.rightSlot}>{renderRight(rightAction)}</View>
      </View>
    );
  }

  // variant === 'back' (default)
  return (
    <View style={[styles.backContainer, { paddingTop: insets.top + 8 }]}>
      {/* Blur background */}
      <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={styles.backOverlay} />

      {/* Content row */}
      <View style={styles.backRow}>
        <GlassBackButton onPress={handleBack} label={backLabel} />
        {title != null && (
          <Text style={styles.backTitle} numberOfLines={1}>
            {title}
          </Text>
        )}
        <View style={styles.rightSlot}>{renderRight(rightAction)}</View>
      </View>
    </View>
  );
}

// ── Glass Back Button ────────────────────────────────────────────────────

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function GlassBackButton({ onPress, label }: { onPress: () => void; label: string }) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={animatedStyle}>
      <AnimatedPressable
        onPress={onPress}
        onPressIn={() => {
          scale.value = withSpring(0.88, { damping: 15, stiffness: 400 });
        }}
        onPressOut={() => {
          scale.value = withSpring(1, { damping: 12, stiffness: 300 });
        }}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={styles.glassButton}
      >
        <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={styles.glassButtonOverlay} />
        <Ionicons name="chevron-back" size={18} color={alpha(colors.white, 0.9)} />
      </AnimatedPressable>
    </Animated.View>
  );
}

// ── Right Action Helper ─────────────────────────────────────────────────

function renderRight(
  rightAction: ScreenHeaderProps['rightAction'],
): React.ReactNode {
  if (rightAction == null) return null;

  if (!isRightAction(rightAction)) return rightAction;

  if (rightAction.loading) {
    return (
      <ActivityIndicator
        size="small"
        color={rightAction.color ?? colors.primary}
      />
    );
  }

  return (
    <Pressable onPress={rightAction.onPress} hitSlop={12}>
      <Text
        style={[
          styles.rightActionText,
          { color: rightAction.color ?? colors.primary },
        ]}
      >
        {rightAction.label}
      </Text>
    </Pressable>
  );
}

function isRightAction(v: unknown): v is RightAction {
  return v != null && typeof v === 'object' && 'label' in (v as object);
}

// ── Styles ──────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // ── Large variant ───────────────────────────────────────────────────
  largeContainer: {
    overflow: 'hidden',
    paddingHorizontal: layout.screenPadding,
    paddingBottom: spacing.md,
  },
  largeOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: alpha(colors.background, 0.85),
  },
  largeTitle: {
    ...typography.headlineMd,
    color: colors.onSurface,
    // Subtle purple backlit glow
    shadowColor: colors.primary,
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 0 },
  },
  largeSubtitle: {
    ...typography.bodyMd,
    color: alpha(colors.white, 0.5),
    marginTop: spacing.xxs,
  },
  accentLine: {
    width: 40,
    height: 2,
    borderRadius: 1,
    marginTop: spacing.sm,
  },

  // ── Back variant ────────────────────────────────────────────────────
  backContainer: {
    overflow: 'hidden',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: alpha(colors.white, 0.06),
    zIndex: 10,
  },
  backOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: alpha(colors.background, 0.5),
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  backTitle: {
    position: 'absolute',
    left: 60,
    right: 60,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '600',
    color: alpha(colors.white, 0.9),
  },

  // ── Modal variant ───────────────────────────────────────────────────
  modalContainer: {
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: layout.screenPadding,
    paddingVertical: spacing.md,
  },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: alpha(colors.background, 0.85),
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.onSurface,
    flex: 1,
    textAlign: 'center',
    marginHorizontal: spacing.sm,
  },

  // ── Glass back button ──────────────────────────────────────────────
  glassButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: alpha(colors.white, 0.12),
  },
  glassButtonOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: alpha(colors.white, 0.08),
  },

  // ── Shared ──────────────────────────────────────────────────────────
  rightSlot: {
    minWidth: 44,
    alignItems: 'flex-end',
  },
  rightActionText: {
    fontSize: 17,
    fontWeight: '600',
  },
});
