import { useState } from 'react';
import { View, Pressable, Text, StyleSheet } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { colors, alpha, fonts, spacing, layout } from '../../theme';
import type { SessionDetail } from '../../types/session';
import { DeliverySignalStrip } from './DeliverySignalStrip';
import { SessionTranscript } from './SessionTranscript';
import { SessionPatterns } from './SessionPatterns';
import { SessionStrengthsFocus } from './SessionStrengthsFocus';

interface Props {
  session: SessionDetail;
  initialExpanded?: boolean;
  animate?: boolean;
}

export function SessionFullReport({ session, initialExpanded = false, animate }: Props) {
  const [expanded, setExpanded] = useState(initialExpanded);
  const rotation = useSharedValue(initialExpanded ? 180 : 0);

  const caretStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const toggle = () => {
    Haptics.selectionAsync();
    const next = !expanded;
    setExpanded(next);
    rotation.value = withTiming(next ? 180 : 0, {
      duration: 300,
      easing: Easing.out(Easing.cubic),
    });
  };

  return (
    <Animated.View style={styles.container} layout={LinearTransition.duration(280)}>
      <Pressable onPress={toggle} style={styles.header} hitSlop={8}>
        <Text style={styles.headerText}>
          {expanded ? 'Hide full report' : 'See full report'}
        </Text>
        <Animated.View style={caretStyle}>
          <Ionicons
            name="chevron-down"
            size={18}
            color={alpha(colors.white, 0.5)}
          />
        </Animated.View>
      </Pressable>

      {expanded && (
        <Animated.View
          entering={FadeIn.duration(260)}
          exiting={FadeOut.duration(180)}
          style={styles.body}
        >
          {session.speechTimeline && (
            <DeliverySignalStrip timeline={session.speechTimeline} animate={animate} />
          )}
          <SessionPatterns insights={session.sessionInsights} />
          <SessionStrengthsFocus insights={session.sessionInsights} />
          <SessionTranscript
            sentences={session.sentences}
            corrections={session.corrections}
            fillerPositions={session.fillerPositions}
          />
        </Animated.View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: layout.screenPadding,
    marginTop: spacing.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: alpha(colors.white, 0.06),
  },
  headerText: {
    fontSize: 13,
    fontFamily: fonts.medium,
    color: alpha(colors.white, 0.55),
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  body: {
    paddingTop: spacing.md,
    gap: spacing.xl,
  },
});
