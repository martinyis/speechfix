import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, alpha, glass, spacing } from '../theme';
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

function PreviewButton({
  voiceId,
  isActive,
  isPlaying,
  isLoading,
  onToggle,
  size = 20,
}: {
  voiceId: string;
  isActive: boolean;
  isPlaying: boolean;
  isLoading: boolean;
  onToggle: (id: string) => void;
  size?: number;
}) {
  if (isActive && isLoading) {
    return (
      <Pressable
        onPress={() => onToggle(voiceId)}
        hitSlop={8}
        style={styles.previewButton}
      >
        <ActivityIndicator size="small" color={colors.primary} />
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={() => onToggle(voiceId)}
      hitSlop={8}
      style={styles.previewButton}
    >
      <Ionicons
        name={isActive && isPlaying ? 'stop-circle' : 'play-circle'}
        size={size}
        color={isActive ? colors.primary : alpha(colors.white, 0.4)}
      />
    </Pressable>
  );
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
  if (compact) {
    return (
      <View style={styles.chipRow}>
        {voices.map((voice) => {
          const selected = voice.id === selectedVoiceId;
          const isActive = voice.id === previewVoiceId;
          return (
            <Pressable
              key={voice.id}
              style={[styles.chip, selected && styles.chipSelected]}
              onPress={() => onSelect(voice.id)}
            >
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                {voice.name}
              </Text>
              {onTogglePreview && (
                <PreviewButton
                  voiceId={voice.id}
                  isActive={isActive}
                  isPlaying={previewPlaying}
                  isLoading={previewLoading}
                  onToggle={onTogglePreview}
                  size={18}
                />
              )}
              {selected && !onTogglePreview && (
                <Ionicons name="checkmark" size={14} color={colors.background} />
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
            {onTogglePreview && (
              <PreviewButton
                voiceId={voice.id}
                isActive={isActive}
                isPlaying={previewPlaying}
                isLoading={previewLoading}
                onToggle={onTogglePreview}
                size={24}
              />
            )}
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
  previewButton: {
    marginLeft: spacing.sm,
    padding: 2,
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
    fontWeight: '500',
    color: alpha(colors.white, 0.6),
  },
  chipTextSelected: {
    color: colors.primary,
    fontWeight: '600',
  },
});
