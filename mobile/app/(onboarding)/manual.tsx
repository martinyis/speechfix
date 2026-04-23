import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Pressable,
  Keyboard,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  FadeIn,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { GlassIconPillButton } from '../../components/ui';
import {
  colors,
  alpha,
  spacing,
  typography,
  borderRadius,
  fonts,
} from '../../theme';
import {
  useManualOnboardingSubmit,
  type EnglishLevel,
} from '../../hooks/onboarding/useManualOnboardingSubmit';

const TOTAL_STEPS = 5;

const SITUATION_CHOICES = [
  'Work meetings',
  'Presentations',
  'Job interviews',
  'Casual conversations',
  'Phone calls',
  'Networking',
  'Small talk',
] as const;

type EnglishOption = {
  level: EnglishLevel;
  title: string;
  subtitle: string;
};

const ENGLISH_OPTIONS: EnglishOption[] = [
  {
    level: 'native',
    title: 'Native speaker',
    subtitle: 'English is my first language.',
  },
  {
    level: 'advanced',
    title: 'Advanced',
    subtitle: 'Fluent, with rare mistakes.',
  },
  {
    level: 'intermediate',
    title: 'Intermediate',
    subtitle: 'Comfortable, but I make occasional mistakes.',
  },
  {
    level: 'beginner',
    title: 'Beginner',
    subtitle: 'Still learning the basics.',
  },
];

export default function ManualOnboardingScreen() {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [context, setContext] = useState('');
  const [situations, setSituations] = useState<string[]>([]);
  const [otherEnabled, setOtherEnabled] = useState(false);
  const [otherText, setOtherText] = useState('');
  const [englishLevel, setEnglishLevel] = useState<EnglishLevel | null>(null);

  const { submit, isSubmitting, error } = useManualOnboardingSubmit();

  const [keyboardVisible, setKeyboardVisible] = useState(false);
  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setKeyboardVisible(true),
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardVisible(false),
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const goalsList = useMemo(() => {
    const list = [...situations];
    const trimmedOther = otherText.trim();
    if (otherEnabled && trimmedOther.length > 0) list.push(trimmedOther);
    return list;
  }, [situations, otherEnabled, otherText]);

  const canContinue = useMemo(() => {
    switch (step) {
      case 0:
        return true;
      case 1:
        return name.trim().length >= 1;
      case 2:
        return context.trim().length >= 1;
      case 3:
        return goalsList.length > 0;
      case 4:
        return englishLevel != null;
      default:
        return false;
    }
  }, [step, name, context, goalsList, englishLevel]);

  const handleBack = useCallback(() => {
    if (isSubmitting) return;
    if (step === 0) {
      router.back();
    } else {
      Haptics.selectionAsync();
      setStep((s) => s - 1);
    }
  }, [step, isSubmitting]);

  const handleSubmit = useCallback(async () => {
    if (englishLevel == null) return;
    const ok = await submit({
      name: name.trim(),
      context: context.trim(),
      goals: goalsList,
      englishLevel,
    });
    if (ok) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [submit, name, context, goalsList, englishLevel]);

  const handleNext = useCallback(() => {
    if (!canContinue || isSubmitting) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (step === TOTAL_STEPS - 1) {
      handleSubmit();
    } else {
      setStep((s) => s + 1);
    }
  }, [canContinue, isSubmitting, step, handleSubmit]);

  const toggleSituation = useCallback((label: string) => {
    Haptics.selectionAsync();
    setSituations((prev) =>
      prev.includes(label) ? prev.filter((s) => s !== label) : [...prev, label],
    );
  }, []);

  const toggleOther = useCallback(() => {
    Haptics.selectionAsync();
    setOtherEnabled((v) => !v);
  }, []);

  return (
    <View style={styles.root}>
      <StepHeader
        step={step + 1}
        total={TOTAL_STEPS}
        onBack={handleBack}
        topInset={insets.top}
      />
      <ProgressBar step={step + 1} total={TOTAL_STEPS} />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View
            key={step}
            entering={FadeIn.duration(280).easing(Easing.out(Easing.cubic))}
            style={styles.stepBody}
          >
            {step === 0 && <DescriptionStep />}
            {step === 1 && (
              <NameStep value={name} onChange={setName} />
            )}
            {step === 2 && (
              <ContextStep value={context} onChange={setContext} />
            )}
            {step === 3 && (
              <SituationsStep
                situations={situations}
                onToggle={toggleSituation}
                otherEnabled={otherEnabled}
                otherText={otherText}
                onToggleOther={toggleOther}
                onChangeOther={setOtherText}
              />
            )}
            {step === 4 && (
              <LevelStep
                value={englishLevel}
                onChange={(lvl) => {
                  Haptics.selectionAsync();
                  setEnglishLevel(lvl);
                }}
              />
            )}
          </Animated.View>
        </ScrollView>

        <View
          style={[
            styles.footer,
            {
              paddingBottom: keyboardVisible
                ? spacing.sm
                : insets.bottom + spacing.md,
            },
          ]}
        >
          {error != null && <Text style={styles.errorText}>{error}</Text>}
          <GlassIconPillButton
            variant="primary"
            label={step === TOTAL_STEPS - 1 ? 'Finish' : 'Continue'}
            icon="arrow-forward"
            disabled={!canContinue || isSubmitting}
            loading={isSubmitting}
            fullWidth
            onPress={handleNext}
          />
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

// ── Step Header (back + perfectly-centered step counter) ───────────────────

function StepHeader({
  step,
  total,
  onBack,
  topInset,
}: {
  step: number;
  total: number;
  onBack: () => void;
  topInset: number;
}) {
  return (
    <View
      style={[
        styles.headerRow,
        { paddingTop: topInset + spacing.sm },
      ]}
    >
      <Pressable
        onPress={onBack}
        hitSlop={12}
        style={styles.headerBtn}
        accessibilityRole="button"
        accessibilityLabel="Back"
      >
        <Ionicons
          name="chevron-back"
          size={22}
          color={alpha(colors.white, 0.85)}
        />
      </Pressable>

      <Text style={styles.stepLabel}>
        Step {step} of {total}
      </Text>

      {/* Same-width spacer keeps the label perfectly centered */}
      <View style={styles.headerBtn} />
    </View>
  );
}

// ── Progress Bar ────────────────────────────────────────────────────────────

function ProgressBar({ step, total }: { step: number; total: number }) {
  const progress = useSharedValue(step / total);

  React.useEffect(() => {
    progress.value = withTiming(step / total, {
      duration: 350,
      easing: Easing.out(Easing.cubic),
    });
  }, [step, total]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  return (
    <View style={styles.progressTrack}>
      <Animated.View style={[styles.progressFill, fillStyle]} />
    </View>
  );
}

// ── Step 0 — Description ────────────────────────────────────────────────────

function DescriptionStep() {
  return (
    <View>
      <Text style={styles.headline}>Meet Reflexa</Text>
      <Text style={styles.body}>
        Reflexa is your AI speaking coach. It helps you speak English with more
        clarity and confidence by finding the speech habits no one's ever
        mentioned to you.
      </Text>
      <Text style={styles.body}>
        In each session you'll talk through real conversations. Reflexa analyzes
        your grammar, filler words, and clarity — then gives you precise,
        personalized feedback on exactly what to work on.
      </Text>
      <Text style={styles.body}>
        First, a short setup so we can tune things to you.
      </Text>
    </View>
  );
}

// ── Step 1 — Name ───────────────────────────────────────────────────────────

function NameStep({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <View>
      <Text style={styles.headline}>What should we call you?</Text>
      <Text style={styles.subtitle}>We'll use this in your sessions.</Text>
      <View style={styles.fieldGroup}>
        <View style={styles.inputWrap}>
          <TextInput
            style={styles.input}
            placeholder="Your first name"
            placeholderTextColor={alpha(colors.white, 0.25)}
            value={value}
            onChangeText={onChange}
            autoCapitalize="words"
            autoCorrect={false}
            maxLength={120}
            autoFocus
            returnKeyType="next"
          />
        </View>
      </View>
    </View>
  );
}

// ── Step 2 — Context ────────────────────────────────────────────────────────

function ContextStep({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <View>
      <Text style={styles.headline}>What brings you to Reflexa?</Text>
      <Text style={styles.subtitle}>
        What do you want to improve about your English?
      </Text>
      <View style={styles.fieldGroup}>
        <View style={[styles.inputWrap, styles.textAreaWrap]}>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="e.g. I want to sound more confident in work meetings and stop using so many filler words."
            placeholderTextColor={alpha(colors.white, 0.25)}
            value={value}
            onChangeText={onChange}
            multiline
            textAlignVertical="top"
            maxLength={1000}
            autoFocus
          />
        </View>
      </View>
    </View>
  );
}

// ── Step 3 — Situations ─────────────────────────────────────────────────────

function SituationsStep({
  situations,
  onToggle,
  otherEnabled,
  otherText,
  onToggleOther,
  onChangeOther,
}: {
  situations: string[];
  onToggle: (label: string) => void;
  otherEnabled: boolean;
  otherText: string;
  onToggleOther: () => void;
  onChangeOther: (v: string) => void;
}) {
  return (
    <View>
      <Text style={styles.headline}>What situations are hardest?</Text>
      <Text style={styles.subtitle}>Pick any that apply.</Text>
      <View style={styles.chipGrid}>
        {SITUATION_CHOICES.map((label) => {
          const active = situations.includes(label);
          return (
            <Pressable
              key={label}
              onPress={() => onToggle(label)}
              style={[styles.chip, active && styles.chipActive]}
            >
              {active && (
                <Ionicons
                  name="checkmark"
                  size={14}
                  color={colors.primary}
                  style={{ marginRight: 4 }}
                />
              )}
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {label}
              </Text>
            </Pressable>
          );
        })}
        <Pressable
          onPress={onToggleOther}
          style={[styles.chip, otherEnabled && styles.chipActive]}
        >
          <Ionicons
            name={otherEnabled ? 'remove' : 'add'}
            size={14}
            color={otherEnabled ? colors.primary : alpha(colors.white, 0.5)}
            style={{ marginRight: 4 }}
          />
          <Text
            style={[styles.chipText, otherEnabled && styles.chipTextActive]}
          >
            Other
          </Text>
        </Pressable>
      </View>

      {otherEnabled && (
        <Animated.View
          entering={FadeIn.duration(250)}
          style={styles.fieldGroup}
        >
          <View style={styles.inputWrap}>
            <TextInput
              style={styles.input}
              placeholder="Tell us more…"
              placeholderTextColor={alpha(colors.white, 0.25)}
              value={otherText}
              onChangeText={onChangeOther}
              autoCapitalize="sentences"
              maxLength={120}
              autoFocus
            />
          </View>
        </Animated.View>
      )}
    </View>
  );
}

// ── Step 4 — English Level ──────────────────────────────────────────────────

function LevelStep({
  value,
  onChange,
}: {
  value: EnglishLevel | null;
  onChange: (lvl: EnglishLevel) => void;
}) {
  return (
    <View>
      <Text style={styles.headline}>How would you describe your English?</Text>
      <Text style={styles.subtitle}>This helps us tune your feedback.</Text>
      <View style={styles.levelList}>
        {ENGLISH_OPTIONS.map((opt) => {
          const selected = value === opt.level;
          return (
            <Pressable
              key={opt.level}
              onPress={() => onChange(opt.level)}
              style={styles.levelRow}
            >
              <View
                style={[
                  styles.levelAccent,
                  selected && styles.levelAccentSelected,
                ]}
              />
              <View style={styles.levelText}>
                <Text
                  style={[
                    styles.levelTitle,
                    selected && styles.levelTitleSelected,
                  ]}
                >
                  {opt.title}
                </Text>
                <Text
                  style={[
                    styles.levelSubtitle,
                    selected && styles.levelSubtitleSelected,
                  ]}
                >
                  {opt.subtitle}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepLabel: {
    ...typography.bodySmMedium,
    color: alpha(colors.white, 0.55),
    letterSpacing: 0.3,
  },
  progressTrack: {
    height: 3,
    width: '100%',
    backgroundColor: alpha(colors.white, 0.05),
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxxl,
  },
  stepBody: {
    flex: 1,
  },

  // Step content
  headline: {
    ...typography.headlineLg,
    color: colors.onSurface,
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.bodyMd,
    color: alpha(colors.white, 0.55),
    marginBottom: spacing.xl,
    lineHeight: 22,
  },
  body: {
    ...typography.bodyMd,
    color: alpha(colors.white, 0.75),
    lineHeight: 24,
    marginBottom: spacing.lg,
  },

  // Fields
  fieldGroup: {
    marginTop: spacing.sm,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: alpha(colors.white, 0.05),
    borderRadius: borderRadius.default,
    borderWidth: 1,
    borderColor: alpha(colors.white, 0.08),
    paddingHorizontal: spacing.lg,
  },
  textAreaWrap: {
    paddingVertical: spacing.sm,
    minHeight: 140,
    alignItems: 'flex-start',
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    ...typography.bodyMd,
    color: colors.onSurface,
  },
  textArea: {
    minHeight: 120,
    paddingTop: 8,
    lineHeight: 22,
  },

  // Chips
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderRadius: borderRadius.full,
    backgroundColor: alpha(colors.white, 0.04),
    borderWidth: 1,
    borderColor: alpha(colors.white, 0.08),
  },
  chipActive: {
    backgroundColor: alpha(colors.primary, 0.15),
    borderColor: alpha(colors.primary, 0.35),
  },
  chipText: {
    fontSize: 14,
    fontFamily: fonts.semibold,
    color: alpha(colors.white, 0.65),
  },
  chipTextActive: {
    color: colors.primary,
  },

  // English-level list — editorial open rows with a left accent bar
  levelList: {
    marginTop: spacing.md,
  },
  levelRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: spacing.lg,
    paddingVertical: spacing.md,
  },
  levelAccent: {
    width: 2,
    backgroundColor: alpha(colors.white, 0.08),
    borderRadius: 1,
  },
  levelAccentSelected: {
    width: 3,
    backgroundColor: colors.primary,
  },
  levelText: {
    flex: 1,
    gap: spacing.xxs,
    paddingVertical: 2,
  },
  levelTitle: {
    fontSize: 22,
    fontFamily: fonts.bold,
    color: alpha(colors.white, 0.7),
    letterSpacing: -0.4,
  },
  levelTitleSelected: {
    color: colors.onSurface,
  },
  levelSubtitle: {
    ...typography.bodySm,
    color: alpha(colors.white, 0.4),
    lineHeight: 18,
  },
  levelSubtitleSelected: {
    color: alpha(colors.white, 0.65),
  },

  // Footer
  footer: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    gap: spacing.sm,
  },
  errorText: {
    ...typography.bodySm,
    color: colors.error,
    textAlign: 'center',
  },
});

