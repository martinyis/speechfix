import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { colors, alpha } from '../theme';
import { AgentAvatar } from './AgentAvatar';
import type { Agent } from '../types/session';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AgentSelectorProps {
  agents: Agent[];
  selectedAgentId: number | null;
  onSelectAgent: (id: number | null) => void;
  onCreateAgent: () => void;
  /** Vertical offset from top of screen to the avatar button (e.g. safeAreaInsets.top + 8) */
  topOffset: number;
  /** Horizontal offset from right edge of screen (e.g. 24) */
  rightOffset?: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const AVATAR_SIZE = 40;
const DROPDOWN_WIDTH = 260;
/** Gap between avatar button and dropdown */
const DROPDOWN_GAP = 8;

// ---------------------------------------------------------------------------
// Avatar Button (always visible, top-right)
// ---------------------------------------------------------------------------

interface AvatarButtonProps {
  avatarSeed: string | null;
  agentName: string | null;
  onPress: () => void;
}

function AvatarButton({ avatarSeed, agentName, onPress }: AvatarButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      style={styles.avatarButton}
      accessibilityLabel={
        agentName
          ? `Agent: ${agentName}. Tap to switch`
          : 'Reflexa. Tap to switch agent'
      }
      accessibilityRole="button"
    >
      <AgentAvatar seed={avatarSeed} size={AVATAR_SIZE} />
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Dropdown Row
// ---------------------------------------------------------------------------

interface DropdownRowProps {
  name: string;
  subtitle: string;
  avatarSeed: string | null;
  isSelected: boolean;
  isLast?: boolean;
  onPress: () => void;
}

function DropdownRow({ name, subtitle, avatarSeed, isSelected, isLast, onPress }: DropdownRowProps) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.row,
        isSelected && styles.rowSelected,
        !isLast && styles.rowBorder,
      ]}
      accessibilityLabel={`Select ${name}`}
      accessibilityRole="button"
    >
      <View style={styles.rowIcon}>
        <AgentAvatar seed={avatarSeed} size={28} />
      </View>
      <View style={styles.rowTextWrap}>
        <Text
          style={[styles.rowName, isSelected && { color: colors.primary }]}
          numberOfLines={1}
        >
          {name}
        </Text>
        <Text style={styles.rowSubtitle} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
      {isSelected && (
        <Ionicons name="checkmark" size={18} color={colors.primary} />
      )}
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Create Row
// ---------------------------------------------------------------------------

function CreateRow({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={styles.createRow}
      accessibilityLabel="Create new agent"
      accessibilityRole="button"
    >
      <Ionicons
        name="add"
        size={18}
        color={colors.primary}
        style={styles.rowIcon}
      />
      <Text style={styles.createText}>Create new agent</Text>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function AgentSelector({
  agents,
  selectedAgentId,
  onSelectAgent,
  onCreateAgent,
  topOffset,
  rightOffset = 24,
}: AgentSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Animation shared values
  const dropdownScale = useSharedValue(0.85);
  const dropdownOpacity = useSharedValue(0);

  // Derive display info
  const selectedAgent = useMemo(() => {
    if (selectedAgentId === null) return null;
    return agents.find((a) => a.id === selectedAgentId) ?? null;
  }, [selectedAgentId, agents]);

  // Open/close handlers
  const openDropdown = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsOpen(true);
    dropdownScale.value = 0.85;
    dropdownOpacity.value = 0;
    dropdownScale.value = withTiming(1, { duration: 150 });
    dropdownOpacity.value = withTiming(1, { duration: 150 });
  }, []);

  const closeDropdown = useCallback(() => {
    dropdownScale.value = withTiming(0.85, { duration: 100 });
    dropdownOpacity.value = withTiming(0, { duration: 100 });
    // Delay state change to let animation play
    setTimeout(() => setIsOpen(false), 110);
  }, []);

  const handleSelectAgent = useCallback(
    (id: number | null) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onSelectAgent(id);
      closeDropdown();
    },
    [onSelectAgent, closeDropdown],
  );

  const handleCreateAgent = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onCreateAgent();
    closeDropdown();
  }, [onCreateAgent, closeDropdown]);

  // Animated dropdown style (scale from top-right origin)
  const dropdownAnimStyle = useAnimatedStyle(() => ({
    opacity: dropdownOpacity.value,
    transform: [
      // Shift origin to top-right: translate right, scale, translate back
      { translateX: DROPDOWN_WIDTH / 2 },
      { translateY: -20 },
      { scale: dropdownScale.value },
      { translateX: -DROPDOWN_WIDTH / 2 },
      { translateY: 20 },
    ],
  }));

  return (
    <View style={styles.container}>
      {/* Avatar button */}
      <AvatarButton
        avatarSeed={selectedAgent?.avatarSeed ?? (selectedAgent?.name ?? null)}
        agentName={selectedAgent?.name ?? null}
        onPress={openDropdown}
      />

      {/* Dropdown overlay using Modal for proper z-index above everything */}
      <Modal
        visible={isOpen}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={closeDropdown}
      >
        {/* Full-screen backdrop */}
        <Pressable style={styles.backdrop} onPress={closeDropdown}>
          {/* Dropdown card — positioned top-right, below the avatar */}
          <Animated.View
            style={[
              styles.dropdown,
              {
                top: topOffset + AVATAR_SIZE + DROPDOWN_GAP,
                right: rightOffset,
              },
              dropdownAnimStyle,
            ]}
          >
            <Pressable>
              {/* Reflexa (always first) */}
              <DropdownRow
                name="Reflexa"
                subtitle="Default speech coach"
                avatarSeed={null}
                isSelected={selectedAgentId === null}
                onPress={() => handleSelectAgent(null)}
              />

              {/* Custom agents */}
              {agents.map((agent) => (
                <DropdownRow
                  key={agent.id}
                  name={agent.name}
                  subtitle={agent.type}
                  avatarSeed={agent.avatarSeed ?? agent.name}
                  isSelected={selectedAgentId === agent.id}
                  isLast={false}
                  onPress={() => handleSelectAgent(agent.id)}
                />
              ))}

              {/* Create new agent */}
              <CreateRow onPress={handleCreateAgent} />
            </Pressable>
          </Animated.View>
        </Pressable>
      </Modal>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    // The parent positions this absolutely in the top-right
    zIndex: 100,
  },

  // -- Avatar Button --
  avatarButton: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    overflow: 'hidden',
  },

  // -- Backdrop --
  backdrop: {
    flex: 1,
    backgroundColor: alpha(colors.black, 0.3),
  },

  // -- Dropdown --
  dropdown: {
    position: 'absolute',
    width: DROPDOWN_WIDTH,
    backgroundColor: alpha(colors.background, 0.95),
    borderRadius: 16,
    borderWidth: 1,
    borderColor: alpha(colors.white, 0.1),
    overflow: 'hidden',
    // Shadow for depth
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },

  // -- Row --
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  rowSelected: {
    backgroundColor: alpha(colors.primary, 0.08),
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: alpha(colors.white, 0.06),
  },
  rowIcon: {
    marginRight: 12,
  },
  rowTextWrap: {
    flex: 1,
  },
  rowName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.onSurface,
  },
  rowSubtitle: {
    fontSize: 11,
    fontWeight: '400',
    color: colors.onSurfaceVariant,
    marginTop: 1,
  },

  // -- Create Row --
  createRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: alpha(colors.white, 0.06),
    borderStyle: 'dashed',
  },
  createText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.primary,
  },
});
