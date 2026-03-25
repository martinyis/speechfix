import { View, Text, StyleSheet, Pressable } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useAnimatedStyle,
  interpolate,
  Extrapolation,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, alpha } from '../theme';
import { CorrectionFilterChips } from './CorrectionFilterChips';
import { formatDuration } from '../lib/formatters';
import type { CorrectionFilter } from '../types/session';

interface StickySessionBarProps {
  scrollY: SharedValue<number>;
  threshold: number;
  clarityScore: number;
  errorCount: number;
  improvementCount: number;
  polishCount: number;
  durationSeconds: number;
  onBack: () => void;
  activeFilter: CorrectionFilter;
  onFilterChange: (filter: CorrectionFilter) => void;
  totalCorrections: number;
}

const SEVERITY_DOTS: {
  key: 'error' | 'improvement' | 'polish';
  color: string;
}[] = [
  { key: 'error', color: colors.severityError },
  { key: 'improvement', color: colors.severityImprovement },
  { key: 'polish', color: colors.severityPolish },
];

export function StickySessionBar({
  scrollY,
  threshold,
  clarityScore,
  errorCount,
  improvementCount,
  polishCount,
  durationSeconds,
  onBack,
  activeFilter,
  onFilterChange,
  totalCorrections,
}: StickySessionBarProps) {
  const insets = useSafeAreaInsets();
  const countsMap = { error: errorCount, improvement: improvementCount, polish: polishCount };

  const animatedStyle = useAnimatedStyle(() => {
    const startY = Math.max(0, threshold - 30);
    const opacity = interpolate(
      scrollY.value,
      [startY, threshold],
      [0, 1],
      Extrapolation.CLAMP,
    );
    const translateY = interpolate(
      scrollY.value,
      [startY, threshold],
      [-8, 0],
      Extrapolation.CLAMP,
    );
    return {
      opacity,
      transform: [{ translateY }],
      pointerEvents: opacity < 0.1 ? 'none' : 'auto',
    } as const;
  });

  return (
    <Animated.View style={[styles.overlay, { top: 0 }, animatedStyle]}>
      {/* Unified backdrop for mini-bar + chips */}
      <View style={[styles.stickyContainer, { paddingTop: insets.top + 8 }]}>
        <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={styles.stickyOverlay} />

        {/* Mini-bar content */}
        <View style={styles.miniBarContent}>
          {/* Back button */}
          <Pressable onPress={onBack} style={styles.backButton} hitSlop={8}>
            <Ionicons name="chevron-back" size={16} color={alpha(colors.white, 0.9)} />
          </Pressable>

          {/* Score */}
          <Text style={styles.miniScore}>{clarityScore}%</Text>

          {/* Mini progress bar */}
          <View style={styles.miniProgressTrack}>
            <LinearGradient
              colors={[colors.primary, colors.secondary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.miniProgressFill, { width: `${clarityScore}%` }]}
            />
          </View>

          {/* Severity dots + counts */}
          <View style={styles.miniSeverity}>
            {SEVERITY_DOTS.map((s) => {
              const count = countsMap[s.key];
              if (count === 0) return null;
              return (
                <View key={s.key} style={styles.miniSeverityItem}>
                  <View style={[styles.miniDot, { backgroundColor: s.color }]} />
                  <Text style={[styles.miniDotCount, { color: alpha(s.color, 0.8) }]}>
                    {count}
                  </Text>
                </View>
              );
            })}
          </View>

          {/* Duration */}
          <Text style={styles.miniDuration}>{formatDuration(durationSeconds)}</Text>
        </View>

        {/* Filter chips */}
        <View style={styles.chipBar}>
          <CorrectionFilterChips
            activeFilter={activeFilter}
            onFilterChange={onFilterChange}
            counts={{
              all: totalCorrections,
              error: errorCount,
              improvement: improvementCount,
              polish: polishCount,
            }}
          />
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 20,
  },

  // Unified sticky container
  stickyContainer: {
    overflow: 'hidden',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: alpha(colors.white, 0.06),
  },
  stickyOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: alpha(colors.background, 0.85),
  },
  miniBarContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 10,
    gap: 10,
  },

  // Back button
  backButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: alpha(colors.white, 0.08),
    borderWidth: 1,
    borderColor: alpha(colors.white, 0.12),
  },

  // Score
  miniScore: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.onSurface,
    letterSpacing: -0.5,
  },

  // Progress
  miniProgressTrack: {
    width: 48,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: alpha(colors.white, 0.06),
    overflow: 'hidden',
  },
  miniProgressFill: {
    height: 3,
    borderRadius: 1.5,
  },

  // Severity
  miniSeverity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  miniSeverityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  miniDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  miniDotCount: {
    fontSize: 12,
    fontWeight: '600',
  },

  // Duration
  miniDuration: {
    fontSize: 12,
    fontWeight: '500',
    color: alpha(colors.white, 0.3),
  },

  // Chip bar
  chipBar: {
    paddingVertical: 10,
  },
});
