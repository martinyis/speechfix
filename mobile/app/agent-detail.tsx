import { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, alpha, glass, spacing, layout } from '../theme';
import { authFetch } from '../lib/api';
import { useAgentStore } from '../stores/agentStore';
import { useVoices } from '../hooks/useVoices';
import { VoicePicker } from '../components/VoicePicker';

export default function AgentDetailScreen() {
  const { id, name: initialName, voiceId: initialVoiceId } = useLocalSearchParams<{
    id: string;
    name: string;
    voiceId: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { data: voices = [] } = useVoices();

  const [name, setName] = useState(initialName ?? '');
  const [voiceId, setVoiceId] = useState<string | null>(initialVoiceId ?? null);

  const updateMutation = useMutation({
    mutationFn: async () => {
      const res = await authFetch(`/agents/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() || undefined, voiceId }),
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
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>Agent Settings</Text>
        <Pressable
          onPress={() => updateMutation.mutate()}
          disabled={updateMutation.isPending}
          hitSlop={12}
        >
          {updateMutation.isPending ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Text style={styles.saveText}>Save</Text>
          )}
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.label}>NAME</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Agent name"
          placeholderTextColor={alpha(colors.white, 0.3)}
        />

        <Text style={[styles.label, { marginTop: spacing.xl }]}>VOICE</Text>
        <VoicePicker voices={voices} selectedVoiceId={voiceId} onSelect={setVoiceId} />

        <Pressable style={styles.deleteButton} onPress={handleDelete}>
          <Ionicons name="trash-outline" size={18} color={colors.error} />
          <Text style={styles.deleteText}>Delete Agent</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: layout.screenPadding,
    paddingVertical: spacing.md,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.onSurface,
  },
  saveText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.primary,
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
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.xxxl,
    paddingVertical: spacing.lg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: alpha(colors.error, 0.2),
    backgroundColor: alpha(colors.error, 0.06),
  },
  deleteText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.error,
  },
});
