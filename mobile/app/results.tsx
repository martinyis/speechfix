import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

export default function ResultsScreen() {
  const { transcription, sessionId } = useLocalSearchParams<{
    transcription: string;
    sessionId: string;
  }>();

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
        <Text style={styles.emptyText}>No speech detected in recording</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.header}>Transcription</Text>
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
  header: {
    color: '#888',
    fontSize: 14,
    marginBottom: 8,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  emptyText: {
    color: '#888',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 40,
  },
  sentenceRow: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#333',
  },
  sentenceText: {
    color: '#fff',
    fontSize: 16,
    lineHeight: 24,
  },
});
