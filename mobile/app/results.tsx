import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Animated } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { AnalyzingBanner } from '../components/AnalyzingBanner';
import { SummaryBar } from '../components/SummaryBar';
import { FillerChips } from '../components/FillerChips';
import { SessionInsightCard } from '../components/SessionInsightCard';
import { CorrectionCard } from '../components/CorrectionCard';
import type { Correction, FillerWord, FillerWordPosition, SessionInsight } from '../types/session';

export default function ResultsScreen() {
  const { sessionId, sentences, corrections, fillerWords, fillerPositions, sessionInsights } =
    useLocalSearchParams<{
      sessionId: string;
      sentences: string;
      corrections: string;
      fillerWords: string;
      fillerPositions: string;
      sessionInsights: string;
    }>();

  const parsedSentences: string[] = useMemo(() => {
    try {
      return sentences ? JSON.parse(sentences) : [];
    } catch {
      return [];
    }
  }, [sentences]);

  const parsedCorrections: Correction[] = useMemo(() => {
    try {
      return corrections ? JSON.parse(corrections) : [];
    } catch {
      return [];
    }
  }, [corrections]);

  const parsedFillerWords: FillerWord[] = useMemo(() => {
    try {
      return fillerWords ? JSON.parse(fillerWords) : [];
    } catch {
      return [];
    }
  }, [fillerWords]);

  const parsedSessionInsights: SessionInsight[] = useMemo(() => {
    try {
      return sessionInsights ? JSON.parse(sessionInsights) : [];
    } catch {
      return [];
    }
  }, [sessionInsights]);

  // Progressive display state
  const [showAnalysis, setShowAnalysis] = useState(false);
  const analysisOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowAnalysis(true);
      Animated.timing(analysisOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();
    }, 800);
    return () => clearTimeout(timer);
  }, []);

  // Compute counts
  const errorCount = useMemo(
    () => parsedCorrections.filter((c) => c.severity === 'error').length,
    [parsedCorrections],
  );
  const improvementCount = useMemo(
    () => parsedCorrections.filter((c) => c.severity === 'improvement').length,
    [parsedCorrections],
  );
  const polishCount = useMemo(
    () => parsedCorrections.filter((c) => c.severity === 'polish').length,
    [parsedCorrections],
  );

  // Unique sentence indices that have corrections
  const sentenceIndicesWithCorrections = useMemo(() => {
    const indices = new Set<number>();
    parsedCorrections.forEach((c) => indices.add(c.sentenceIndex));
    return indices;
  }, [parsedCorrections]);

  const hasCorrections = parsedCorrections.length > 0;
  const hasFillerWords = parsedFillerWords.length > 0;
  const hasInsights = parsedSessionInsights.length > 0;

  if (parsedSentences.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.emptyText}>No speech detected in recording</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <AnalyzingBanner visible={!showAnalysis} />

      {!showAnalysis && (
        <View>
          {parsedSentences.map((sentence, index) => (
            <View key={index} style={styles.sentenceRow}>
              <Text style={styles.sentenceText}>{sentence}</Text>
            </View>
          ))}
        </View>
      )}

      {showAnalysis && (
        <Animated.View style={{ opacity: analysisOpacity }}>
          <SummaryBar
            totalSentences={parsedSentences.length}
            errorCount={errorCount}
            improvementCount={improvementCount}
            polishCount={polishCount}
            sentencesWithCorrections={sentenceIndicesWithCorrections.size}
          />

          {hasFillerWords && <FillerChips fillerWords={parsedFillerWords} />}

          {hasInsights && (
            <View style={styles.section}>
              <Text style={styles.sectionHeader}>INSIGHTS</Text>
              {parsedSessionInsights.map((insight, index) => (
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
              {parsedCorrections.map((correction, index) => (
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
            <View style={styles.successContainer}>
              <Text style={styles.successText}>No errors found!</Text>
            </View>
          )}
        </Animated.View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  emptyText: {
    color: '#999',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 40,
  },
  sentenceRow: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
  },
  sentenceText: {
    color: '#000',
    fontSize: 16,
    lineHeight: 24,
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
  successContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  successText: {
    color: '#4CAF50',
    fontSize: 18,
    fontWeight: '600',
  },
});
