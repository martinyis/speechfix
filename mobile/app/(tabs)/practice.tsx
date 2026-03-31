import { useMemo, useState, useCallback, Fragment } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ScreenHeader, EmptyState } from '../../components/ui';
import { CorrectionFilterChips } from '../../components/CorrectionFilterChips';
import { PracticeTaskCard } from '../../components/PracticeTaskCard';
import { usePracticeTasks } from '../../hooks/usePracticeTasks';
import { colors, alpha, spacing, layout, fonts } from '../../theme';
import type { CorrectionFilter } from '../../types/session';

const INITIAL_LIMIT = 20;

export default function PracticeScreen() {
  const insets = useSafeAreaInsets();
  const { data: tasks, isLoading, refetch } = usePracticeTasks();

  const [filter, setFilter] = useState<CorrectionFilter>('all');
  const [showAll, setShowAll] = useState(false);
  const [showPracticed, setShowPracticed] = useState(false);

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, []),
  );

  const handleFilterChange = useCallback((f: CorrectionFilter) => {
    setFilter(f);
    setShowAll(false);
  }, []);

  // Split tasks into sections
  const { toPractice, practiced, counts } = useMemo(() => {
    if (!tasks) return { toPractice: [], practiced: [], counts: { all: 0, error: 0, improvement: 0, polish: 0 } };

    const filtered = filter === 'all'
      ? tasks
      : tasks.filter((t) => t.severity === filter);

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

  const visibleToPractice = showAll ? toPractice : toPractice.slice(0, INITIAL_LIMIT);
  const hiddenCount = toPractice.length - visibleToPractice.length;

  // Loading state
  if (isLoading) {
    return (
      <View style={styles.container}>
        <ScreenHeader variant="large" title="Practice" />
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  // No tasks at all (user has no sessions/corrections)
  if (!tasks || tasks.length === 0) {
    return (
      <View style={styles.container}>
        <ScreenHeader variant="large" title="Practice" />
        <View style={styles.emptyWrap}>
          <EmptyState
            icon="fitness-outline"
            title="Nothing to practice yet"
            subtitle="Complete a voice session and your corrections will appear here as practice drills."
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
    <View style={styles.container}>
      <ScreenHeader variant="large" title="Practice" />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: insets.bottom + 60 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Filler Word Coach CTA */}
        <Pressable
          style={styles.fillerCoachCard}
          onPress={() => router.push('/filler-coach')}
        >
          <View style={styles.fillerCoachIcon}>
            <Ionicons name="chatbubbles-outline" size={22} color={colors.primary} />
          </View>
          <View style={styles.fillerCoachContent}>
            <Text style={styles.fillerCoachTitle}>Filler Word Coach</Text>
            <Text style={styles.fillerCoachSub}>
              Practice reducing "um", "like", and other fillers in live conversation
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={alpha(colors.white, 0.2)} />
        </Pressable>

        {/* Filter chips */}
        <View style={styles.filterWrap}>
          <CorrectionFilterChips
            activeFilter={filter}
            onFilterChange={handleFilterChange}
            counts={counts}
          />
        </View>

        {/* To Practice section */}
        <Text style={styles.sectionLabel}>
          TO PRACTICE
          {toPractice.length > 0 && (
            <Text style={styles.sectionCount}> · {toPractice.length} remaining</Text>
          )}
        </Text>

        {visibleToPractice.length > 0 ? (
          <>
            {visibleToPractice.map((task, i) => (
              <Fragment key={task.correctionId}>
                {i > 0 && <View style={styles.stripDivider} />}
                <PracticeTaskCard task={task} />
              </Fragment>
            ))}

            {hiddenCount > 0 && (
              <Pressable
                style={styles.showMoreStrip}
                onPress={() => setShowAll(true)}
              >
                <Text style={styles.showMoreText}>
                  Showing {visibleToPractice.length} of {toPractice.length}
                </Text>
                <Text style={styles.showMoreAction}> Show more</Text>
              </Pressable>
            )}
          </>
        ) : (
          <View style={styles.inlinEmpty}>
            <Ionicons name="checkmark-circle-outline" size={28} color={alpha(colors.severityPolish, 0.5)} />
            <Text style={styles.inlineEmptyTitle}>All caught up</Text>
            <Text style={styles.inlineEmptySubtitle}>
              You've practiced every correction. Keep talking to generate new ones.
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

            {showPracticed && practiced.map((task, i) => (
              <Fragment key={task.correctionId}>
                {i > 0 && <View style={styles.stripDivider} />}
                <PracticeTaskCard task={task} dimmed />
              </Fragment>
            ))}
          </>
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
  loadingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 100,
  },
  scrollView: {
    flex: 1,
  },
  fillerCoachCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginHorizontal: layout.screenPadding,
    marginBottom: spacing.lg,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: alpha(colors.white, 0.04),
    borderWidth: 1,
    borderColor: alpha(colors.primary, 0.15),
  },
  fillerCoachIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: alpha(colors.primary, 0.12),
    alignItems: 'center',
    justifyContent: 'center',
  },
  fillerCoachContent: {
    flex: 1,
    gap: 2,
  },
  fillerCoachTitle: {
    fontSize: 15,
    fontFamily: fonts.semibold,
    color: colors.onSurface,
  },
  fillerCoachSub: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: alpha(colors.white, 0.35),
    lineHeight: 17,
  },
  filterWrap: {
    marginBottom: spacing.lg,
  },
  sectionLabel: {
    fontSize: 13,
    fontFamily: fonts.bold,
    color: alpha(colors.white, 0.25),
    letterSpacing: 1.2,
    paddingHorizontal: layout.screenPadding,
    marginBottom: 12,
  },
  showMoreStrip: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 14,
    marginHorizontal: layout.screenPadding,
    marginTop: 4,
    borderRadius: 12,
    backgroundColor: alpha(colors.white, 0.03),
    borderWidth: 1,
    borderColor: alpha(colors.white, 0.06),
  },
  showMoreText: {
    fontSize: 13,
    fontFamily: fonts.medium,
    color: alpha(colors.white, 0.35),
  },
  showMoreAction: {
    fontSize: 13,
    fontFamily: fonts.semibold,
    color: colors.primary,
  },
  inlinEmpty: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: spacing.sm,
  },
  inlineEmptyTitle: {
    fontSize: 16,
    fontFamily: fonts.semibold,
    color: colors.onSurface,
  },
  inlineEmptySubtitle: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: alpha(colors.white, 0.35),
    textAlign: 'center',
    maxWidth: 260,
    lineHeight: 19,
  },
  stripDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: alpha(colors.white, 0.06),
    marginLeft: 35,
  },
  sectionCount: {
    fontFamily: fonts.medium,
    color: alpha(colors.white, 0.15),
    letterSpacing: 0,
    textTransform: 'none',
  },
  practicedToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
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
});
