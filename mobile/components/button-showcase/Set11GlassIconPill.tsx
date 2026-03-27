import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  colors,
  spacing,
  typography,
} from '@/theme';
import { GlassIconPillButton } from '../ui/GlassIconPillButton';

// ---------------------------------------------------------------------------
// Showcase rows
// ---------------------------------------------------------------------------

type Variant = 'primary' | 'secondary' | 'success' | 'danger';

interface RowConfig {
  title: string;
  variant: Variant;
  icon: keyof typeof Ionicons.glyphMap;
}

const rows: RowConfig[] = [
  { title: 'Primary', variant: 'primary', icon: 'sparkles' },
  { title: 'Secondary', variant: 'secondary', icon: 'settings-outline' },
  { title: 'Success', variant: 'success', icon: 'checkmark-sharp' },
  { title: 'Danger', variant: 'danger', icon: 'trash-outline' },
];

function VariantRow({ title, variant, icon }: RowConfig) {
  return (
    <View style={styles.rowContainer}>
      <Text style={styles.rowLabel}>{title}</Text>
      <View style={styles.row}>
        <GlassIconPillButton label={title} icon={icon} variant={variant} />
        <GlassIconPillButton label="Sm" icon={icon} variant={variant} small />
        <GlassIconPillButton label="Off" icon={icon} variant={variant} disabled />
        <GlassIconPillButton label="Wait" icon={icon} variant={variant} loading />
        <GlassIconPillButton label="" icon={icon} variant={variant} iconOnly />
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Interactive demo sections
// ---------------------------------------------------------------------------

function TogglePairDemo() {
  const [on, setOn] = useState(true);
  return (
    <View style={styles.rowContainer}>
      <Text style={styles.rowLabel}>Toggle On / Off</Text>
      <View style={styles.row}>
        <GlassIconPillButton
          label={on ? 'Notifications On' : 'Notifications Off'}
          icon={on ? 'notifications' : 'notifications-off-outline'}
          active={on}
          onPress={() => setOn((v) => !v)}
        />
        <GlassIconPillButton
          label={!on ? 'Notifications On' : 'Notifications Off'}
          icon={!on ? 'notifications' : 'notifications-off-outline'}
          active={!on}
          onPress={() => setOn((v) => !v)}
        />
      </View>
    </View>
  );
}

function PairedActionsDemo() {
  const [loading, setLoading] = useState(false);
  const handleConfirm = useCallback(() => {
    setLoading(true);
    setTimeout(() => setLoading(false), 1500);
  }, []);

  return (
    <View style={styles.rowContainer}>
      <Text style={styles.rowLabel}>Paired Actions</Text>
      <View style={styles.pairedRow}>
        <View style={styles.pairedButton}>
          <GlassIconPillButton label="Cancel" icon="close" variant="secondary" fullWidth />
        </View>
        <View style={styles.pairedButton}>
          <GlassIconPillButton
            label="Confirm"
            icon="checkmark"
            variant="primary"
            fullWidth
            loading={loading}
            onPress={handleConfirm}
          />
        </View>
      </View>
    </View>
  );
}

function DestructiveDemo() {
  const [loading, setLoading] = useState(false);
  const handleDelete = useCallback(() => {
    setLoading(true);
    setTimeout(() => setLoading(false), 1000);
  }, []);

  return (
    <View style={styles.rowContainer}>
      <Text style={styles.rowLabel}>Destructive</Text>
      <View style={styles.column}>
        <GlassIconPillButton
          label="Delete Account"
          icon="trash-outline"
          variant="danger"
          fullWidth
          loading={loading}
          onPress={handleDelete}
        />
        <View style={styles.destructiveCancelRow}>
          <GlassIconPillButton label="Cancel" icon="close" variant="secondary" small />
        </View>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Default export
// ---------------------------------------------------------------------------

export default function Set11GlassIconPill() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Set 11 — Glass Icon Pill</Text>
      <Text style={styles.subtitle}>
        Frosted glass pills with colored icon circles. Combines glassmorphic
        depth with icon-forward emphasis.
      </Text>

      {rows.map((row) => (
        <VariantRow key={row.variant} {...row} />
      ))}

      {/* Full-Width CTAs */}
      <View style={styles.rowContainer}>
        <Text style={styles.rowLabel}>Full Width</Text>
        <View style={styles.column}>
          <GlassIconPillButton label="Start Practice Session" icon="mic-outline" variant="primary" fullWidth />
          <GlassIconPillButton label="Continue" icon="arrow-forward" variant="secondary" fullWidth />
          <GlassIconPillButton label="Log Out" icon="log-out-outline" variant="danger" fullWidth />
        </View>
      </View>

      <TogglePairDemo />
      <PairedActionsDemo />

      {/* Text-Only / Ghost */}
      <View style={styles.rowContainer}>
        <Text style={styles.rowLabel}>Text Only</Text>
        <View style={styles.row}>
          <GlassIconPillButton label="Skip" icon="arrow-forward" variant="secondary" noIcon />
          <GlassIconPillButton label="View All" icon="arrow-forward" variant="primary" noIcon />
          <GlassIconPillButton label="Forgot Password" icon="arrow-forward" variant="secondary" noIcon small />
        </View>
      </View>

      {/* Icon Toolbar */}
      <View style={styles.rowContainer}>
        <Text style={styles.rowLabel}>Icon Toolbar</Text>
        <View style={styles.row}>
          <GlassIconPillButton label="" icon="play" variant="primary" iconOnly />
          <GlassIconPillButton label="" icon="pause" variant="secondary" iconOnly />
          <GlassIconPillButton label="" icon="stop" variant="danger" iconOnly />
          <GlassIconPillButton label="" icon="refresh" variant="secondary" iconOnly small />
          <GlassIconPillButton label="" icon="share-outline" variant="secondary" iconOnly small />
          <GlassIconPillButton label="" icon="bookmark-outline" variant="primary" iconOnly small />
        </View>
      </View>

      <DestructiveDemo />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.xl,
  },
  title: {
    ...typography.headlineSm,
    color: colors.onSurface,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.bodySm,
    color: colors.onSurfaceVariant,
    marginBottom: spacing.xxl,
  },
  rowContainer: {
    marginBottom: spacing.xl,
  },
  rowLabel: {
    ...typography.labelMd,
    color: colors.onSurfaceVariant,
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    alignItems: 'center',
  },
  column: {
    gap: spacing.sm,
  },
  pairedRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  pairedButton: {
    flex: 1,
  },
  destructiveCancelRow: {
    alignSelf: 'center',
  },
});
