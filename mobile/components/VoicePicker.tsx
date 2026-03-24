import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, alpha, glass, spacing } from '../theme';
import type { Voice } from '../types/session';

interface VoicePickerProps {
  voices: Voice[];
  selectedVoiceId: string | null;
  onSelect: (voiceId: string) => void;
}

export function VoicePicker({ voices, selectedVoiceId, onSelect }: VoicePickerProps) {
  return (
    <View style={styles.container}>
      {voices.map((voice) => {
        const selected = voice.id === selectedVoiceId;
        return (
          <Pressable
            key={voice.id}
            style={[styles.card, selected && styles.cardSelected]}
            onPress={() => onSelect(voice.id)}
          >
            <View style={styles.cardBody}>
              <View style={styles.nameRow}>
                <Text style={styles.name}>{voice.name}</Text>
                <Text style={styles.gender}>{voice.gender}</Text>
              </View>
              <Text style={styles.description} numberOfLines={2}>
                {voice.description}
              </Text>
            </View>
            {selected && (
              <View style={styles.checkCircle}>
                <Ionicons name="checkmark" size={16} color={colors.background} />
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  card: {
    ...glass.card,
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
  },
  cardSelected: {
    borderColor: alpha(colors.primary, 0.4),
    backgroundColor: alpha(colors.primary, 0.08),
  },
  cardBody: {
    flex: 1,
    gap: 4,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.onSurface,
  },
  gender: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1,
    color: colors.onSurfaceVariant,
    textTransform: 'uppercase',
  },
  description: {
    fontSize: 13,
    color: alpha(colors.white, 0.5),
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.md,
  },
});
