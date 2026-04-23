// Onboarding chooser — editorial split.
// Two large tappable halves separated by a gradient hairline. Each half is
// pure typography (kicker label + huge headline + supporting copy + Begin
// chevron). The top half carries a soft purple bloom to signal that voice
// is the recommended path.

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors, alpha, spacing, typography, fonts } from '../../theme';

export default function ChooseMethodScreen() {
  const insets = useSafeAreaInsets();

  const goVoice = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/(onboarding)/intro');
  };

  const goManual = () => {
    Haptics.selectionAsync();
    router.push('/(onboarding)/manual');
  };

  return (
    <View style={styles.root}>
      <Pressable
        style={[
          styles.half,
          { paddingTop: insets.top + spacing.xxxl + spacing.xl },
        ]}
        onPress={goVoice}
        android_ripple={{ color: alpha(colors.white, 0.04) }}
      >
        <LinearGradient
          colors={[
            alpha(colors.primary, 0.22),
            alpha(colors.primary, 0.05),
            'transparent',
          ]}
          locations={[0, 0.55, 1]}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.85, y: 1 }}
        />
        <Animated.View entering={FadeIn.duration(450)} style={styles.halfBody}>
          <Text style={styles.kickerActive}>Recommended</Text>
          <Text style={styles.bigTitle}>Voice</Text>
          <Text style={styles.bigSubtitle}>
            Have a quick chat with your AI coach. About 90 seconds.
          </Text>
          <View style={styles.beginRow}>
            <Text style={styles.beginText}>Begin</Text>
            <Ionicons
              name="arrow-forward"
              size={18}
              color={colors.primary}
              style={{ marginLeft: 8 }}
            />
          </View>
        </Animated.View>
      </Pressable>

      <View style={styles.divider}>
        <LinearGradient
          colors={['transparent', alpha(colors.white, 0.18), 'transparent']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
      </View>

      <Pressable
        style={[
          styles.half,
          styles.bottomHalf,
          { paddingBottom: insets.bottom + spacing.xxxl },
        ]}
        onPress={goManual}
        android_ripple={{ color: alpha(colors.white, 0.04) }}
      >
        <Animated.View
          entering={FadeIn.delay(120).duration(450)}
          style={styles.halfBody}
        >
          <Text style={styles.kicker}>No mic needed</Text>
          <Text style={styles.bigTitleMuted}>Manual</Text>
          <Text style={styles.bigSubtitle}>
            Fill out a short form. Less than a minute.
          </Text>
          <View style={styles.beginRow}>
            <Text style={[styles.beginText, styles.beginTextMuted]}>Begin</Text>
            <Ionicons
              name="arrow-forward"
              size={18}
              color={alpha(colors.white, 0.6)}
              style={{ marginLeft: 8 }}
            />
          </View>
        </Animated.View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  half: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  bottomHalf: {
    backgroundColor: colors.background,
  },
  divider: {
    height: 1,
    width: '100%',
    overflow: 'hidden',
  },
  halfBody: {
    paddingBottom: spacing.xxl,
  },

  kicker: {
    ...typography.labelSm,
    color: alpha(colors.white, 0.45),
    marginBottom: spacing.sm,
  },
  kickerActive: {
    ...typography.labelSm,
    color: colors.primary,
    marginBottom: spacing.sm,
  },
  bigTitle: {
    fontSize: 56,
    lineHeight: 60,
    fontFamily: fonts.extrabold,
    color: colors.onSurface,
    letterSpacing: -2,
  },
  bigTitleMuted: {
    fontSize: 56,
    lineHeight: 60,
    fontFamily: fonts.extrabold,
    color: alpha(colors.white, 0.92),
    letterSpacing: -2,
  },
  bigSubtitle: {
    ...typography.bodyMd,
    color: alpha(colors.white, 0.55),
    marginTop: spacing.md,
    maxWidth: 320,
    lineHeight: 22,
  },
  beginRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  beginText: {
    ...typography.labelMd,
    color: colors.primary,
  },
  beginTextMuted: {
    color: alpha(colors.white, 0.7),
  },
});
