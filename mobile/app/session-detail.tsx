import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { useLocalSearchParams, router, useNavigation } from 'expo-router';
import Animated, {
  FadeIn,
  FadeInDown,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useSessionStore } from '../stores/sessionStore';
import { useSession } from '../hooks/useSession';
import { ScoreRingHero } from '../components/ScoreRingHero';
import { SeverityPills, type CorrectionFilter } from '../components/SeverityPills';
import { CorrectionFilterChips } from '../components/CorrectionFilterChips';
import { FillerChips } from '../components/FillerChips';
import { CorrectionCard } from '../components/CorrectionCard';
import { AnalyzingBanner } from '../components/AnalyzingBanner';
import { formatDate, formatDuration } from '../lib/formatters';
import { colors, alpha } from '../theme';
import type { SessionDetail } from '../types/session';

const INITIAL_CORRECTION_LIMIT = 8;

export default function SessionDetailScreen() {
  const { sessionId, fresh } = useLocalSearchParams<{
    sessionId: string;
    fresh?: string;
  }>();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const isFresh = fresh === 'true';

  // Filter state
  const [correctionFilter, setCorrectionFilter] = useState<CorrectionFilter>('all');
  const [showAllCorrections, setShowAllCorrections] = useState(false);

  // Refs for scroll-to-corrections
  const scrollRef = useRef<ScrollView>(null);
  const correctionsY = useRef(0);

  // Data sources
  const storeData = useSessionStore((s) => s.currentSessionData);
  const {
    data: fetchedData,
    isLoading,
    isError,
  } = useSession(isFresh ? null : Number(sessionId));

  const session: SessionDetail | null | undefined = isFresh
    ? storeData
    : fetchedData;

  // Override back button for fresh mode
  useEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [isFresh, navigation]);

  // Compute summary counts
  const counts = useMemo(() => {
    if (!session) return null;
    const errorCount = session.corrections.filter(
      (c) => c.severity === 'error',
    ).length;
    const improvementCount = session.corrections.filter(
      (c) => c.severity === 'improvement',
    ).length;
    const polishCount = session.corrections.filter(
      (c) => c.severity === 'polish',
    ).length;
    const sentencesWithCorrections = new Set(
      session.corrections.map((c) => c.sentenceIndex),
    ).size;
    return {
      errorCount,
      improvementCount,
      polishCount,
      sentencesWithCorrections,
    };
  }, [session]);

  // Filtered + limited corrections
  const filteredCorrections = useMemo(() => {
    if (!session) return [];
    if (correctionFilter === 'all') return session.corrections;
    return session.corrections.filter((c) => c.severity === correctionFilter);
  }, [session, correctionFilter]);

  const visibleCorrections = showAllCorrections
    ? filteredCorrections
    : filteredCorrections.slice(0, INITIAL_CORRECTION_LIMIT);

  const hiddenCount = filteredCorrections.length - visibleCorrections.length;

  // Severity pill tap -> scroll to corrections + set filter
  const handleSeverityPillPress = useCallback((filter: CorrectionFilter) => {
    setCorrectionFilter(filter);
    setShowAllCorrections(false);
    setTimeout(() => {
      scrollRef.current?.scrollTo({ y: correctionsY.current - 20, animated: true });
    }, 50);
  }, []);

  // Filter chip tap -> set filter + reset "show all"
  const handleFilterChipPress = useCallback((filter: CorrectionFilter) => {
    setCorrectionFilter(filter);
    setShowAllCorrections(false);
  }, []);

  // -- Loading / error states for historical mode --
  if (!isFresh && isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!isFresh && isError) {
    return (
      <View style={styles.center}>
        <Ionicons name="alert-circle-outline" size={48} color={alpha(colors.white, 0.2)} />
        <Text style={styles.errorText}>Session not found</Text>
      </View>
    );
  }

  // -- Fresh mode: still analyzing --
  if (isFresh && !session) {
    return (
      <View style={styles.container}>
        {/* Sticky top bar */}
        <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
          <Pressable
            onPress={() => router.replace('/(tabs)')}
            hitSlop={12}
            style={styles.backPressable}
            accessibilityRole="button"
            accessibilityLabel="Back to home"
          >
            <Ionicons name="chevron-back" size={22} color={alpha(colors.white, 0.7)} />
            <Text style={styles.backText}>Back</Text>
          </Pressable>
        </View>

        <View style={styles.analyzingHeaderBlock}>
          <Text style={styles.analyzingDateText}>
            {formatDate(new Date().toISOString())}
          </Text>
        </View>

        <AnalyzingBanner visible />
      </View>
    );
  }

  // -- Session data available --
  if (!session || !counts) return null;

  const totalSentences = session.sentences.length;
  const cleanSentences = Math.max(0, totalSentences - counts.sentencesWithCorrections);
  const clarityScore =
    totalSentences > 0
      ? Math.round((cleanSentences / totalSentences) * 100)
      : 100;

  const hasCorrections = session.corrections.length > 0;
  const hasFillers = session.fillerWords.length > 0;

  // Animation wrapper helper
  const maybeAnimate = (
    node: React.ReactNode,
    entering: Parameters<typeof Animated.View>[0]['entering'],
    key?: string,
  ) =>
    isFresh ? (
      <Animated.View key={key} entering={entering}>
        {node}
      </Animated.View>
    ) : (
      node
    );

  return (
    <View style={styles.container}>
      {/* Sticky top bar */}
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <Pressable
          onPress={() =>
            isFresh ? router.replace('/(tabs)') : router.back()
          }
          hitSlop={12}
          style={styles.backPressable}
          accessibilityRole="button"
          accessibilityLabel="Back to home"
        >
          <Ionicons name="chevron-back" size={22} color={alpha(colors.white, 0.7)} />
          <Text style={styles.backText}>Back</Text>
        </Pressable>
        <Text style={styles.topBarDuration}>
          {formatDuration(session.durationSeconds)}
        </Text>
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Date header */}
        <View style={styles.headerBlock}>
          <Text style={styles.dateText}>{formatDate(session.createdAt)}</Text>
        </View>

        {/* ===== TIER 1: THE VERDICT ===== */}
        {maybeAnimate(
          <ScoreRingHero
            clarityScore={clarityScore}
            totalSentences={totalSentences}
            cleanSentences={cleanSentences}
          />,
          FadeIn.duration(300),
        )}

        {maybeAnimate(
          <SeverityPills
            errorCount={counts.errorCount}
            improvementCount={counts.improvementCount}
            polishCount={counts.polishCount}
            activeFilter={correctionFilter}
            onFilterChange={handleSeverityPillPress}
          />,
          FadeIn.duration(300).delay(150),
        )}

        <View style={styles.sectionSpacer} />

        {/* ===== TIER 2: FILLERS ===== */}
        {hasFillers && (
          <>
            {maybeAnimate(
              <FillerChips
                fillerWords={session.fillerWords}
                durationSeconds={session.durationSeconds}
              />,
              FadeIn.duration(300).delay(300),
            )}
            <View style={styles.sectionSpacer} />
          </>
        )}

        {/* ===== TIER 3: CORRECTIONS ===== */}
        <View
          onLayout={(e) => {
            correctionsY.current = e.nativeEvent.layout.y;
          }}
          style={styles.refinementsSection}
        >
          <Text style={styles.sectionTitle}>Refinements</Text>
          <Text style={styles.sectionSubtitle}>
            Tap phrases to hear the AI-optimized version
          </Text>

          <View style={styles.refinementsGap} />

          <CorrectionFilterChips
            activeFilter={correctionFilter}
            onFilterChange={handleFilterChipPress}
            counts={{
              all: session.corrections.length,
              error: counts.errorCount,
              improvement: counts.improvementCount,
              polish: counts.polishCount,
            }}
          />

          {session.corrections.length > 1 && <View style={styles.refinementsGap} />}

          {visibleCorrections.length > 0 ? (
            <>
              {visibleCorrections.map((c, i) => {
                const sentence =
                  session.sentences[c.sentenceIndex] ?? '';
                const key = c.id ?? i;
                const card = (
                  <CorrectionCard
                    key={key}
                    sentence={sentence}
                    originalText={c.originalText}
                    correctedText={c.correctedText}
                    explanation={c.explanation}
                    correctionType={c.correctionType}
                    severity={c.severity}
                  />
                );
                if (isFresh) {
                  const baseDelay = hasFillers ? 450 : 300;
                  return (
                    <Animated.View
                      key={key}
                      entering={FadeInDown.duration(300).delay(baseDelay + i * 100)}
                    >
                      {card}
                    </Animated.View>
                  );
                }
                return card;
              })}

              {/* Show N more */}
              {hiddenCount > 0 && (
                <Pressable
                  style={styles.showMoreButton}
                  onPress={() => setShowAllCorrections(true)}
                >
                  <Text style={styles.showMoreText}>
                    Show {hiddenCount} more
                  </Text>
                </Pressable>
              )}
            </>
          ) : hasCorrections ? (
            // Filter resulted in 0 visible
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                No {correctionFilter === 'error' ? 'errors' : correctionFilter === 'improvement' ? 'improvements' : 'polish suggestions'} found
              </Text>
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <Ionicons
                name="checkmark-circle-outline"
                size={32}
                color={alpha(colors.severityPolish, 0.5)}
              />
              <Text style={styles.emptyText}>No issues found</Text>
              <Text style={styles.emptySubtext}>
                Your speech was grammatically clean
              </Text>
            </View>
          )}
        </View>

        {/* Bottom padding */}
        <View style={{ height: insets.bottom + 60 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 20,
  },
  center: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },

  // Sticky top bar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: alpha(colors.white, 0.05),
    zIndex: 10,
  },
  backPressable: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  backText: {
    fontSize: 16,
    color: alpha(colors.white, 0.7),
    fontWeight: '500',
  },
  topBarDuration: {
    fontSize: 13,
    color: alpha(colors.white, 0.3),
    fontWeight: '500',
    letterSpacing: 0.5,
  },

  // Header
  headerBlock: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 8,
  },
  dateText: {
    fontSize: 13,
    color: alpha(colors.white, 0.35),
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  analyzingHeaderBlock: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  analyzingDateText: {
    fontSize: 13,
    color: alpha(colors.white, 0.35),
    fontWeight: '500',
    letterSpacing: 0.3,
  },

  // Section spacing
  sectionSpacer: {
    height: 48,
  },

  // Refinements & Insights sections
  refinementsSection: {
    paddingHorizontal: 0,
  },
  sectionTitle: {
    fontSize: 30,
    fontWeight: '800',
    color: colors.onSurface,
    letterSpacing: -1,
    paddingHorizontal: 20,
    marginBottom: 6,
  },
  sectionSubtitle: {
    fontSize: 14,
    fontWeight: '400',
    color: alpha(colors.white, 0.35),
    paddingHorizontal: 20,
  },
  refinementsGap: {
    height: 20,
  },

  // Empty state
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 8,
  },
  emptyText: {
    fontSize: 17,
    color: alpha(colors.severityPolish, 0.7),
    fontWeight: '600',
  },
  emptySubtext: {
    fontSize: 14,
    color: alpha(colors.white, 0.3),
    fontWeight: '400',
  },

  // Show more
  showMoreButton: {
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 100,
    backgroundColor: alpha(colors.white, 0.05),
    borderWidth: 1,
    borderColor: alpha(colors.white, 0.08),
    marginTop: 4,
    marginBottom: 16,
  },
  showMoreText: {
    fontSize: 14,
    fontWeight: '600',
    color: alpha(colors.white, 0.5),
  },

  // Error state
  errorText: {
    fontSize: 16,
    color: alpha(colors.white, 0.4),
    fontWeight: '500',
  },
});
