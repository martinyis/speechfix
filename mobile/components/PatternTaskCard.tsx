import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { colors, alpha, fonts } from '../theme';
import type { PatternGroup } from '../types/practice';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const SEVERITY_COLOR: Record<string, string> = {
  low: colors.severityPolish,
  medium: colors.severityImprovement,
  high: colors.severityError,
};

const PATTERN_TYPE_LABEL: Record<string, string> = {
  overused_word: 'Overused Word',
  repetitive_starter: 'Sentence Starter',
  crutch_phrase: 'Crutch Phrase',
  hedging: 'Hedging',
  negative_framing: 'Negative Framing',
};

interface PatternTaskCardProps {
  group: PatternGroup;
}

export function PatternTaskCard({ group }: PatternTaskCardProps) {
  const scale = useSharedValue(1);
  const severityColor = SEVERITY_COLOR[group.severity] ?? colors.severityError;
  const unpracticedCount = group.exercises.filter((e) => !e.practiced).length;
  const allPracticed = unpracticedCount === 0;

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({
      pathname: '/pattern-practice-session',
      params: { patternId: String(group.patternId) },
    });
  };

  return (
    <AnimatedPressable
      style={[styles.strip, animStyle]}
      onPress={handlePress}
      onPressIn={() => {
        scale.value = withSpring(0.98, { damping: 15, stiffness: 300 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 15, stiffness: 300 });
      }}
    >
      {/* Severity bar */}
      <View style={[styles.severityBar, { backgroundColor: severityColor }]} />

      {/* Content */}
      <View style={styles.content}>
        <Text style={styles.identifier} numberOfLines={1}>
          {group.identifier ? `"${group.identifier}"` : PATTERN_TYPE_LABEL[group.type] ?? group.type}
        </Text>
        {group.identifier ? (
          <Text style={styles.typeLabel}>
            {PATTERN_TYPE_LABEL[group.type] ?? group.type}
          </Text>
        ) : (
          <Text style={styles.typeLabel}>Reframe Exercise</Text>
        )}
      </View>

      {/* Right indicator */}
      {allPracticed ? (
        <Ionicons name="checkmark" size={14} color={alpha(colors.white, 0.25)} />
      ) : (
        <View style={[styles.badge, { backgroundColor: alpha(severityColor, 0.15) }]}>
          <Text style={[styles.badgeText, { color: severityColor }]}>
            {unpracticedCount}
          </Text>
        </View>
      )}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  severityBar: {
    width: 3,
    height: 20,
    borderRadius: 1.5,
    marginRight: 12,
  },
  content: {
    flex: 1,
    gap: 2,
  },
  identifier: {
    fontSize: 15,
    fontFamily: fonts.semibold,
    color: alpha(colors.white, 0.85),
  },
  typeLabel: {
    fontSize: 12,
    fontFamily: fonts.medium,
    color: alpha(colors.white, 0.3),
  },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    marginLeft: 12,
  },
  badgeText: {
    fontSize: 11,
    fontFamily: fonts.bold,
  },
});
