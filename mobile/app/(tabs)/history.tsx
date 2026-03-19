import { View, Text, FlatList, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useSessions } from '../../hooks/useSessions';
import { SessionListItem } from '../../types/session';

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

export default function HistoryScreen() {
  const { data: sessions, isLoading, isError, refetch } = useSessions();

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#000" />
      </View>
    );
  }

  if (isError) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Failed to load sessions</Text>
        <Pressable style={styles.retryButton} onPress={() => refetch()}>
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  if (!sessions || sessions.length === 0) {
    return (
      <View style={styles.centered}>
        <Ionicons name="mic-outline" size={48} color="#999" />
        <Text style={styles.emptyText}>No sessions yet</Text>
      </View>
    );
  }

  const renderItem = ({ item }: { item: SessionListItem }) => {
    const date = new Date(item.createdAt).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    const errors = `${item.errorCount} error${item.errorCount !== 1 ? 's' : ''}`;
    const duration = formatDuration(item.durationSeconds);

    return (
      <Pressable
        style={styles.row}
        onPress={() =>
          router.push({
            pathname: '/history-detail',
            params: { sessionId: String(item.id) },
          })
        }
      >
        <Text style={styles.dateText}>{date}</Text>
        <Text style={styles.metaText}>
          {errors} {'\u00B7'} {duration}
        </Text>
      </Pressable>
    );
  };

  return (
    <FlatList
      data={sessions}
      keyExtractor={(item) => String(item.id)}
      renderItem={renderItem}
      style={styles.list}
      contentContainerStyle={styles.listContent}
    />
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    flex: 1,
    backgroundColor: '#fff',
  },
  listContent: {
    paddingBottom: 16,
  },
  row: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
  },
  dateText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000',
  },
  metaText: {
    fontSize: 14,
    color: '#999',
    marginTop: 4,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginTop: 12,
  },
  errorText: {
    fontSize: 16,
    color: '#000',
    marginBottom: 12,
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#000',
    borderRadius: 8,
  },
  retryText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
});
