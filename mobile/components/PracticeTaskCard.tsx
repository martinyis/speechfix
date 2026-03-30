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
import type { PracticeTask } from '../types/practice';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const SEVERITY_COLOR: Record<string, string> = {
  error: colors.severityError,
  improvement: colors.severityImprovement,
  polish: colors.severityPolish,
};

interface PracticeTaskCardProps {
  task: PracticeTask;
  dimmed?: boolean;
  fromList?: boolean;
}

export function PracticeTaskCard({ task, dimmed = false, fromList = true }: PracticeTaskCardProps) {
  const scale = useSharedValue(1);
  const severityColor = SEVERITY_COLOR[task.severity] ?? colors.severityError;

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({
      pathname: '/practice-session',
      params: {
        correctionId: String(task.correctionId),
        mode: 'say_it_right',
        fromList: fromList ? 'true' : undefined,
      },
    });
  };

  return (
    <AnimatedPressable
      style={[styles.strip, dimmed && styles.stripDimmed, animStyle]}
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

      {/* Corrected text */}
      <Text style={styles.correctedText} numberOfLines={2}>
        {task.correctedText}
      </Text>

      {/* Right indicator */}
      {task.practiced && task.practiceCount > 0 ? (
        <View style={styles.practicedIndicator}>
          <Ionicons name="checkmark" size={14} color={alpha(colors.white, 0.25)} />
          <Text style={styles.practiceCount}>{task.practiceCount}x</Text>
        </View>
      ) : (
        <View style={[styles.severityDot, { backgroundColor: severityColor }]} />
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
  stripDimmed: {
    opacity: 0.5,
  },
  severityBar: {
    width: 3,
    height: 20,
    borderRadius: 1.5,
    marginRight: 12,
  },
  correctedText: {
    flex: 1,
    fontSize: 15,
    fontFamily: fonts.medium,
    color: alpha(colors.white, 0.85),
  },
  severityDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginLeft: 12,
  },
  practicedIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginLeft: 12,
  },
  practiceCount: {
    fontSize: 12,
    fontFamily: fonts.medium,
    color: alpha(colors.white, 0.25),
  },
});
