import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

export default function ResultsScreen() {
  const { transcription } = useLocalSearchParams<{ transcription: string }>();

  let sentences: string[] = [];
  if (transcription) {
    try {
      sentences = JSON.parse(transcription);
    } catch {
      sentences = [transcription];
    }
  }

  if (sentences.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.emptyText}>No transcription available</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {sentences.map((sentence, index) => (
        <View key={index} style={styles.sentenceRow}>
          <Text style={styles.sentenceText}>{sentence}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  emptyText: {
    color: '#888',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 40,
  },
  sentenceRow: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  sentenceText: {
    color: '#fff',
    fontSize: 16,
    lineHeight: 24,
  },
});
