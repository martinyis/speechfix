import { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  LinearTransition,
  SlideInRight,
  SlideOutLeft,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { GlassIconPillButton, ScreenHeader } from '../components/ui';
import {
  SCENARIOS,
  DURATION_LABELS,
} from '../lib/pressureDrillScenarios';
import { DURATION_PRESETS } from '../types/pressureDrill';
import type { ScenarioSlug, DurationPreset } from '../types/pressureDrill';
import {
  colors,
  alpha,
  spacing,
  typography,
  fonts,
  layout,
} from '../theme';

function DurationTabBar({
  value,
  onChange,
}: {
  value: DurationPreset;
  onChange: (d: DurationPreset) => void;
}) {
  const idx = DURATION_PRESETS.indexOf(value);
  const [width, setWidth] = useState(0);
  const translate = useSharedValue(0);
  const tabWidth = width / DURATION_PRESETS.length;

  useEffect(() => {
    if (tabWidth > 0) {
      translate.value = withTiming(idx * tabWidth, {
        duration: 180,
        easing: Easing.out(Easing.cubic),
      });
    }
  }, [idx, tabWidth, translate]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translate.value }],
    width: tabWidth,
  }));

  return (
    <View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={styles.tabBar}
    >
      <View style={styles.tabRow}>
        {DURATION_PRESETS.map((d) => {
          const active = d === value;
          return (
            <Pressable
              key={d}
              hitSlop={8}
              onPress={() => {
                Haptics.selectionAsync();
                onChange(d);
              }}
              style={styles.tab}
            >
              <Text
                style={[
                  styles.tabLabel,
                  active ? styles.tabLabelActive : styles.tabLabelInactive,
                ]}
              >
                {DURATION_LABELS[d]}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.tabBaseline} />
      {width > 0 && (
        <Animated.View style={[styles.tabIndicator, indicatorStyle]} />
      )}
    </View>
  );
}

export default function PressureDrillSetupScreen() {
  const insets = useSafeAreaInsets();
  const [scenarioIdx, setScenarioIdx] = useState(0);
  const [duration, setDuration] = useState<DurationPreset>(180);
  const [browsing, setBrowsing] = useState(false);

  const scenarioObj = SCENARIOS[scenarioIdx];
  const scenario: ScenarioSlug = scenarioObj.slug;

  const handleStart = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push({
      pathname: '/pressure-drill-session',
      params: { scenario, duration: String(duration) },
    } as never);
  };

  const cycle = () => {
    Haptics.selectionAsync();
    setScenarioIdx((i) => (i + 1) % SCENARIOS.length);
  };

  const toggleBrowse = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setBrowsing((b) => !b);
  };

  const pickFromBrowse = (idx: number) => {
    Haptics.selectionAsync();
    setScenarioIdx(idx);
    setBrowsing(false);
  };

  return (
    <View style={styles.container}>
      <ScreenHeader
        variant="back"
        title="Pressure Drill"
        onBack={() => router.back()}
      />

      <View style={styles.content}>
        <View style={styles.intro}>
          <Text style={styles.eyebrow}>TIMED MONOLOGUE</Text>
          <Text style={styles.hero}>Talk. Don't stop.</Text>
        </View>

        <Text style={styles.sectionLabel}>DURATION</Text>
        <DurationTabBar value={duration} onChange={setDuration} />

        <Text style={[styles.sectionLabel, { marginTop: spacing.xxl }]}>
          SCENARIO
        </Text>

        <Animated.View
          layout={LinearTransition.springify().damping(20).stiffness(200)}
        >
          <View style={styles.peekRow}>
            <View style={styles.peekText}>
              <Animated.View
                key={scenario}
                entering={SlideInRight.duration(220)}
                exiting={SlideOutLeft.duration(180)}
              >
                <Text style={styles.scenarioLabel} numberOfLines={1}>
                  {scenarioObj.label}
                </Text>
                <Text style={styles.scenarioSubtitle} numberOfLines={1}>
                  {scenarioObj.subtitle}
                </Text>
              </Animated.View>
            </View>

            <Pressable onPress={cycle} hitSlop={12} style={styles.cycleBtn}>
              <View style={styles.cycleBloom} pointerEvents="none" />
              <Ionicons name="shuffle" size={22} color={colors.primary} />
            </Pressable>
          </View>

          <Pressable onPress={toggleBrowse} hitSlop={8} style={styles.browseLinkWrap}>
            <Text style={styles.browseLink}>
              {browsing ? 'Hide list' : 'Browse all 6'}
            </Text>
            <Text style={styles.indexHint}>
              {scenarioIdx + 1} of {SCENARIOS.length}
            </Text>
          </Pressable>

          {browsing && (
            <Animated.View
              entering={FadeIn.duration(180)}
              exiting={FadeOut.duration(100)}
              style={styles.browseList}
            >
              {SCENARIOS.map((s, i) => {
                const selected = i === scenarioIdx;
                const isLast = i === SCENARIOS.length - 1;
                return (
                  <Pressable
                    key={s.slug}
                    onPress={() => pickFromBrowse(i)}
                    style={[
                      styles.browseRow,
                      selected && styles.browseRowActive,
                      !isLast && styles.browseRowDivider,
                    ]}
                  >
                    <Text
                      style={[
                        styles.browseLabel,
                        selected && styles.browseLabelActive,
                      ]}
                    >
                      {s.label}
                    </Text>
                    <Text style={styles.scenarioSubtitle}>{s.subtitle}</Text>
                  </Pressable>
                );
              })}
            </Animated.View>
          )}
        </Animated.View>
      </View>

      <View style={[styles.startBar, { paddingBottom: insets.bottom + spacing.md }]}>
        <GlassIconPillButton
          icon="play"
          label={`Start — ${DURATION_LABELS[duration]}`}
          variant="primary"
          fullWidth
          onPress={handleStart}
        />
      </View>
    </View>
  );
}

const INDICATOR_HEIGHT = 2;
const HAIRLINE = alpha(colors.white, 0.08);
const TEXT_INACTIVE = alpha(colors.white, 0.5);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1, paddingHorizontal: layout.screenPadding },

  intro: { marginTop: spacing.md, marginBottom: spacing.xxl },
  eyebrow: {
    ...typography.labelMd,
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  hero: {
    fontFamily: fonts.extrabold,
    fontSize: 32,
    color: colors.onSurface,
    letterSpacing: -1,
  },

  sectionLabel: {
    ...typography.labelMd,
    color: colors.onSurfaceVariant,
    marginBottom: spacing.md,
  },

  tabBar: { position: 'relative' },
  tabRow: { flexDirection: 'row' },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  tabLabel: { fontFamily: fonts.semibold, fontSize: 16, letterSpacing: -0.2 },
  tabLabelInactive: { color: TEXT_INACTIVE },
  tabLabelActive: { color: colors.onSurface, fontFamily: fonts.bold },
  tabBaseline: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: HAIRLINE,
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    height: INDICATOR_HEIGHT,
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOpacity: 0.45,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },

  peekRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: HAIRLINE,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: HAIRLINE,
    overflow: 'hidden',
  },
  peekText: { flex: 1, gap: 2 },
  scenarioLabel: {
    ...typography.bodyLg,
    fontFamily: fonts.semibold,
    color: colors.onSurface,
  },
  scenarioSubtitle: {
    ...typography.bodySm,
    color: alpha(colors.white, 0.5),
  },

  cycleBtn: {
    padding: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cycleBloom: {
    position: 'absolute',
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.primary,
    opacity: 0.18,
    shadowColor: colors.primary,
    shadowOpacity: 0.8,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
  },

  browseLinkWrap: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.sm,
  },
  browseLink: {
    ...typography.bodySm,
    fontFamily: fonts.semibold,
    color: colors.primary,
  },
  indexHint: {
    ...typography.bodySm,
    color: alpha(colors.white, 0.35),
  },

  browseList: {
    marginTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: HAIRLINE,
  },
  browseRow: {
    paddingVertical: spacing.md,
    paddingLeft: spacing.md,
    borderLeftWidth: 2,
    borderLeftColor: 'transparent',
  },
  browseRowActive: {
    borderLeftColor: colors.primary,
  },
  browseRowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: alpha(colors.white, 0.06),
  },
  browseLabel: {
    ...typography.bodyMdMedium,
    fontFamily: fonts.medium,
    color: alpha(colors.white, 0.85),
    marginBottom: 2,
  },
  browseLabelActive: { color: colors.primary },

  startBar: {
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: HAIRLINE,
    backgroundColor: colors.background,
  },
});
