import { Fragment, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { PracticeTaskCard } from '../PracticeTaskCard';
import { GlassIconPillButton } from '../ui';
import { colors, alpha, fonts, spacing, layout } from '../../theme';
import type { PracticeTask } from '../../types/practice';

const SEVERITY_ORDER: Record<string, number> = { error: 0, improvement: 1, polish: 2 };

const SEVERITY_COLORS: Record<string, string> = {
  error: colors.severityError,
  improvement: colors.severityImprovement,
  polish: colors.severityPolish,
};

interface CorrectionsModeProps {
  tasks: PracticeTask[];
  severityCounts: Record<string, number>;
}

export function CorrectionsMode({ tasks, severityCounts }: CorrectionsModeProps) {
  const unpracticed = useMemo(() => {
    return [...tasks]
      .filter((t) => !t.practiced)
      .sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 2) - (SEVERITY_ORDER[b.severity] ?? 2));
  }, [tasks]);

  const preview = unpracticed.slice(0, 3);
  const allCaughtUp = unpracticed.length === 0;

  const handleStartPracticing = () => {
    if (unpracticed.length === 0) return;
    router.push({
      pathname: '/practice-session',
      params: {
        correctionId: String(unpracticed[0].correctionId),
        mode: 'say_it_right',
        fromList: 'true',
      },
    });
  };

  if (allCaughtUp) {
    return (
      <View style={styles.emptyWrap}>
        <Ionicons name="checkmark-circle-outline" size={48} color={alpha(colors.severityPolish, 0.5)} />
        <Text style={styles.emptyTitle}>All caught up</Text>
        <Text style={styles.emptySubtitle}>
          Keep talking to generate new corrections.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Inline header */}
      <View style={styles.header}>
        <Text style={styles.headerCount}>{unpracticed.length} corrections</Text>
        <View style={styles.severityRow}>
          {(['error', 'improvement', 'polish'] as const).map((sev) => {
            const count = severityCounts[sev] ?? 0;
            if (count === 0) return null;
            return (
              <View key={sev} style={styles.severityItem}>
                <View style={[styles.severityDot, { backgroundColor: SEVERITY_COLORS[sev] }]} />
                <Text style={[styles.severityCount, { color: SEVERITY_COLORS[sev] }]}>{count}</Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* Next Up label */}
      <Text style={styles.sectionLabel}>NEXT UP</Text>

      {/* Preview items */}
      {preview.map((task, i) => (
        <Fragment key={task.correctionId}>
          {i > 0 && <View style={styles.divider} />}
          <PracticeTaskCard task={task} fromList />
        </Fragment>
      ))}

      {/* Buttons at bottom */}
      <View style={styles.buttonsWrap}>
        <GlassIconPillButton
          label="Start Practicing"
          icon="play"
          variant="primary"
          fullWidth
          onPress={handleStartPracticing}
        />
        <GlassIconPillButton
          label="See All Corrections"
          variant="secondary"
          fullWidth
          noIcon
          onPress={() => router.push('/corrections-list')}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: layout.screenPadding,
    marginBottom: spacing.xl,
  },
  headerCount: {
    fontSize: 20,
    fontFamily: fonts.extrabold,
    color: colors.onSurface,
    letterSpacing: -0.5,
  },
  severityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 6,
  },
  severityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  severityDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  severityCount: {
    fontSize: 14,
    fontFamily: fonts.semibold,
  },
  sectionLabel: {
    fontSize: 13,
    fontFamily: fonts.bold,
    color: alpha(colors.white, 0.25),
    letterSpacing: 1.2,
    paddingHorizontal: layout.screenPadding,
    marginBottom: 12,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: alpha(colors.white, 0.06),
    marginLeft: 35,
  },
  buttonsWrap: {
    gap: 10,
    paddingHorizontal: layout.screenPadding,
    marginTop: spacing.xxl,
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 100,
    gap: spacing.sm,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: fonts.semibold,
    color: colors.onSurface,
    marginTop: spacing.sm,
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: alpha(colors.white, 0.35),
    textAlign: 'center',
    maxWidth: 260,
    lineHeight: 20,
  },
});
