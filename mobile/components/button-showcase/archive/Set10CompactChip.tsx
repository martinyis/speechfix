import React from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, alpha, borderRadius, typography, glass } from '@/theme';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ChipVariant = 'primary' | 'secondary' | 'tinted' | 'danger' | 'tag';
type ChipShape = 'chip' | 'pill';
type ButtonSize = 'default' | 'small';

interface CompactChipProps {
  label: string;
  variant?: ChipVariant;
  shape?: ChipShape;
  size?: ButtonSize;
  icon?: keyof typeof Ionicons.glyphMap;
  loading?: boolean;
  disabled?: boolean;
  onPress?: () => void;
}

// ---------------------------------------------------------------------------
// Variant style definitions
// ---------------------------------------------------------------------------

interface ChipVariantDef {
  bg: string;
  borderColor: string;
  borderWidth: number;
  textColor: string;
  darkText?: boolean; // for solid backgrounds where dark text reads better
}

const variantDefs: Record<ChipVariant, ChipVariantDef> = {
  primary: {
    bg: colors.primary,
    borderColor: 'transparent',
    borderWidth: 0,
    textColor: colors.black,
    darkText: true,
  },
  secondary: {
    bg: glass.card.backgroundColor as string,
    borderColor: glass.card.borderColor as string,
    borderWidth: 1,
    textColor: colors.onSurfaceVariant,
  },
  tinted: {
    bg: alpha(colors.primary, 0.10),
    borderColor: alpha(colors.primary, 0.15),
    borderWidth: 1,
    textColor: colors.primary,
  },
  danger: {
    bg: alpha(colors.error, 0.10),
    borderColor: alpha(colors.error, 0.12),
    borderWidth: 1,
    textColor: colors.error,
  },
  tag: {
    bg: 'transparent',
    borderColor: colors.outlineVariant,
    borderWidth: 1,
    textColor: colors.onSurfaceVariant,
  },
};

// ---------------------------------------------------------------------------
// CompactChip
// ---------------------------------------------------------------------------

function CompactChip({
  label,
  variant = 'primary',
  shape = 'chip',
  size = 'default',
  icon,
  loading = false,
  disabled = false,
  onPress,
}: CompactChipProps) {
  const def = variantDefs[variant];
  const radius = shape === 'pill' ? borderRadius.full : borderRadius.sm;
  const isSmall = size === 'small';

  const foreground = disabled ? alpha(def.textColor, 0.35) : def.textColor;

  const chipStyle: ViewStyle = {
    backgroundColor: disabled ? alpha(def.bg, 0.4) : def.bg,
    borderColor: disabled ? alpha(def.borderColor, 0.3) : def.borderColor,
    borderWidth: def.borderWidth,
    borderRadius: radius,
    paddingVertical: isSmall ? 4 : 6,
    paddingHorizontal: isSmall ? 10 : 14,
  };

  const iconSz = isSmall ? 12 : 14;
  const textStyle = isSmall ? styles.textSmall : styles.textDefault;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        chipStyle,
        styles.chipBase,
        pressed && !disabled && { opacity: 0.8 },
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={foreground} style={styles.loader} />
      ) : (
        <View style={styles.innerRow}>
          {icon && (
            <Ionicons
              name={icon}
              size={iconSz}
              color={foreground}
              style={{ marginRight: spacing.xs }}
            />
          )}
          <Text style={[textStyle, { color: foreground }]}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Showcase rows
// ---------------------------------------------------------------------------

interface RowConfig {
  title: string;
  variant: ChipVariant;
  icon: keyof typeof Ionicons.glyphMap;
}

const rows: RowConfig[] = [
  { title: 'Primary (Solid)', variant: 'primary', icon: 'checkmark' },
  { title: 'Secondary (Glass)', variant: 'secondary', icon: 'options' },
  { title: 'Tinted (Primary 10%)', variant: 'tinted', icon: 'sparkles' },
  { title: 'Danger (Error 10%)', variant: 'danger', icon: 'alert-circle' },
  { title: 'Tag (Outlined)', variant: 'tag', icon: 'pricetag' },
];

function VariantRow({ title, variant, icon }: RowConfig) {
  return (
    <View style={styles.rowContainer}>
      <Text style={styles.rowLabel}>{title}</Text>
      <View style={styles.row}>
        <CompactChip label="Action" variant={variant} />
        <CompactChip label="Icon" variant={variant} icon={icon} />
        <CompactChip label="Sm" variant={variant} size="small" />
        <CompactChip label="Off" variant={variant} disabled />
        <CompactChip label="Wait" variant={variant} loading />
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Pill variant showcase
// ---------------------------------------------------------------------------

function PillRow() {
  return (
    <View style={styles.rowContainer}>
      <Text style={styles.rowLabel}>Pill Shape (borderRadius.full)</Text>
      <View style={styles.row}>
        <CompactChip label="Primary" variant="primary" shape="pill" />
        <CompactChip label="Tinted" variant="tinted" shape="pill" icon="sparkles" />
        <CompactChip label="Tag" variant="tag" shape="pill" />
        <CompactChip label="Danger" variant="danger" shape="pill" />
        <CompactChip label="Glass" variant="secondary" shape="pill" />
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Action bar demo -- horizontal scrollable row of chips
// ---------------------------------------------------------------------------

function ActionBarDemo() {
  const actions: { label: string; variant: ChipVariant; icon: keyof typeof Ionicons.glyphMap; shape?: ChipShape }[] = [
    { label: 'All', variant: 'primary', icon: 'grid', shape: 'pill' },
    { label: 'Grammar', variant: 'tinted', icon: 'text', shape: 'pill' },
    { label: 'Pronunciation', variant: 'tinted', icon: 'mic', shape: 'pill' },
    { label: 'Vocabulary', variant: 'tag', icon: 'book', shape: 'pill' },
    { label: 'Fluency', variant: 'tag', icon: 'pulse', shape: 'pill' },
    { label: 'Clarity', variant: 'tag', icon: 'eye', shape: 'pill' },
    { label: 'Delete', variant: 'danger', icon: 'trash', shape: 'pill' },
  ];

  return (
    <View style={styles.actionBarContainer}>
      <Text style={styles.rowLabel}>Action Bar (Scrollable)</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.actionBarContent}
      >
        {actions.map((action, idx) => (
          <CompactChip
            key={idx}
            label={action.label}
            variant={action.variant}
            icon={action.icon}
            shape={action.shape ?? 'chip'}
          />
        ))}
      </ScrollView>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Default export -- full showcase
// ---------------------------------------------------------------------------

export default function Set10CompactChip() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Compact Chip</Text>
      <Text style={styles.subtitle}>
        Dense, compact chip buttons for toolbars, filter bars, and tag systems.
      </Text>

      {rows.map((row) => (
        <VariantRow key={row.variant} {...row} />
      ))}

      <PillRow />
      <ActionBarDemo />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxxl,
    paddingBottom: spacing.xxxl,
  },
  title: {
    ...typography.headlineSm,
    color: colors.white,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.bodySm,
    color: colors.onSurfaceVariant,
    marginBottom: spacing.xxl,
  },

  // --- Row ---
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

  // --- Chip base ---
  chipBase: {
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  innerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loader: {
    transform: [{ scale: 0.7 }],
  },

  // --- Text ---
  textDefault: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  textSmall: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.1,
  },

  // --- Action bar ---
  actionBarContainer: {
    marginBottom: spacing.xl,
  },
  actionBarContent: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingRight: spacing.xl,
  },
});
