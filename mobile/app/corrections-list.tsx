import { useMemo, useState, useCallback, Fragment } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenHeader, GlassIconPillButton } from '../components/ui';
import { CorrectionFilterChips } from '../components/CorrectionFilterChips';
import { PracticeTaskCard } from '../components/PracticeTaskCard';
import { usePracticeTasks } from '../hooks/usePracticeTasks';
import { colors, alpha, fonts, spacing, layout } from '../theme';
import type { CorrectionFilter } from '../types/session';

const SEVERITY_ORDER: Record<string, number> = { error: 0, improvement: 1, polish: 2 };

export default function CorrectionsListScreen() {
  const insets = useSafeAreaInsets();
  const { data: tasks, refetch } = usePracticeTasks();
  const [filter, setFilter] = useState<CorrectionFilter>('all');
  const [showPracticed, setShowPracticed] = useState(false);

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, []),
  );

  const handleFilterChange = useCallback((f: CorrectionFilter) => {
    setFilter(f);
  }, []);

  const { toPractice, practiced, counts } = useMemo(() => {
    if (!tasks) return { toPractice: [], practiced: [], counts: { all: 0, error: 0, improvement: 0, polish: 0 } };

    const filtered = filter === 'all' ? tasks : tasks.filter((t) => t.severity === filter);
    const toPractice = filtered.filter((t) => !t.practiced);
    const practiced = filtered.filter((t) => t.practiced);

    const counts = {
      all: tasks.length,
      error: tasks.filter((t) => t.severity === 'error').length,
      improvement: tasks.filter((t) => t.severity === 'improvement').length,
      polish: tasks.filter((t) => t.severity === 'polish').length,
    };

    return { toPractice, practiced, counts };
  }, [tasks, filter]);

  const handlePracticeAll = () => {
    if (toPractice.length === 0) return;
    const sorted = [...toPractice].sort(
      (a, b) => (SEVERITY_ORDER[a.severity] ?? 2) - (SEVERITY_ORDER[b.severity] ?? 2),
    );
    router.push({
      pathname: '/practice-session',
      params: {
        correctionId: String(sorted[0].correctionId),
        mode: 'say_it_right',
        fromList: 'true',
      },
    });
  };

  return (
    <View style={styles.container}>
      <ScreenHeader variant="back" title="Corrections" />

      <View style={styles.filterWrap}>
        <CorrectionFilterChips
          activeFilter={filter}
          onFilterChange={handleFilterChange}
          counts={counts}
        />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: insets.bottom + (toPractice.length > 0 ? 100 : 40) }}
        showsVerticalScrollIndicator={false}
      >
        {toPractice.length > 0 ? (
          <>
            <Text style={styles.sectionLabel}>
              TO PRACTICE
              <Text style={styles.sectionCount}> · {toPractice.length}</Text>
            </Text>
            {toPractice.map((task, i) => (
              <Fragment key={task.correctionId}>
                {i > 0 && <View style={styles.divider} />}
                <PracticeTaskCard task={task} fromList />
              </Fragment>
            ))}
          </>
        ) : (
          <View style={styles.emptyWrap}>
            <Ionicons name="checkmark-circle-outline" size={28} color={alpha(colors.severityPolish, 0.5)} />
            <Text style={styles.emptyTitle}>All caught up</Text>
            <Text style={styles.emptySubtitle}>
              You've practiced every correction in this filter.
            </Text>
          </View>
        )}

        {/* Practiced section */}
        {practiced.length > 0 && (
          <>
            <Pressable
              style={styles.practicedToggle}
              onPress={() => setShowPracticed((v) => !v)}
            >
              <Text style={styles.practicedToggleText}>
                {showPracticed ? 'Hide' : 'Show'} practiced ({practiced.length})
              </Text>
              <Ionicons
                name={showPracticed ? 'chevron-up' : 'chevron-down'}
                size={16}
                color={alpha(colors.white, 0.3)}
              />
            </Pressable>

            {showPracticed &&
              practiced.map((task, i) => (
                <Fragment key={task.correctionId}>
                  {i > 0 && <View style={styles.divider} />}
                  <PracticeTaskCard task={task} dimmed fromList />
                </Fragment>
              ))}
          </>
        )}
      </ScrollView>

      {/* Floating Practice All button */}
      {toPractice.length > 0 && (
        <View style={[styles.floatingButton, { bottom: insets.bottom + 16 }]}>
          <GlassIconPillButton
            label={`Practice All (${toPractice.length})`}
            icon="play"
            variant="primary"
            fullWidth
            onPress={handlePracticeAll}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  filterWrap: {
    marginBottom: spacing.md,
  },
  scrollView: {
    flex: 1,
  },
  sectionLabel: {
    fontSize: 13,
    fontFamily: fonts.bold,
    color: alpha(colors.white, 0.25),
    letterSpacing: 1.2,
    paddingHorizontal: layout.screenPadding,
    marginBottom: 12,
  },
  sectionCount: {
    fontFamily: fonts.medium,
    color: alpha(colors.white, 0.15),
    letterSpacing: 0,
    textTransform: 'none' as const,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: alpha(colors.white, 0.06),
    marginLeft: 35,
  },
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: spacing.sm,
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: fonts.semibold,
    color: colors.onSurface,
  },
  emptySubtitle: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: alpha(colors.white, 0.35),
    textAlign: 'center',
    maxWidth: 260,
    lineHeight: 19,
  },
  practicedToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: layout.screenPadding,
    marginTop: spacing.xl,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: alpha(colors.white, 0.06),
  },
  practicedToggleText: {
    fontSize: 13,
    fontFamily: fonts.semibold,
    color: alpha(colors.white, 0.3),
  },
  floatingButton: {
    position: 'absolute',
    left: 20,
    right: 20,
  },
});
