import { ScrollView, StyleSheet } from 'react-native';
import { spacing } from '../theme';
import { GlassIconPillButton } from './ui';

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
          <GlassIconPillButton
            key={option}
            label={option}
            noIcon
            small
            active={isSelected}
            onPress={() => onSelect(isSelected ? null : option)}
          />
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
});
