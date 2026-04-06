import { View, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { GlassCard, GlassIconPillButton } from '../ui';
import { colors, alpha, fonts, spacing, layout } from '../../theme';

export function FillerWordsMode() {
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Filler Word Coach</Text>
        <Text style={styles.description}>
          Practice reducing fillers{'\n'}in live AI conversation
        </Text>

        <GlassCard style={styles.infoCard}>
          <Text style={styles.infoTitle}>What to expect</Text>
          <Text style={styles.infoText}>
            Have a natural conversation while the AI tracks your filler words in real-time. You'll get instant feedback on "um", "like", "you know", and other fillers.
          </Text>
        </GlassCard>
      </View>

      <View style={styles.buttonWrap}>
        <GlassIconPillButton
          label="Start Conversation"
          icon="mic"
          variant="primary"
          fullWidth
          onPress={() => router.push('/filler-coach')}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-between',
  },
  content: {
    paddingHorizontal: layout.screenPadding,
  },
  title: {
    fontSize: 20,
    fontFamily: fonts.extrabold,
    color: colors.onSurface,
    letterSpacing: -0.5,
    marginBottom: spacing.sm,
  },
  description: {
    fontSize: 15,
    fontFamily: fonts.regular,
    color: alpha(colors.white, 0.45),
    lineHeight: 22,
    marginBottom: spacing.xxl,
  },
  infoCard: {
    width: '100%',
  },
  infoTitle: {
    fontSize: 14,
    fontFamily: fonts.semibold,
    color: alpha(colors.white, 0.6),
    marginBottom: spacing.sm,
  },
  infoText: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: alpha(colors.white, 0.4),
    lineHeight: 20,
  },
  buttonWrap: {
    paddingHorizontal: layout.screenPadding,
  },
});
