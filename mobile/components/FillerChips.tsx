import { View, Text, StyleSheet } from 'react-native';

interface Props {
  fillerWords: { word: string; count: number }[];
}

export function FillerChips({ fillerWords }: Props) {
  if (fillerWords.length === 0) return null;

  return (
    <View style={styles.section}>
      <Text style={styles.sectionHeader}>FILLER WORDS</Text>
      <View style={styles.chipContainer}>
        {fillerWords.map((filler) => (
          <View key={filler.word} style={styles.chip}>
            <Text style={styles.chipText}>
              {filler.word}: {filler.count}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  sectionHeader: {
    color: '#999',
    fontSize: 12,
    letterSpacing: 1,
    marginBottom: 8,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  chip: {
    backgroundColor: '#FFF3CD',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8,
  },
  chipText: {
    color: '#856404',
    fontSize: 14,
    fontWeight: '600',
  },
});
