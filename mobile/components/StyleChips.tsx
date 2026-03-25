import { ScrollView, Text, Pressable, StyleSheet } from 'react-native';
import { colors, alpha, spacing, borderRadius } from '../theme';

interface StyleChipsProps {
  options: string[];
  selected: string | null;
  onSelect: (value: string | null) => void;
}

export function StyleChips({ options, selected, onSelect }: StyleChipsProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {options.map((option) => {
        const isSelected = option === selected;
        return (
          <Pressable
            key={option}
            style={[styles.chip, isSelected && styles.chipSelected]}
            onPress={() => onSelect(isSelected ? null : option)}
          >
            <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
              {option}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  chip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.lg,
    backgroundColor: alpha(colors.white, 0.06),
    borderWidth: 1,
    borderColor: alpha(colors.white, 0.1),
  },
  chipSelected: {
    backgroundColor: alpha(colors.primary, 0.15),
    borderColor: alpha(colors.primary, 0.3),
  },
  chipText: {
    fontSize: 14,
    fontWeight: '600',
    color: alpha(colors.white, 0.6),
  },
  chipTextSelected: {
    color: colors.primary,
  },
});
