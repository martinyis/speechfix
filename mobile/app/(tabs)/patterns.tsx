import { ScrollView, View, StyleSheet } from 'react-native';
import { ScreenHeader } from '../../components/ui';
import { colors, spacing } from '../../theme';
import { Set11GlassIconPill } from '../../components/button-showcase';

export default function PatternsScreen() {
  return (
    <View style={styles.container}>
      <ScreenHeader variant="large" title="Button Showcase" />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Set11GlassIconPill />
        <View style={styles.bottomSpacer} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
  },
  bottomSpacer: {
    height: 120,
  },
});
