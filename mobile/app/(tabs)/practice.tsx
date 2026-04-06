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
  CorrectionsMode,
  FillerWordsMode,
  PatternsMode,
  OrbitModeSwitcher,
} from '../../components/practice';
import { usePracticeTasks } from '../../hooks/usePracticeTasks';
import { usePatternTasks } from '../../hooks/usePatternTasks';
import { usePracticeModes, type PracticeModeName } from '../../hooks/usePracticeModes';
import { colors, spacing } from '../../theme';

export default function PracticeScreen() {
  const { data: tasks, isLoading, refetch } = usePracticeTasks();
  const { data: patternData, refetch: refetchPatterns } = usePatternTasks();
  const { enabledModes, severityCounts, defaultMode } = usePracticeModes(tasks, patternData);
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
      refetch();
      refetchPatterns();
    }, []),
  );

  const handleModeChange = useCallback(
    (mode: PracticeModeName) => {
      if (mode === activeMode) return;
      // Crossfade: 150ms out, set mode, 150ms in
      fadeOpacity.value = withSequence(
        withTiming(0, { duration: 150 }),
        withTiming(1, { duration: 150 }),
      );
      // Change content at the midpoint
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

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.md }]}>
      <OrbitModeSwitcher
        modes={enabledModes}
        activeModeKey={activeMode}
        onModeChange={handleModeChange}
        topOffset={insets.top + spacing.md}
      />

      <Animated.View style={[styles.content, fadeStyle]}>
        <ScrollView
          style={styles.scroll}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        >
          {activeMode === 'corrections' && tasks && (
            <CorrectionsMode tasks={tasks} severityCounts={severityCounts} />
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
  },
  scroll: {
    flex: 1,
  },
});
