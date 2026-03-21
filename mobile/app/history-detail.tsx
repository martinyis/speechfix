import { useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSession } from '../hooks/useSession';
import { SummaryBar } from '../components/SummaryBar';
import { FillerChips } from '../components/FillerChips';
import { SessionInsightCard } from '../components/SessionInsightCard';
import { CorrectionCard } from '../components/CorrectionCard';

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

  // Compute correction counts
  const errorCount = useMemo(() => {
    if (!session) return 0;
    return session.corrections.filter((c) => c.severity === 'error').length;
  }, [session?.corrections]);

  const improvementCount = useMemo(() => {
    if (!session) return 0;
    return session.corrections.filter((c) => c.severity === 'improvement').length;
  }, [session?.corrections]);

  const polishCount = useMemo(() => {
    if (!session) return 0;
    return session.corrections.filter((c) => c.severity === 'polish').length;
  }, [session?.corrections]);

  // Unique sentence indices that have corrections
  const sentenceIndicesWithCorrections = useMemo(() => {
    if (!session) return new Set<number>();
    const indices = new Set<number>();
    session.corrections.forEach((c) => indices.add(c.sentenceIndex));
    return indices;
  }, [session?.corrections]);

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
  const hasCorrections = session.corrections.length > 0;
  const sessionInsights = session.sessionInsights ?? [];
  const hasInsights = sessionInsights.length > 0;

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.dateText}>{formattedDate}</Text>
        <Text style={styles.durationText}>{formattedDuration}</Text>
      </View>

      <SummaryBar
        totalSentences={session.sentences.length}
        errorCount={errorCount}
        improvementCount={improvementCount}
        polishCount={polishCount}
        sentencesWithCorrections={sentenceIndicesWithCorrections.size}
      />

      {hasFillerWords && <FillerChips fillerWords={session.fillerWords} />}

      {hasInsights && (
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>INSIGHTS</Text>
          {sessionInsights.map((insight, index) => (
            <SessionInsightCard
              key={index}
              type={insight.type}
              description={insight.description}
            />
          ))}
        </View>
      )}

      {hasCorrections ? (
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>CORRECTIONS</Text>
          {session.corrections.map((correction, index) => (
            <CorrectionCard
              key={index}
              contextSnippet={correction.contextSnippet}
              originalText={correction.originalText}
              correctedText={correction.correctedText}
              explanation={correction.explanation}
              correctionType={correction.correctionType}
              severity={correction.severity ?? 'error'}
            />
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
  section: {
    paddingTop: 16,
    paddingBottom: 4,
  },
  sectionHeader: {
    color: '#999',
    fontSize: 12,
    letterSpacing: 1,
    marginBottom: 8,
    paddingHorizontal: 16,
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
