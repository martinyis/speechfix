import { useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { GlassIconPillButton, ScreenHeader } from '../components/ui';
import {
  SCENARIOS,
  DURATION_LABELS,
} from '../lib/pressureDrillScenarios';
import { DURATION_PRESETS } from '../types/pressureDrill';
import type { ScenarioSlug, DurationPreset } from '../types/pressureDrill';
import { colors, alpha, spacing, typography, fonts, layout, borderRadius } from '../theme';

export default function PressureDrillSetupScreen() {
  const insets = useSafeAreaInsets();
  const [scenario, setScenario] = useState<ScenarioSlug>(SCENARIOS[0].slug);
  const [duration, setDuration] = useState<DurationPreset>(180);

  const handleStart = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // Route is created by Phase 6 — cast until expo-router regenerates types.
    router.push({
      pathname: '/pressure-drill-session',
      params: { scenario, duration: String(duration) },
    } as never);
  };

  return (
    <View style={styles.container}>
      <ScreenHeader variant="back" title="Pressure Drill" onBack={() => router.back()} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 120 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Intro copy */}
        <View style={styles.intro}>
          <Text style={styles.eyebrow}>TIMED MONOLOGUE</Text>
          <Text style={styles.hero}>Talk. Don't stop.</Text>
          <Text style={styles.sub}>
            Pick a scenario and a duration. We'll feed you angles on screen. Pause is the skill.
          </Text>
        </View>

        {/* Scenario picker */}
        <Text style={styles.sectionLabel}>SCENARIO</Text>
        <View style={styles.scenarioList}>
          {SCENARIOS.map((s) => {
            const selected = s.slug === scenario;
            return (
              <Pressable
                key={s.slug}
                onPress={() => {
                  Haptics.selectionAsync();
                  setScenario(s.slug);
                }}
                style={[styles.scenarioRow, selected && styles.scenarioRowSelected]}
              >
                <View style={styles.scenarioTextBlock}>
                  <Text style={[styles.scenarioLabel, selected && styles.scenarioLabelSelected]}>
                    {s.label}
                  </Text>
                  <Text style={styles.scenarioSubtitle}>{s.subtitle}</Text>
                </View>
                {selected && (
                  <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                )}
              </Pressable>
            );
          })}
        </View>

        {/* Duration picker */}
        <Text style={[styles.sectionLabel, { marginTop: spacing.xxl }]}>DURATION</Text>
        <View style={styles.durationRow}>
          {DURATION_PRESETS.map((d) => {
            const selected = d === duration;
            return (
              <Pressable
                key={d}
                onPress={() => {
                  Haptics.selectionAsync();
                  setDuration(d);
                }}
                style={[styles.durationPill, selected && styles.durationPillSelected]}
              >
                <Text style={[styles.durationText, selected && styles.durationTextSelected]}>
                  {DURATION_LABELS[d]}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Mechanic explainer */}
        <View style={styles.explainer}>
          <Text style={styles.explainerText}>
            Obvious fillers (um, uh, er) flash amber with a gentle buzz. Pauses are fine — they're
            the skill. Swap prompts anytime if you're stuck.
          </Text>
        </View>
      </ScrollView>

      {/* Start button — fixed to bottom */}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: layout.screenPadding },

  // Intro
  intro: { marginBottom: spacing.xxl, marginTop: spacing.md },
  eyebrow: {
    ...typography.labelMd,
    color: colors.primary,
    marginBottom: spacing.sm,
  },
  hero: {
    fontFamily: fonts.extrabold,
    fontSize: 36,
    color: colors.onSurface,
    letterSpacing: -1.2,
    marginBottom: spacing.sm,
  },
  sub: {
    ...typography.bodyMd,
    color: alpha(colors.white, 0.55),
    lineHeight: 21,
  },

  sectionLabel: {
    ...typography.labelMd,
    color: colors.onSurfaceVariant,
    marginBottom: spacing.md,
  },

  // Scenario picker — flat rows with borderBottom
  scenarioList: {},
  scenarioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: alpha(colors.white, 0.07),
  },
  scenarioRowSelected: {},
  scenarioTextBlock: { flex: 1, paddingRight: spacing.md },
  scenarioLabel: {
    ...typography.bodyLg,
    color: colors.onSurface,
    marginBottom: 2,
  },
  scenarioLabelSelected: {
    color: colors.primary,
  },
  scenarioSubtitle: {
    ...typography.bodySm,
    color: alpha(colors.white, 0.4),
  },

  // Duration picker — 4 pills
  durationRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  durationPill: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: alpha(colors.white, 0.08),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  durationPillSelected: {
    borderColor: colors.primary,
    backgroundColor: alpha(colors.primary, 0.12),
  },
  durationText: {
    ...typography.bodyMdMedium,
    color: alpha(colors.white, 0.5),
  },
  durationTextSelected: {
    color: colors.primary,
    fontFamily: fonts.bold,
  },

  // Explainer
  explainer: {
    marginTop: spacing.xxl,
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: alpha(colors.white, 0.06),
  },
  explainerText: {
    ...typography.bodySm,
    color: alpha(colors.white, 0.4),
    lineHeight: 18,
  },

  // Start bar
  startBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: alpha(colors.white, 0.06),
    backgroundColor: colors.background,
  },
});
