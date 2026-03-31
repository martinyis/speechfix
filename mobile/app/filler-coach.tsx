import { useCallback, useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { ScreenHeader, GlassIconPillButton } from '../components/ui';
import { VoiceSessionOverlay } from '../components/VoiceSessionOverlay';
import { useSessionStore } from '../stores/sessionStore';
import { useVoiceSession } from '../hooks/useVoiceSession';
import { authFetch } from '../lib/api';
import { colors, alpha, spacing, layout, fonts, glass } from '../theme';

interface FillerWordStat {
  word: string;
  totalCount: number;
  sessionCount: number;
  avgPerSession: number;
}

export default function FillerCoachScreen() {
  const insets = useSafeAreaInsets();
  const [stats, setStats] = useState<FillerWordStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedWords, setSelectedWords] = useState<Set<string>>(new Set());

  const isActive = useSessionStore((s) => s.isVoiceSessionActive);
  const voiceState = useSessionStore((s) => s.voiceSessionState);
  const elapsedTime = useSessionStore((s) => s.elapsedTime);
  const isMuted = useSessionStore((s) => s.isMuted);

  // Build target words string from selection
  const targetWords = useMemo(
    () => Array.from(selectedWords).join(', '),
    [selectedWords],
  );

  const { start, stop, toggleMute } = useVoiceSession({
    mode: 'filler-coach',
    formContext: targetWords ? { targetWords } : undefined,
    onSessionEnd: () => {
      // Session done — stay on this screen, no navigation
    },
    onError: (message) => {
      console.warn('Filler coach error:', message);
    },
  });

  // Fetch filler summary stats
  useEffect(() => {
    authFetch('/filler-summary')
      .then((res) => res.json())
      .then((data) => {
        const words = data.words ?? [];
        setStats(words);
        // Auto-select top 3 filler words
        const top = words.slice(0, 3).map((w: FillerWordStat) => w.word);
        setSelectedWords(new Set(top));
      })
      .catch((err) => {
        console.error('[filler-coach] Failed to fetch stats:', err);
      })
      .finally(() => setLoading(false));
  }, []);

  const toggleWord = useCallback((word: string) => {
    setSelectedWords((prev) => {
      const next = new Set(prev);
      if (next.has(word)) {
        next.delete(word);
      } else {
        next.add(word);
      }
      return next;
    });
  }, []);

  const handleStart = useCallback(() => {
    start();
  }, [start]);

  // Voice session active — show overlay
  if (isActive) {
    return (
      <VoiceSessionOverlay
        voiceState={voiceState}
        elapsedTime={elapsedTime}
        isMuted={isMuted}
        onToggleMute={toggleMute}
        onStop={stop}
        agentName="Filler Coach"
      />
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader variant="back" title="Filler Word Coach" />

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <View style={styles.body}>
          {/* Header description */}
          <Animated.View entering={FadeIn.duration(300)} style={styles.descriptionWrap}>
            <View style={styles.iconCircle}>
              <Ionicons name="chatbubbles-outline" size={28} color={colors.primary} />
            </View>
            <Text style={styles.descriptionTitle}>Conversation Coaching</Text>
            <Text style={styles.descriptionText}>
              We'll have a natural conversation. When I hear filler words, I'll gently ask you to rephrase. No pressure — just practice.
            </Text>
          </Animated.View>

          {/* Filler word selection */}
          {stats.length > 0 ? (
            <Animated.View entering={FadeInDown.duration(300).delay(100)} style={styles.selectionSection}>
              <Text style={styles.sectionLabel}>FOCUS WORDS</Text>
              <Text style={styles.sectionHint}>Select words to work on this session</Text>

              <View style={styles.wordGrid}>
                {stats.map((stat) => {
                  const isSelected = selectedWords.has(stat.word);
                  return (
                    <Pressable
                      key={stat.word}
                      style={[styles.wordChip, isSelected && styles.wordChipSelected]}
                      onPress={() => toggleWord(stat.word)}
                    >
                      <Text style={[styles.wordChipText, isSelected && styles.wordChipTextSelected]}>
                        {stat.word}
                      </Text>
                      <Text style={[styles.wordChipCount, isSelected && styles.wordChipCountSelected]}>
                        {stat.avgPerSession}/session
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </Animated.View>
          ) : (
            <Animated.View entering={FadeInDown.duration(300).delay(100)} style={styles.noHistoryWrap}>
              <Ionicons name="information-circle-outline" size={20} color={alpha(colors.white, 0.3)} />
              <Text style={styles.noHistoryText}>
                No filler word data yet. We'll focus on common fillers like "um", "uh", "like", and "you know".
              </Text>
            </Animated.View>
          )}

          {/* Start button */}
          <View style={[styles.startWrap, { paddingBottom: insets.bottom + 16 }]}>
            <GlassIconPillButton
              label="Start Session"
              icon="mic"
              variant="primary"
              fullWidth
              onPress={handleStart}
            />
            <Text style={styles.durationHint}>5-7 minute session</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  body: {
    flex: 1,
    paddingHorizontal: layout.screenPadding,
  },

  // Description
  descriptionWrap: {
    alignItems: 'center',
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    gap: spacing.sm,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: alpha(colors.primary, 0.12),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  descriptionTitle: {
    fontSize: 20,
    fontFamily: fonts.bold,
    color: colors.onSurface,
    letterSpacing: -0.3,
  },
  descriptionText: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: alpha(colors.white, 0.45),
    textAlign: 'center',
    lineHeight: 21,
    maxWidth: 300,
  },

  // Selection
  selectionSection: {
    paddingTop: spacing.lg,
    gap: 8,
  },
  sectionLabel: {
    fontSize: 11,
    fontFamily: fonts.bold,
    letterSpacing: 1.2,
    color: alpha(colors.white, 0.25),
  },
  sectionHint: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: alpha(colors.white, 0.35),
    marginBottom: 4,
  },
  wordGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  wordChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    ...glass.card,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  wordChipSelected: {
    backgroundColor: alpha(colors.primary, 0.15),
    borderColor: alpha(colors.primary, 0.3),
  },
  wordChipText: {
    fontSize: 15,
    fontFamily: fonts.semibold,
    color: alpha(colors.white, 0.5),
  },
  wordChipTextSelected: {
    color: colors.primary,
  },
  wordChipCount: {
    fontSize: 11,
    fontFamily: fonts.medium,
    color: alpha(colors.white, 0.2),
  },
  wordChipCountSelected: {
    color: alpha(colors.primary, 0.6),
  },

  // No history
  noHistoryWrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingTop: spacing.lg,
    paddingRight: spacing.md,
  },
  noHistoryText: {
    flex: 1,
    fontSize: 14,
    fontFamily: fonts.regular,
    color: alpha(colors.white, 0.35),
    lineHeight: 21,
  },

  // Start
  startWrap: {
    flex: 1,
    justifyContent: 'flex-end',
    gap: spacing.sm,
    alignItems: 'center',
  },
  durationHint: {
    fontSize: 12,
    fontFamily: fonts.medium,
    color: alpha(colors.white, 0.2),
  },
});
