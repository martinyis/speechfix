import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { colors, alpha, glass, spacing, layout, fonts } from '../theme';
import { authFetch } from '../lib/api';
import { useAgentStore } from '../stores/agentStore';
import { useVoices } from '../hooks/useVoices';
import { useVoicePreview } from '../hooks/useVoicePreview';
import { VoicePicker } from '../components/agent/VoicePicker';
import { AgentAvatar } from '../components/agent/AgentAvatar';
import { ALL_AVATAR_IDS, resolveAvatarId, type AvatarId } from '../lib/avatars';
import { ScreenHeader, GlassIconPillButton } from '../components/ui';

export default function AgentDetailScreen() {
  const { id, name: initialName, voiceId: initialVoiceId, avatarSeed: initialAvatarSeed } = useLocalSearchParams<{
    id: string;
    name: string;
    voiceId: string;
    avatarSeed: string;
  }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: voices = [] } = useVoices();

  const [name, setName] = useState(initialName ?? '');
  const [voiceId, setVoiceId] = useState<string | null>(initialVoiceId ?? null);
  const [avatarSeed, setAvatarSeed] = useState<AvatarId>(
    resolveAvatarId(initialAvatarSeed ?? null),
  );
  const voicePreview = useVoicePreview();

  const updateMutation = useMutation({
    mutationFn: async () => {
      const res = await authFetch(`/agents/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() || undefined, voiceId, avatarSeed }),
      });
      if (!res.ok) throw new Error('Failed to update agent');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] });
      router.back();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await authFetch(`/agents/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete agent');
    },
    onSuccess: () => {
      useAgentStore.getState().removeAgent(Number(id));
      queryClient.invalidateQueries({ queryKey: ['agents'] });
      router.back();
    },
  });

  const handleDelete = () => {
    Alert.alert('Delete Agent', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate() },
    ]);
  };

  return (
    <View style={styles.container}>
      <ScreenHeader
        variant="modal"
        title="Agent Settings"
        rightAction={{
          label: 'Save',
          onPress: () => updateMutation.mutate(),
          loading: updateMutation.isPending,
        }}
      />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.avatarHeader}>
          <AgentAvatar seed={avatarSeed} size={72} />
        </View>

        <Text style={styles.label}>NAME</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Agent name"
          placeholderTextColor={alpha(colors.white, 0.3)}
        />

        <Text style={[styles.label, { marginTop: spacing.xl }]}>AVATAR</Text>
        <View style={styles.avatarGrid}>
          {ALL_AVATAR_IDS.map((id) => (
            <Pressable
              key={id}
              onPress={() => setAvatarSeed(id)}
              style={[
                styles.avatarOption,
                avatarSeed === id && styles.avatarOptionSelected,
              ]}
            >
              <AgentAvatar seed={id} size={48} />
            </Pressable>
          ))}
        </View>

        <Text style={[styles.label, { marginTop: spacing.xl }]}>VOICE</Text>
        <VoicePicker
          voices={voices}
          selectedVoiceId={voiceId}
          onSelect={setVoiceId}
          previewVoiceId={voicePreview.activeVoiceId}
          previewPlaying={voicePreview.isPlaying}
          previewLoading={voicePreview.isLoading}
          onTogglePreview={voicePreview.toggle}
        />

        <View style={styles.deleteWrap}>
          <GlassIconPillButton
            variant="danger"
            fullWidth
            label="Delete Agent"
            icon="trash-outline"
            onPress={handleDelete}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: layout.screenPadding,
    paddingBottom: 60,
  },
  label: {
    fontSize: 10,
    fontFamily: fonts.bold,
    letterSpacing: 1.5,
    color: colors.onSurfaceVariant,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  input: {
    ...glass.card,
    padding: spacing.lg,
    fontSize: 15,
    fontFamily: fonts.regular,
    color: colors.onSurface,
  },
  avatarHeader: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  avatarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  avatarOption: {
    borderRadius: 28,
    padding: 4,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  avatarOptionSelected: {
    borderColor: colors.primary,
  },
  deleteWrap: {
    marginTop: spacing.xxxl,
  },
});
