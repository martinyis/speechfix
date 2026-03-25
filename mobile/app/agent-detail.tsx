import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { colors, alpha, glass, spacing, layout } from '../theme';
import { authFetch } from '../lib/api';
import { useAgentStore } from '../stores/agentStore';
import { useVoices } from '../hooks/useVoices';
import { VoicePicker } from '../components/VoicePicker';
import { AgentAvatar } from '../components/AgentAvatar';
import { ScreenHeader, Button } from '../components/ui';

function generateSeeds(count: number): string[] {
  return Array.from({ length: count }, () => Math.random().toString(36).slice(2, 10));
}

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
  const [avatarSeed, setAvatarSeed] = useState<string | null>(initialAvatarSeed ?? null);
  const [avatarOptions, setAvatarOptions] = useState(() => generateSeeds(8));

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
          <AgentAvatar seed={avatarSeed ?? name} size={72} />
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
          {avatarOptions.map((seed) => (
            <Pressable
              key={seed}
              onPress={() => setAvatarSeed(seed)}
              style={[
                styles.avatarOption,
                avatarSeed === seed && styles.avatarOptionSelected,
              ]}
            >
              <AgentAvatar seed={seed} size={48} />
            </Pressable>
          ))}
        </View>
        <Pressable
          onPress={() => {
            setAvatarOptions(generateSeeds(8));
            setAvatarSeed(null);
          }}
          style={styles.shuffleButton}
        >
          <Ionicons name="shuffle" size={16} color={colors.primary} />
          <Text style={styles.shuffleText}>Shuffle</Text>
        </Pressable>

        <Text style={[styles.label, { marginTop: spacing.xl }]}>VOICE</Text>
        <VoicePicker voices={voices} selectedVoiceId={voiceId} onSelect={setVoiceId} />

        <View style={styles.deleteWrap}>
          <Button
            variant="danger"
            label="Delete Agent"
            icon="trash-outline"
            onPress={handleDelete}
            fullWidth
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
    fontWeight: '700',
    letterSpacing: 1.5,
    color: colors.onSurfaceVariant,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  input: {
    ...glass.card,
    padding: spacing.lg,
    fontSize: 15,
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
  shuffleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    marginTop: spacing.sm,
    paddingVertical: spacing.xs,
  },
  shuffleText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  deleteWrap: {
    marginTop: spacing.xxxl,
  },
});
