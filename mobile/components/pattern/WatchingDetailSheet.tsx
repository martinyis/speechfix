import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  BottomSheetModal,
  BottomSheetBackdrop,
  BottomSheetView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import {
  colors,
  alpha,
  typography,
  spacing,
  layout,
} from '../../theme';
import { GlassIconPillButton } from '../ui';
import { StateIndicator } from './StateIndicator';
import { authFetch } from '../../lib/api';
import type {
  WatchingPattern,
  WatchingSessionHistoryEntry,
} from '../../types/practice';

const PATTERN_TYPE_LABEL: Record<string, string> = {
  overused_word: 'Overused Word',
  repetitive_starter: 'Sentence Starter',
  crutch_phrase: 'Crutch Phrase',
  hedging: 'Hedging',
  negative_framing: 'Negative Framing',
};

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/** `MMM D` formatter — no external deps. Falls back gracefully for invalid input. */
function formatShortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

function subtitleFor(cleanCount: number, target: number): string {
  if (cleanCount <= 0) return `We haven't seen enough sessions yet.`;
  if (cleanCount >= target) {
    return `Ready to graduate — next session should finalize it.`;
  }
  return `${cleanCount} of ${target} clean sessions needed to graduate.`;
}

interface WatchingDetailSheetProps {
  pattern: WatchingPattern | null;
  onClose: () => void;
}

export interface WatchingDetailSheetRef {
  present: () => void;
  dismiss: () => void;
}

export const WatchingDetailSheet = forwardRef<
  WatchingDetailSheetRef,
  WatchingDetailSheetProps
>(function WatchingDetailSheet({ pattern, onClose }, ref) {
  const sheetRef = useRef<BottomSheetModal>(null);
  const queryClient = useQueryClient();

  // Present when a pattern is set; dismiss when it's cleared.
  useEffect(() => {
    if (pattern) {
      sheetRef.current?.present();
    } else {
      sheetRef.current?.dismiss();
    }
  }, [pattern]);

  useImperativeHandle(
    ref,
    () => ({
      present: () => sheetRef.current?.present(),
      dismiss: () => sheetRef.current?.dismiss(),
    }),
    [],
  );

  const drillAgainMutation = useMutation({
    mutationFn: async (patternId: number) => {
      const res = await authFetch(`/practice/patterns/${patternId}/drill-again`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json() as Promise<{
        patternId: number;
        regenerated: boolean;
        reused: boolean;
      }>;
    },
    onSuccess: async (data) => {
      // Refresh pattern tasks so the practice session screen sees the latest
      // exercise state (reused pool or freshly generated).
      await queryClient.invalidateQueries({ queryKey: ['pattern-tasks'] });
      router.push({
        pathname: '/pattern-practice-session',
        params: {
          patternId: String(data.patternId),
          fromDrillAgain: '1',
          generating: data.regenerated ? '1' : '0',
        },
      });
    },
  });

  const handleDrillAgain = useCallback(() => {
    if (!pattern) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const patternId = pattern.patternId;
    sheetRef.current?.dismiss();
    // Fire after dismissal so the sheet animation doesn't fight with navigation.
    setTimeout(() => {
      drillAgainMutation.mutate(patternId);
    }, 200);
  }, [pattern, drillAgainMutation]);

  const handleDone = useCallback(() => {
    sheetRef.current?.dismiss();
  }, []);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.6}
        pressBehavior="close"
      />
    ),
    [],
  );

  const snapPoints = useMemo(() => ['60%'], []);

  const handleSheetChanges = useCallback(
    (index: number) => {
      if (index === -1) onClose();
    },
    [onClose],
  );

  const target = pattern?.cleanSessionTarget ?? 3;
  const cleanCount = pattern?.cleanSessionCount ?? 0;
  const identifier = pattern
    ? pattern.identifier
      ? `"${pattern.identifier}"`
      : PATTERN_TYPE_LABEL[pattern.type] ?? pattern.type
    : '';
  const typeLabel = pattern
    ? PATTERN_TYPE_LABEL[pattern.type] ?? pattern.type
    : '';

  // Pad session history to exactly 3 rows (with `null` placeholders for awaiting).
  const paddedSessions = useMemo<Array<WatchingSessionHistoryEntry | null>>(() => {
    const history = pattern?.sessionsHistory ?? [];
    const padded: Array<WatchingSessionHistoryEntry | null> = [...history];
    while (padded.length < 3) padded.push(null);
    return padded.slice(0, 3);
  }, [pattern]);

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={snapPoints}
      enableDynamicSizing={false}
      backdropComponent={renderBackdrop}
      handleIndicatorStyle={styles.handleIndicator}
      backgroundStyle={styles.sheetBackground}
      onChange={handleSheetChanges}
    >
      <BottomSheetView style={styles.sheetContent}>
        {pattern && (
          <>
            {/* Header */}
            <View style={styles.headerRow}>
              <StateIndicator state="watching" />
              <View style={styles.headerText}>
                <Text style={styles.identifier} numberOfLines={1}>
                  {identifier}
                </Text>
                <Text style={styles.typeLabel} numberOfLines={1}>
                  {typeLabel}
                </Text>
              </View>
            </View>

            {/* Subtitle */}
            <Text style={styles.subtitle}>
              {subtitleFor(cleanCount, target)}
            </Text>

            {/* Section label */}
            <Text style={styles.sectionLabel}>SESSION HISTORY</Text>

            {/* Session rows */}
            <View style={styles.historyWrap}>
              {paddedSessions.map((entry, i) => (
                <View key={i}>
                  {i > 0 && <View style={styles.divider} />}
                  {entry ? (
                    <SessionRow entry={entry} />
                  ) : (
                    <AwaitingRow />
                  )}
                </View>
              ))}
            </View>

            {/* Spacer pushes actions to the bottom */}
            <View style={styles.spacer} />

            {/* Actions */}
            <View style={styles.actions}>
              <View style={styles.actionItem}>
                <GlassIconPillButton
                  variant="primary"
                  fullWidth
                  label="Drill again"
                  icon="play-forward"
                  onPress={handleDrillAgain}
                  loading={drillAgainMutation.isPending}
                />
              </View>
              <View style={styles.actionItem}>
                <GlassIconPillButton
                  variant="secondary"
                  fullWidth
                  label="Done"
                  noIcon
                  onPress={handleDone}
                />
              </View>
            </View>
          </>
        )}
      </BottomSheetView>
    </BottomSheetModal>
  );
});

// ── Session row ──────────────────────────────────────────────────────────

function SessionRow({ entry }: { entry: WatchingSessionHistoryEntry }) {
  const dateLabel = formatShortDate(entry.sessionDate);
  const dotColor = entry.wasClean ? colors.severityPolish : colors.tertiary;
  const statusText = entry.wasClean
    ? 'Clean'
    : `Still appeared (${entry.appearedCount}×)`;
  const statusColor = entry.wasClean ? colors.severityPolish : colors.tertiary;

  return (
    <View style={styles.row}>
      <Text style={styles.rowDate}>{dateLabel}</Text>
      <View style={styles.rowStatus}>
        <View style={[styles.statusDot, { backgroundColor: dotColor }]} />
        <Text style={[styles.rowStatusLabel, { color: statusColor }]}>
          {statusText}
        </Text>
      </View>
    </View>
  );
}

function AwaitingRow() {
  return (
    <View style={styles.row}>
      <Text style={styles.awaitingText}>— awaiting next session —</Text>
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  handleIndicator: {
    backgroundColor: alpha(colors.white, 0.25),
    width: 40,
  },
  sheetBackground: {
    backgroundColor: colors.surfaceContainerLow,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  sheetContent: {
    flex: 1,
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
  },

  // Header
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  identifier: {
    ...typography.headlineMd,
    color: colors.onSurface,
  },
  typeLabel: {
    ...typography.labelSm,
    color: alpha(colors.white, 0.55),
  },

  // Subtitle
  subtitle: {
    ...typography.bodyMd,
    color: alpha(colors.white, 0.7),
    lineHeight: 22,
    marginBottom: spacing.xl,
  },

  // Section label
  sectionLabel: {
    ...typography.labelSm,
    letterSpacing: 1,
    color: alpha(colors.white, 0.3),
    marginBottom: spacing.sm,
  },

  // Session history
  historyWrap: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: alpha(colors.white, 0.08),
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: alpha(colors.white, 0.04),
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  rowDate: {
    ...typography.bodyMd,
    color: alpha(colors.white, 0.6),
  },
  rowStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  rowStatusLabel: {
    ...typography.bodyMd,
  },
  awaitingText: {
    ...typography.bodySm,
    color: alpha(colors.white, 0.25),
    flex: 1,
  },

  // Actions
  spacer: {
    flex: 1,
    minHeight: spacing.xl,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  actionItem: {
    flex: 1,
  },
});
