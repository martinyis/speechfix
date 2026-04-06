import { ScrollView, Text, Pressable, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { colors, alpha, fonts } from '../../theme';
import type { PracticeModeInfo, PracticeModeName } from '../../hooks/usePracticeModes';

interface PracticeModeSelectorProps {
  modes: PracticeModeInfo[];
  activeMode: PracticeModeName;
  onModeChange: (mode: PracticeModeName) => void;
}

export function PracticeModeSelector({
  modes,
  activeMode,
  onModeChange,
}: PracticeModeSelectorProps) {
  if (modes.length <= 1) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {modes.map((mode) => {
        const isActive = activeMode === mode.key;
        const countLabel = mode.stats.remaining > 0 ? ` (${mode.stats.remaining})` : '';
        return (
          <Pressable
            key={mode.key}
            style={[styles.pill, isActive && styles.pillActive]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onModeChange(mode.key);
            }}
          >
            <Text style={[styles.pillText, isActive && styles.pillTextActive]}>
              {mode.label}{countLabel}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 100,
    backgroundColor: alpha(colors.white, 0.04),
    borderWidth: 1,
    borderColor: alpha(colors.white, 0.06),
  },
  pillActive: {
    backgroundColor: alpha(colors.primary, 0.15),
    borderColor: alpha(colors.primary, 0.25),
  },
  pillText: {
    fontSize: 13,
    fontFamily: fonts.semibold,
    color: alpha(colors.white, 0.4),
  },
  pillTextActive: {
    color: colors.primary,
  },
});
