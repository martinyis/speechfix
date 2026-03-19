import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Animated } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { AnalyzingBanner } from '../components/AnalyzingBanner';
import { FillerChips } from '../components/FillerChips';
import { CorrectionHighlight } from '../components/CorrectionHighlight';
import type { Correction, FillerWord, FillerWordPosition } from '../types/session';

export default function ResultsScreen() {
  const { sessionId, sentences, corrections, fillerWords, fillerPositions } =
    useLocalSearchParams<{
      sessionId: string;
      sentences: string;
      corrections: string;
      fillerWords: string;
      fillerPositions: string;
    }>();

  // Parse JSON params into typed arrays
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

  const parsedFillerPositions: FillerWordPosition[] = useMemo(() => {
    try {
      return fillerPositions ? JSON.parse(fillerPositions) : [];
    } catch {
      return [];
    }
  }, [fillerPositions]);

  // Progressive display state
  const [showAnalysis, setShowAnalysis] = useState(false);
  const analysisOpacity = useRef(new Animated.Value(0)).current;

  // After 800ms delay, reveal analysis with fade-in
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

  // Group corrections by sentenceIndex
  const correctionsBySentence = useMemo(() => {
    const map = new Map<number, Correction[]>();
    parsedCorrections.forEach((c) => {
      const existing = map.get(c.sentenceIndex) || [];
      existing.push(c);
      map.set(c.sentenceIndex, existing);
    });
    return map;
  }, [parsedCorrections]);

  // Group fillerPositions by sentenceIndex
  const fillersBySentence = useMemo(() => {
    const map = new Map<number, FillerWordPosition[]>();
    parsedFillerPositions.forEach((f) => {
      const existing = map.get(f.sentenceIndex) || [];
      existing.push(f);
      map.set(f.sentenceIndex, existing);
    });
    return map;
  }, [parsedFillerPositions]);

  // Filter to only sentences with corrections or fillers
  const sentencesWithIssues = useMemo(() => {
    return parsedSentences
      .map((text, index) => ({ text, index }))
      .filter(
        ({ index }) =>
          (correctionsBySentence.get(index)?.length ?? 0) > 0 ||
          (fillersBySentence.get(index)?.length ?? 0) > 0,
      );
  }, [parsedSentences, correctionsBySentence, fillersBySentence]);

  const hasIssues = sentencesWithIssues.length > 0;
  const hasFillerWords = parsedFillerWords.length > 0;

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
        // Show all sentences as plain text while analyzing
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
          {hasFillerWords && <FillerChips fillerWords={parsedFillerWords} />}

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
