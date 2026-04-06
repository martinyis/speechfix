import { Fragment, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenHeader } from '../components/ui';
import { PatternTaskCard } from '../components/PatternTaskCard';
import { QueuedPatternCard } from '../components/QueuedPatternCard';
import { usePatternTasks } from '../hooks/usePatternTasks';
import { colors, alpha, fonts, layout, spacing } from '../theme';

export default function PatternsListScreen() {
  const insets = useSafeAreaInsets();
  const { data: patternData, refetch } = usePatternTasks();

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, []),
  );

  const active = patternData?.active ?? null;
  const queued = patternData?.queued ?? [];

  return (
    <View style={styles.container}>
      <ScreenHeader variant="back" title="Speech Patterns" />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
      >
        {active && (
          <>
            <Text style={styles.sectionLabel}>ACTIVE</Text>
            <PatternTaskCard
              group={{
                patternId: active.patternId,
                type: active.type,
                identifier: active.identifier,
                severity: active.severity,
                description: active.description,
                exercises: active.exercises,
              }}
            />
          </>
        )}

        {queued.length > 0 && (
          <>
            <Text style={[styles.sectionLabel, active && { marginTop: spacing.lg }]}>
              QUEUED
            </Text>
            {queued.map((pattern, i) => (
              <Fragment key={pattern.patternId}>
                {i > 0 && <View style={styles.divider} />}
                <QueuedPatternCard pattern={pattern} />
              </Fragment>
            ))}
          </>
        )}

        {!active && queued.length === 0 && (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyText}>No patterns detected yet.</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  sectionLabel: {
    fontSize: 10,
    fontFamily: fonts.bold,
    color: alpha(colors.white, 0.2),
    letterSpacing: 1.5,
    paddingHorizontal: layout.screenPadding,
    marginBottom: 8,
    marginTop: spacing.md,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: alpha(colors.white, 0.06),
    marginLeft: 35,
  },
  emptyWrap: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: alpha(colors.white, 0.3),
  },
});
