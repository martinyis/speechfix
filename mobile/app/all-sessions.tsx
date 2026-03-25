import { View, StyleSheet, SectionList } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSessions } from '../hooks/useSessions';
import { SessionRow } from '../components/SessionRow';
import { ScreenHeader, SectionHeader } from '../components/ui';
import { groupSessionsByDate } from '../lib/sessionHelpers';
import { colors } from '../theme';
import type { SessionListItem } from '../types/session';

export default function AllSessionsScreen() {
  const insets = useSafeAreaInsets();
  const { data: sessions } = useSessions();
  const sections = groupSessionsByDate(sessions ?? []);

  return (
    <View style={styles.container}>
      <ScreenHeader variant="back" title="All Sessions" />
      <SectionList<SessionListItem>
        sections={sections}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: insets.bottom + 24 }}
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeaderWrap}>
            <SectionHeader label={section.title} size="sm" />
          </View>
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
  sectionHeaderWrap: {
    marginTop: 20,
    marginBottom: 10,
    paddingHorizontal: 4,
  },
});
