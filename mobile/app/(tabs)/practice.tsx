import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, alpha, glass, spacing, layout, typography } from '../../theme';
import { useAgents } from '../../hooks/useAgents';
import { useAgentStore } from '../../stores/agentStore';

export default function PracticeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data: agents, isLoading } = useAgents();
  const selectAgent = useAgentStore((s) => s.selectAgent);

  const handleStart = (agentId: number | null, agentName?: string) => {
    selectAgent(agentId);
    // Navigate to home tab where voice session starts — or trigger directly
    router.push({ pathname: '/(tabs)', params: { agentId: agentId?.toString() ?? '', agentName: agentName ?? '' } });
  };

  const handleCreateAgent = () => {
    // Start a voice session in agent-creator mode (agentId = -1 signals creation)
    selectAgent(null);
    router.push({ pathname: '/(tabs)', params: { createAgent: 'true' } });
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Agents</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Default Reflexa card */}
        <Pressable style={styles.card} onPress={() => handleStart(null, 'Reflexa')}>
          <View style={styles.cardIcon}>
            <Ionicons name="sparkles" size={22} color={colors.primary} />
          </View>
          <View style={styles.cardBody}>
            <Text style={styles.cardName}>Reflexa</Text>
            <Text style={styles.cardSub}>Default speech coach</Text>
          </View>
          <Pressable style={styles.startButton} onPress={() => handleStart(null, 'Reflexa')}>
            <Text style={styles.startText}>Start</Text>
          </Pressable>
        </Pressable>

        {/* User agents */}
        {isLoading && (
          <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: spacing.xl }} />
        )}

        {agents?.map((agent) => (
          <Pressable
            key={agent.id}
            style={styles.card}
            onPress={() =>
              router.push({
                pathname: '/agent-detail',
                params: { id: agent.id.toString(), name: agent.name, voiceId: agent.voiceId ?? '' },
              })
            }
          >
            <View style={[styles.cardIcon, { backgroundColor: alpha(colors.secondary, 0.12) }]}>
              <Ionicons name="person" size={20} color={colors.secondary} />
            </View>
            <View style={styles.cardBody}>
              <Text style={styles.cardName}>{agent.name}</Text>
              <Text style={styles.cardSub}>{agent.type}</Text>
            </View>
            <Pressable
              style={styles.startButton}
              onPress={() => handleStart(agent.id, agent.name)}
            >
              <Text style={styles.startText}>Start</Text>
            </Pressable>
          </Pressable>
        ))}

        {/* Create agent card */}
        <Pressable style={styles.createCard} onPress={handleCreateAgent}>
          <View style={styles.createIcon}>
            <Ionicons name="add" size={24} color={colors.primary} />
          </View>
          <Text style={styles.createText}>Create Agent</Text>
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
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  title: {
    ...typography.headlineMd,
    color: colors.onSurface,
  },
  content: {
    padding: layout.screenPadding,
    gap: spacing.md,
    paddingBottom: 100,
  },
  card: {
    ...glass.card,
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    gap: spacing.md,
  },
  cardIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: alpha(colors.primary, 0.12),
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: {
    flex: 1,
    gap: 2,
  },
  cardName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.onSurface,
  },
  cardSub: {
    fontSize: 13,
    color: colors.onSurfaceVariant,
  },
  startButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: alpha(colors.primary, 0.15),
    borderWidth: 1,
    borderColor: alpha(colors.primary, 0.25),
  },
  startText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
  createCard: {
    ...glass.card,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.sm,
    borderStyle: 'dashed',
  },
  createIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: alpha(colors.primary, 0.1),
    alignItems: 'center',
    justifyContent: 'center',
  },
  createText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.primary,
  },
});
