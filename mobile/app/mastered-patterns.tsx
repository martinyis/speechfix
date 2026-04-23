import { Fragment, useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenHeader } from '../components/ui';
import { MasteredPatternDetailSheet } from '../components/pattern/MasteredPatternDetailSheet';
import {
  useMasteredPatterns,
  type MasteredPattern,
} from '../hooks/data/useMasteredPatterns';
import { colors, alpha, layout, spacing, typography } from '../theme';

const PATTERN_TYPE_LABEL: Record<string, string> = {
  overused_word: 'Overused Word',
  repetitive_starter: 'Sentence Starter',
  crutch_phrase: 'Crutch Phrase',
  hedging: 'Hedging',
  negative_framing: 'Negative Framing',
};

const MONTHS_SHORT = [
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

const MONTHS_LONG = [
  'JANUARY',
  'FEBRUARY',
  'MARCH',
  'APRIL',
  'MAY',
  'JUNE',
  'JULY',
  'AUGUST',
  'SEPTEMBER',
  'OCTOBER',
  'NOVEMBER',
  'DECEMBER',
];

/** `MMM D` (e.g. `Apr 21`) — no external deps. */
function formatShortDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const day = d.getDate();
  const padded = day < 10 ? `0${day}` : String(day);
  return `${MONTHS_SHORT[d.getMonth()]} ${padded}`;
}

type Section = {
  key: string;
  label: string;
  items: MasteredPattern[];
};

/**
 * Group patterns into sections:
 * - current calendar month → `THIS MONTH`
 * - previous months in the current year → month name (`APRIL`, `MARCH`)
 * - older than current year → year (`2025`, `2024`)
 */
function groupPatterns(patterns: MasteredPattern[]): Section[] {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  const map = new Map<string, Section>();
  const order: string[] = [];

  // Patterns arrive sorted by masteredAt DESC from the backend; preserve that.
  for (const p of patterns) {
    if (!p.masteredAt) continue;
    const d = new Date(p.masteredAt);
    if (Number.isNaN(d.getTime())) continue;

    const year = d.getFullYear();
    const month = d.getMonth();

    let key: string;
    let label: string;
    if (year === currentYear && month === currentMonth) {
      key = 'this-month';
      label = 'THIS MONTH';
    } else if (year === currentYear) {
      key = `month-${month}`;
      label = MONTHS_LONG[month];
    } else {
      key = `year-${year}`;
      label = String(year);
    }

    let section = map.get(key);
    if (!section) {
      section = { key, label, items: [] };
      map.set(key, section);
      order.push(key);
    }
    section.items.push(p);
  }

  return order.map((k) => map.get(k)!).filter((s) => s.items.length > 0);
}

function typeLabelFor(type: string): string {
  return PATTERN_TYPE_LABEL[type] ?? type;
}

function identifierLabelFor(pattern: MasteredPattern): string {
  return pattern.identifier
    ? `"${pattern.identifier}"`
    : typeLabelFor(pattern.type);
}

function ordinalSuffix(count: number): string {
  if (count === 2) return '2nd time';
  if (count === 3) return '3rd time';
  if (count >= 4) return `${count}th time`;
  return 'returned';
}

export default function MasteredPatternsScreen() {
  const insets = useSafeAreaInsets();
  const { data, isLoading, refetch } = useMasteredPatterns();
  const [sheetPattern, setSheetPattern] = useState<MasteredPattern | null>(
    null,
  );

  useFocusEffect(
    useCallback(() => {
      refetch();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  const patterns = useMemo(() => data?.patterns ?? [], [data]);
  const sections = useMemo(() => groupPatterns(patterns), [patterns]);
  const count = patterns.length;

  const handleRowPress = (pattern: MasteredPattern) => {
    setSheetPattern(pattern);
  };

  const handleSheetClose = () => setSheetPattern(null);

  return (
    <View style={styles.container}>
      <ScreenHeader variant="back" title="Mastered Patterns" />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
      >
        {isLoading ? null : count === 0 ? (
          <EmptyState />
        ) : (
          <>
            {/* Hero */}
            <View style={styles.hero}>
              <Text style={styles.heroNumber}>{count}</Text>
              <Text style={styles.heroLabel}>patterns mastered</Text>
            </View>
            <View style={styles.heroDivider} />

            {/* Sections */}
            {sections.map((section, sIdx) => (
              <View key={section.key}>
                <Text
                  style={[
                    styles.sectionLabel,
                    sIdx > 0 && styles.sectionLabelSpaced,
                  ]}
                >
                  {section.label}
                </Text>

                {section.items.map((pattern, i) => (
                  <Fragment key={`mastered-${pattern.patternId}`}>
                    {i > 0 && <View style={styles.rowDivider} />}
                    <MasteredRow
                      pattern={pattern}
                      onPress={handleRowPress}
                    />
                  </Fragment>
                ))}
              </View>
            ))}
          </>
        )}
      </ScrollView>

      <MasteredPatternDetailSheet
        pattern={sheetPattern}
        onClose={handleSheetClose}
      />
    </View>
  );
}

// ── Row ──────────────────────────────────────────────────────────────────

function MasteredRow({
  pattern,
  onPress,
}: {
  pattern: MasteredPattern;
  onPress: (p: MasteredPattern) => void;
}) {
  const identifier = identifierLabelFor(pattern);
  const typeLabel = typeLabelFor(pattern.type);
  const dateLabel = formatShortDate(pattern.masteredAt);

  let returningSuffix: string | null = null;
  if (pattern.wasReturning) {
    // If we know the prior count (incl. current mastering), surface the ordinal.
    // Count 2+ means this is at least the 2nd time mastered.
    const prior = pattern.priorMasteringsCount;
    if (typeof prior === 'number' && prior >= 1) {
      // `prior` = prior masterings (before this one). 1 prior → this is the 2nd time.
      returningSuffix = ordinalSuffix(prior + 1);
    } else {
      returningSuffix = '2nd time';
    }
  }

  return (
    <TouchableOpacity
      onPress={() => onPress(pattern)}
      activeOpacity={0.7}
      style={styles.row}
    >
      <Text style={styles.rowIdentifier} numberOfLines={1}>
        {identifier}
      </Text>
      <Text style={styles.rowType} numberOfLines={1}>
        {typeLabel}
      </Text>
      <View style={styles.rowDateGroup}>
        <Text style={styles.rowDate}>{dateLabel}</Text>
        {returningSuffix && (
          <Text style={styles.rowReturning}>{` · ${returningSuffix}`}</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

// ── Empty state ──────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <View style={styles.emptyWrap}>
      <Text style={styles.emptyTitle}>
        Your first mastered pattern{'\n'}will show up here.
      </Text>
      <Text style={styles.emptySubtitle}>
        Finish a drill and keep recording to graduate patterns over time.
      </Text>
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },

  // Hero
  hero: {
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
    alignItems: 'center',
  },
  heroNumber: {
    ...typography.displayMd,
    color: colors.white,
    textAlign: 'center',
  },
  heroLabel: {
    ...typography.labelSm,
    color: alpha(colors.white, 0.4),
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  heroDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: alpha(colors.white, 0.08),
    marginHorizontal: layout.screenPadding,
  },

  // Section header
  sectionLabel: {
    ...typography.labelSm,
    color: alpha(colors.white, 0.3),
    paddingHorizontal: layout.screenPadding,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  sectionLabelSpaced: {
    marginTop: spacing.xl,
  },

  // Row
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: layout.screenPadding,
    paddingVertical: 12,
    gap: spacing.md,
  },
  rowIdentifier: {
    ...typography.bodyMdMedium,
    color: alpha(colors.white, 0.75),
    flex: 1,
  },
  rowType: {
    ...typography.labelSm,
    color: alpha(colors.primary, 0.6),
  },
  rowDateGroup: {
    flexDirection: 'row',
    alignItems: 'baseline',
    minWidth: 60,
    justifyContent: 'flex-end',
  },
  rowDate: {
    ...typography.bodySm,
    color: alpha(colors.white, 0.35),
  },
  rowReturning: {
    ...typography.bodySm,
    color: alpha(colors.tertiary, 0.5),
  },
  rowDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: alpha(colors.white, 0.04),
    marginHorizontal: layout.screenPadding,
  },

  // Empty state
  emptyWrap: {
    paddingTop: 120,
    paddingHorizontal: layout.screenPadding,
    alignItems: 'center',
    gap: spacing.md,
  },
  emptyTitle: {
    ...typography.headlineSm,
    color: alpha(colors.white, 0.7),
    textAlign: 'center',
  },
  emptySubtitle: {
    ...typography.bodyMd,
    color: alpha(colors.white, 0.35),
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 20,
  },
});
