import { useCallback, useRef, useState } from 'react';
import { View, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { EmptyState } from '../../components/ui';
import {
  WeakSpotsMode,
  FillerWordsMode,
  PatternsMode,
} from '../../components/practice';
import { FrequencyStrip } from '../../components/practice/FrequencyStrip';
import type { StripMode } from '../../components/practice/FrequencyStrip';
import { useWeakSpots } from '../../hooks/data/useWeakSpots';
import { usePatternTasks } from '../../hooks/data/usePatternTasks';
import { usePracticeModes, type PracticeModeName } from '../../hooks/usePracticeModes';
import { colors, spacing } from '../../theme';

// ---------------------------------------------------------------------------
// Mode → StripMode color mapping
// ---------------------------------------------------------------------------

const MODE_COLORS: Record<PracticeModeName, string> = {
  weak_spots: colors.tertiary,
  filler_words: colors.secondary,
  patterns: '#34d399',
};

function toStripModes(
  modes: { key: PracticeModeName; label: string }[],
): StripMode[] {
  return modes.map((m) => ({
    key: m.key,
    label: m.label,
    color: MODE_COLORS[m.key],
  }));
}

// ---------------------------------------------------------------------------
// PracticeScreen
// ---------------------------------------------------------------------------

export default function PracticeScreen() {
  const { data: weakSpotsData, isLoading, refetch: refetchWeakSpots } = useWeakSpots();
  const { data: patternData, refetch: refetchPatterns } = usePatternTasks();
  const { enabledModes, defaultMode } = usePracticeModes(weakSpotsData, patternData);
  const insets = useSafeAreaInsets();

  const [activeMode, setActiveMode] = useState<PracticeModeName>(defaultMode);
  const fadeOpacity = useSharedValue(1);
  const defaultApplied = useRef(false);

  // Sync default mode on first data load
  if (!defaultApplied.current && enabledModes.length > 0) {
    defaultApplied.current = true;
    if (activeMode !== defaultMode) setActiveMode(defaultMode);
  }

  useFocusEffect(
    useCallback(() => {
      refetchWeakSpots();
      refetchPatterns();
    }, []),
  );

  const handleModeChange = useCallback(
    (key: string) => {
      const mode = key as PracticeModeName;
      if (mode === activeMode) return;
      fadeOpacity.value = withSequence(
        withTiming(0, { duration: 150 }),
        withTiming(1, { duration: 150 }),
      );
      setTimeout(() => setActiveMode(mode), 150);
    },
    [activeMode],
  );

  const fadeStyle = useAnimatedStyle(() => ({
    opacity: fadeOpacity.value,
  }));

  if (isLoading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.centerWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  if (enabledModes.length === 0) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.centerWrap}>
          <EmptyState
            icon="fitness-outline"
            title="Nothing to practice yet"
            subtitle="Complete a voice session to unlock practice modes."
            action={{
              label: 'Start a session',
              onPress: () => router.navigate('/(tabs)'),
            }}
          />
        </View>
      </View>
    );
  }

  const stripModes = toStripModes(enabledModes);

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.md }]}>
      <FrequencyStrip
        modes={stripModes}
        activeKey={activeMode}
        onSelect={handleModeChange}
      />

      <Animated.View style={[styles.content, fadeStyle]}>
        <ScrollView
          style={styles.scroll}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        >
          {activeMode === 'weak_spots' && weakSpotsData && (
            <WeakSpotsMode
              weakSpots={weakSpotsData.activeSpots}
              backlogCount={weakSpotsData.backlog.length}
              quickFixes={weakSpotsData.quickFixes}
              onRefresh={refetchWeakSpots}
            />
          )}
          {activeMode === 'filler_words' && <FillerWordsMode />}
          {activeMode === 'patterns' && patternData && (
            <PatternsMode active={patternData.active} queued={patternData.queued} />
          )}
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centerWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 100,
  },
  content: {
    flex: 1,
    marginTop: spacing.lg,
  },
  scroll: {
    flex: 1,
  },
});
