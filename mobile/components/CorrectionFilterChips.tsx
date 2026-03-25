import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { colors, alpha } from '../theme';
import type { CorrectionFilter } from '../types/session';

interface CorrectionFilterChipsProps {
  activeFilter: CorrectionFilter;
  onFilterChange: (filter: CorrectionFilter) => void;
  counts: { all: number; error: number; improvement: number; polish: number };
}

const CHIPS: { key: CorrectionFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'error', label: 'Errors' },
  { key: 'improvement', label: 'Improvements' },
  { key: 'polish', label: 'Polish' },
];

export function CorrectionFilterChips({
  activeFilter,
  onFilterChange,
  counts,
}: CorrectionFilterChipsProps) {
  if (counts.all < 2) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {CHIPS.map((chip) => {
        const count = counts[chip.key];
        const isActive = activeFilter === chip.key;
        return (
          <Pressable
            key={chip.key}
            style={[
              styles.chip,
              isActive && styles.chipActive,
            ]}
            onPress={() => onFilterChange(chip.key)}
          >
            <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
              {chip.label} ({count})
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
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 100,
    backgroundColor: alpha(colors.white, 0.04),
    borderWidth: 1,
    borderColor: alpha(colors.white, 0.06),
  },
  chipActive: {
    backgroundColor: alpha(colors.primary, 0.15),
    borderColor: alpha(colors.primary, 0.25),
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: alpha(colors.white, 0.4),
  },
  chipTextActive: {
    color: colors.primary,
  },
});
