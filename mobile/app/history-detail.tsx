import { useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSession } from '../hooks/useSession';
import { CorrectionHighlight } from '../components/CorrectionHighlight';
import { FillerChips } from '../components/FillerChips';

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

export default function HistoryDetailScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const { data: session, isLoading, isError } = useSession(
    sessionId ? Number(sessionId) : null,
  );

  // Group corrections by sentenceIndex
  const correctionsBySentence = useMemo(() => {
    if (!session) return new Map();
    const map = new Map<number, typeof session.corrections>();
    session.corrections.forEach((c) => {
      const existing = map.get(c.sentenceIndex) || [];
      existing.push(c);
      map.set(c.sentenceIndex, existing);
    });
    return map;
  }, [session?.corrections]);

  // Group filler positions by sentenceIndex
  const fillersBySentence = useMemo(() => {
    if (!session) return new Map();
    const map = new Map<number, typeof session.fillerPositions>();
    session.fillerPositions.forEach((f) => {
      const existing = map.get(f.sentenceIndex) || [];
      existing.push(f);
      map.set(f.sentenceIndex, existing);
    });
    return map;
  }, [session?.fillerPositions]);

  // Filter to sentences with corrections or fillers
  const sentencesWithIssues = useMemo(() => {
    if (!session) return [];
    return session.sentences
      .map((text, index) => ({ text, index }))
      .filter(
        ({ index }) =>
          (correctionsBySentence.get(index)?.length ?? 0) > 0 ||
          (fillersBySentence.get(index)?.length ?? 0) > 0,
      );
  }, [session?.sentences, correctionsBySentence, fillersBySentence]);

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#000" />
      </View>
    );
  }

  if (isError || !session) {
    return (
      <View style={styles.centered}>
        <Text style={styles.notFoundText}>Session not found</Text>
      </View>
    );
  }

  const formattedDate = new Date(session.createdAt).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  const formattedDuration = formatDuration(session.durationSeconds);
  const hasFillerWords = session.fillerWords.length > 0;
  const hasIssues = sentencesWithIssues.length > 0;

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.dateText}>{formattedDate}</Text>
        <Text style={styles.durationText}>{formattedDuration}</Text>
      </View>

      {hasFillerWords && (
        <View>
          <FillerChips fillerWords={session.fillerWords} />
        </View>
      )}

      {hasIssues ? (
        <View>
          {sentencesWithIssues.map(({ text, index }) => (
            <View key={index} style={styles.sentenceRow}>
              <CorrectionHighlight
                sentence={text}
                corrections={correctionsBySentence.get(index) || []}
                fillerPositions={fillersBySentence.get(index) || []}
              />
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.noIssuesContainer}>
          <Text style={styles.noIssuesText}>No issues found in this session</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  centered: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
  },
  dateText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000',
  },
  durationText: {
    fontSize: 14,
    color: '#999',
    marginTop: 4,
  },
  notFoundText: {
    fontSize: 16,
    color: '#999',
  },
  sentenceRow: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
  },
  noIssuesContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  noIssuesText: {
    fontSize: 16,
    color: '#999',
  },
});
