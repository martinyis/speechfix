import { View, Text, StyleSheet, SectionList } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSessions } from '../hooks/useSessions';
import { SessionRow } from '../components/SessionRow';
import { groupSessionsByDate } from '../lib/sessionHelpers';
import { colors, alpha } from '../theme';
import type { SessionListItem } from '../types/session';

export default function AllSessionsScreen() {
  const insets = useSafeAreaInsets();
  const { data: sessions } = useSessions();
  const sections = groupSessionsByDate(sessions ?? []);

  return (
    <View style={styles.container}>
      <SectionList<SessionListItem>
        sections={sections}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: insets.bottom + 24 }}
        renderSectionHeader={({ section }) => (
          <Text style={styles.sectionTitle}>{section.title}</Text>
        )}
        renderItem={({ item }) => <SessionRow item={item} />}
        showsVerticalScrollIndicator={false}
        stickySectionHeadersEnabled={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: alpha(colors.white, 0.5),
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginTop: 20,
    marginBottom: 10,
    paddingHorizontal: 4,
  },
});
