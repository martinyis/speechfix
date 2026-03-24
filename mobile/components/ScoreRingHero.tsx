import { View, Text, StyleSheet } from 'react-native';
import { colors, alpha } from '../theme';

interface ScoreRingHeroProps {
  clarityScore: number;
  totalSentences: number;
  cleanSentences: number;
}

function getHeadline(score: number, clean: number, total: number): string {
  if (total === 0) return 'No speech detected.';
  if (score === 100) return 'Perfect session. Every sentence was clean.';
  if (score >= 80) return `Strong session. ${clean} of ${total} sentences were clean.`;
  if (score >= 60) return `Good effort. ${clean} of ${total} sentences were clean.`;
  if (score >= 40) return `Keep practicing. ${clean} of ${total} sentences were clean.`;
  return `Room to grow. ${clean} of ${total} sentences were clean.`;
}

export function ScoreRingHero({
  clarityScore,
  totalSentences,
  cleanSentences,
}: ScoreRingHeroProps) {
  const size = 190;
  const strokeWidth = 6;
  const radius = (size - strokeWidth) / 2;
  const progressRatio = clarityScore / 100;

  const segmentCount = 60;
  const anglePerSegment = 360 / segmentCount;
  const filledSegments = Math.round(progressRatio * segmentCount);

  return (
    <View style={styles.container}>
      {/* Score ring */}
      <View style={[styles.scoreContainer, { width: size, height: size }]}>
        {/* Glow */}
        <View style={styles.scoreGlow} />

        {/* Ring */}
        <View style={[styles.scoreRing, { width: size, height: size }]}>
          {/* Track with arc dots */}
          <View style={[styles.ringTrack, { width: size, height: size }]}>
            {Array.from({ length: segmentCount }).map((_, i) => {
              const angle = (i * anglePerSegment - 90) * (Math.PI / 180);
              const x = radius * Math.cos(angle);
              const y = radius * Math.sin(angle);
              const isFilled = i < filledSegments;

              return (
                <View
                  key={i}
                  style={[
                    styles.arcDot,
                    {
                      left: size / 2 + x - 3,
                      top: size / 2 + y - 3,
                      backgroundColor: isFilled
                        ? i < filledSegments * 0.5
                          ? colors.primary
                          : colors.secondary
                        : alpha(colors.white, 0.06),
                      opacity: isFilled ? 1 : 0.5,
                    },
                  ]}
                />
              );
            })}
          </View>

          {/* Center text */}
          <View style={styles.scoreCenterContent}>
            <Text style={styles.scoreValue}>{clarityScore}%</Text>
            <Text style={styles.scoreLabel}>Clarity</Text>
          </View>
        </View>
      </View>

      {/* Headline */}
      <Text style={styles.headline}>
        {getHeadline(clarityScore, cleanSentences, totalSentences)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  scoreContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreGlow: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: alpha(colors.primary, 0.07),
  },
  scoreRing: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringTrack: {
    position: 'absolute',
  },
  arcDot: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  scoreCenterContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreValue: {
    fontSize: 44,
    fontWeight: '800',
    color: colors.onSurface,
    letterSpacing: -1.5,
  },
  scoreLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: alpha(colors.white, 0.4),
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  headline: {
    fontSize: 16,
    fontWeight: '300',
    color: alpha(colors.white, 0.5),
    lineHeight: 24,
    textAlign: 'center',
    marginTop: 20,
    paddingHorizontal: 20,
  },
});
