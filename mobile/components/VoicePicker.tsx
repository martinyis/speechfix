import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, alpha, glass, spacing, fonts } from '../theme';
import type { Voice } from '../types/session';

interface VoicePreviewProps {
  previewVoiceId?: string | null;
  previewPlaying?: boolean;
  previewLoading?: boolean;
  onTogglePreview?: (voiceId: string) => void;
}

interface VoicePickerProps extends VoicePreviewProps {
  voices: Voice[];
  selectedVoiceId: string | null;
  onSelect: (voiceId: string) => void;
  compact?: boolean;
}

export function VoicePicker({
  voices,
  selectedVoiceId,
  onSelect,
  compact,
  previewVoiceId,
  previewPlaying = false,
  previewLoading = false,
  onTogglePreview,
}: VoicePickerProps) {
  const handlePress = (voiceId: string) => {
    const isSelected = voiceId === selectedVoiceId;
    if (!isSelected) {
      // Select + start preview
      onSelect(voiceId);
      onTogglePreview?.(voiceId);
    } else {
      // Already selected — toggle preview (pause/resume)
      onTogglePreview?.(voiceId);
    }
  };

  if (compact) {
    return (
      <View style={styles.chipRow}>
        {voices.map((voice) => {
          const selected = voice.id === selectedVoiceId;
          const isActive = voice.id === previewVoiceId;
          const showPlaying = selected && isActive && previewPlaying;
          const showLoading = selected && isActive && previewLoading && !previewPlaying;
          return (
            <Pressable
              key={voice.id}
              style={[styles.chip, selected && styles.chipSelected]}
              onPress={() => handlePress(voice.id)}
            >
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                {voice.name}
              </Text>
              {selected && showLoading && (
                <ActivityIndicator size="small" color={colors.primary} />
              )}
              {selected && showPlaying && (
                <Ionicons name="volume-high" size={14} color={colors.primary} />
              )}
              {selected && !showPlaying && !showLoading && (
                <Ionicons name="checkmark" size={14} color={colors.primary} />
              )}
            </Pressable>
          );
        })}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {voices.map((voice) => {
        const selected = voice.id === selectedVoiceId;
        const isActive = voice.id === previewVoiceId;
        const showPlaying = selected && isActive && previewPlaying;
        const showLoading = selected && isActive && previewLoading && !previewPlaying;
        return (
          <Pressable
            key={voice.id}
            style={[styles.card, selected && styles.cardSelected]}
            onPress={() => handlePress(voice.id)}
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
                {showLoading ? (
                  <ActivityIndicator size="small" color={colors.background} />
                ) : showPlaying ? (
                  <Ionicons name="volume-high" size={14} color={colors.background} />
                ) : (
                  <Ionicons name="checkmark" size={16} color={colors.background} />
                )}
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
    fontFamily: fonts.semibold,
    color: colors.onSurface,
  },
  gender: {
    fontSize: 11,
    fontFamily: fonts.semibold,
    letterSpacing: 1,
    color: colors.onSurfaceVariant,
    textTransform: 'uppercase',
  },
  description: {
    fontSize: 13,
    fontFamily: fonts.regular,
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

  // Compact chip variant
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: alpha(colors.white, 0.1),
    backgroundColor: alpha(colors.white, 0.04),
  },
  chipSelected: {
    borderColor: alpha(colors.primary, 0.5),
    backgroundColor: alpha(colors.primary, 0.12),
  },
  chipText: {
    fontSize: 14,
    fontFamily: fonts.medium,
    color: alpha(colors.white, 0.6),
  },
  chipTextSelected: {
    color: colors.primary,
    fontFamily: fonts.semibold,
  },
});
