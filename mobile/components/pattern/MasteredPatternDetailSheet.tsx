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
import { colors, alpha, typography, spacing, layout } from '../../theme';
import { GlassIconPillButton } from '../ui';
import { StateIndicator } from './StateIndicator';
import { authFetch } from '../../lib/api';
import type { MasteredPattern } from '../../hooks/data/useMasteredPatterns';

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

/** `MMM D` formatter — no external deps. Falls back to empty string for invalid input. */
function formatShortDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

interface MasteredPatternDetailSheetProps {
  pattern: MasteredPattern | null;
  onClose: () => void;
}

export interface MasteredPatternDetailSheetRef {
  present: () => void;
  dismiss: () => void;
}

export const MasteredPatternDetailSheet = forwardRef<
  MasteredPatternDetailSheetRef,
  MasteredPatternDetailSheetProps
>(function MasteredPatternDetailSheet({ pattern, onClose }, ref) {
  const sheetRef = useRef<BottomSheetModal>(null);
  const queryClient = useQueryClient();

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
      await queryClient.invalidateQueries({ queryKey: ['pattern-tasks'] });
      await queryClient.invalidateQueries({ queryKey: ['mastered-patterns'] });
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

  const snapPoints = useMemo(() => ['65%'], []);

  const handleSheetChanges = useCallback(
    (index: number) => {
      if (index === -1) onClose();
    },
    [onClose],
  );

  const typeLabel = pattern
    ? PATTERN_TYPE_LABEL[pattern.type] ?? pattern.type
    : '';
  const identifier = pattern
    ? pattern.identifier
      ? `"${pattern.identifier}"`
      : typeLabel
    : '';

  const masteredDateLabel = formatShortDate(pattern?.masteredAt);
  const metaLine =
    pattern && masteredDateLabel
      ? `${typeLabel}  ·  Mastered ${masteredDateLabel}`
      : typeLabel;

  const whyText = pattern?.description || pattern?.originalDescription || null;

  // Journey rows — render only if the timestamp exists.
  const journeyRows = useMemo(() => {
    if (!pattern) return [] as Array<{ label: string; value: string }>;
    const rows: Array<{ label: string; value: string }> = [];

    if (pattern.createdAt) {
      const d = formatShortDate(pattern.createdAt);
      if (d) rows.push({ label: 'Detected', value: d });
    }
    if (pattern.completedAt) {
      const d = formatShortDate(pattern.completedAt);
      if (d) rows.push({ label: 'Drilled', value: d });
    }
    if (pattern.enteredWatchingAt && pattern.masteredAt) {
      const from = formatShortDate(pattern.enteredWatchingAt);
      const to = formatShortDate(pattern.masteredAt);
      if (from && to) rows.push({ label: 'Watching', value: `${from} – ${to}` });
    } else if (pattern.enteredWatchingAt) {
      const d = formatShortDate(pattern.enteredWatchingAt);
      if (d) rows.push({ label: 'Watching', value: d });
    }
    if (pattern.masteredAt) {
      const d = formatShortDate(pattern.masteredAt);
      if (d) rows.push({ label: 'Mastered', value: d });
    }

    return rows;
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
              <StateIndicator state="mastered" />
              <View style={styles.headerText}>
                <Text style={styles.identifier} numberOfLines={1}>
                  {identifier}
                </Text>
                <Text style={styles.metaLine} numberOfLines={1}>
                  {metaLine}
                </Text>
              </View>
            </View>

            <View style={styles.divider} />

            {/* Why this was flagged */}
            {whyText ? (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Why this was flagged</Text>
                <Text style={styles.sectionBody}>{whyText}</Text>
              </View>
            ) : null}

            {/* The journey */}
            {journeyRows.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>The journey</Text>
                <View style={styles.journeyWrap}>
                  {journeyRows.map((row, i) => (
                    <View key={row.label}>
                      {i > 0 && <View style={styles.rowDivider} />}
                      <View style={styles.journeyRow}>
                        <Text style={styles.journeyRowLabel}>{row.label}</Text>
                        <Text style={styles.journeyRowValue}>{row.value}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

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
  metaLine: {
    ...typography.bodySm,
    color: alpha(colors.white, 0.55),
  },

  // Dividers / sections
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: alpha(colors.white, 0.08),
    marginVertical: spacing.md,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionLabel: {
    ...typography.labelSm,
    color: alpha(colors.white, 0.4),
    marginBottom: spacing.sm,
  },
  sectionBody: {
    ...typography.bodyMd,
    color: alpha(colors.white, 0.75),
    lineHeight: 22,
  },

  // Journey
  journeyWrap: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: alpha(colors.white, 0.08),
  },
  rowDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: alpha(colors.white, 0.04),
  },
  journeyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  journeyRowLabel: {
    ...typography.labelSm,
    color: alpha(colors.white, 0.5),
  },
  journeyRowValue: {
    ...typography.bodyMd,
    color: alpha(colors.white, 0.7),
  },

  // Actions
  spacer: {
    flex: 1,
    minHeight: spacing.md,
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
