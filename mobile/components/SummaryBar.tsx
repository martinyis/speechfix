import { View, Text, StyleSheet } from 'react-native';
import { colors, alpha, fonts } from '../theme';

interface SummaryBarProps {
  totalSentences: number;
  errorCount: number;
  improvementCount: number;
  polishCount: number;
  sentencesWithCorrections: number;
}

export function SummaryBar({
  totalSentences,
  errorCount,
  improvementCount,
  polishCount,
  sentencesWithCorrections,
}: SummaryBarProps) {
  const cleanSentences = Math.max(0, totalSentences - sentencesWithCorrections);
  const totalIssues = errorCount + improvementCount + polishCount;
  const clarityScore =
    totalSentences > 0
      ? Math.round((cleanSentences / totalSentences) * 100)
      : 100;

  // Build improvement summary text
  let summaryText = '';
  if (totalIssues === 0) {
    summaryText = 'Your speech was clean with no issues detected.';
  } else {
    const parts: string[] = [];
    if (errorCount > 0) parts.push(`${errorCount} error${errorCount !== 1 ? 's' : ''}`);
    if (improvementCount > 0)
      parts.push(`${improvementCount} improvement${improvementCount !== 1 ? 's' : ''}`);
    if (polishCount > 0) parts.push(`${polishCount} polish suggestion${polishCount !== 1 ? 's' : ''}`);
    summaryText = `We identified ${parts.join(', ')} across ${sentencesWithCorrections} sentence${sentencesWithCorrections !== 1 ? 's' : ''}.`;
  }

  // Circular progress dimensions
  const size = 140;
  const strokeWidth = 6;
  const radius = (size - strokeWidth) / 2;
  const progressRatio = clarityScore / 100;

  // Build the arc segments for the progress ring
  const segmentCount = 60;
  const anglePerSegment = 360 / segmentCount;
  const filledSegments = Math.round(progressRatio * segmentCount);

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        {/* Left: text content */}
        <View style={styles.textContent}>
          {/* Date label line */}
          <View style={styles.dateRow}>
            <View style={styles.decorativeLine} />
            <Text style={styles.dateLabel}>ANALYSIS</Text>
          </View>

          {/* Headline */}
          <View style={styles.headlineRow}>
            <Text style={styles.headlineWord}>
              Session{'\n'}
              <Text style={styles.headlineAccent}>Analysis.</Text>
            </Text>
          </View>

          {/* Summary subtitle */}
          <Text style={styles.subtitle}>{summaryText}</Text>
        </View>

        {/* Right: Score circle */}
        <View style={styles.scoreContainer}>
          {/* Glow */}
          <View style={styles.scoreGlow} />

          {/* Background ring */}
          <View style={styles.scoreRing}>
            {/* Track */}
            <View style={styles.ringTrack}>
              {/* Filled arc segments */}
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
                        left: size / 2 + x - 2.5,
                        top: size / 2 + y - 2.5,
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
      </View>

      {/* Stats row */}
      {totalIssues > 0 && (
        <View style={styles.statsRow}>
          {errorCount > 0 && (
            <View style={styles.statItem}>
              <View style={[styles.statDot, { backgroundColor: colors.severityError }]} />
              <Text style={styles.statText}>
                {errorCount} error{errorCount !== 1 ? 's' : ''}
              </Text>
            </View>
          )}
          {improvementCount > 0 && (
            <View style={styles.statItem}>
              <View style={[styles.statDot, { backgroundColor: colors.secondary }]} />
              <Text style={styles.statText}>
                {improvementCount} improvement{improvementCount !== 1 ? 's' : ''}
              </Text>
            </View>
          )}
          {polishCount > 0 && (
            <View style={styles.statItem}>
              <View style={[styles.statDot, { backgroundColor: colors.severityPolish }]} />
              <Text style={styles.statText}>
                {polishCount} polish
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  textContent: {
    flex: 1,
    paddingRight: 16,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  decorativeLine: {
    width: 24,
    height: 1,
    backgroundColor: colors.primary,
    opacity: 0.6,
  },
  dateLabel: {
    fontSize: 10,
    fontFamily: fonts.semibold,
    color: colors.primary,
    letterSpacing: 3,
    textTransform: 'uppercase',
  },
  headlineRow: {
    marginBottom: 12,
  },
  headlineWord: {
    fontSize: 36,
    fontFamily: fonts.extrabold,
    color: colors.onSurface,
    letterSpacing: -1.5,
    lineHeight: 40,
  },
  headlineAccent: {
    color: colors.primary,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: fonts.regular,
    color: alpha(colors.white, 0.55),
    lineHeight: 24,
  },
  // Score circle
  scoreContainer: {
    width: 140,
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreGlow: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: alpha(colors.primary, 0.08),
  },
  scoreRing: {
    width: 140,
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringTrack: {
    position: 'absolute',
    width: 140,
    height: 140,
  },
  arcDot: {
    position: 'absolute',
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  scoreCenterContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreValue: {
    fontSize: 34,
    fontFamily: fonts.extrabold,
    color: colors.onSurface,
    letterSpacing: -1,
  },
  scoreLabel: {
    fontSize: 12,
    fontFamily: fonts.medium,
    color: alpha(colors.white, 0.4),
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  // Stats row
  statsRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: alpha(colors.white, 0.06),
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statText: {
    fontSize: 13,
    color: alpha(colors.white, 0.45),
    fontFamily: fonts.medium,
  },
});
