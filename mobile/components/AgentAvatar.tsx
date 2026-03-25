import { View, Image, StyleSheet } from 'react-native';
import { colors, alpha } from '../theme';

const DEFAULT_NAME = 'Reflexa';

// DiceBear "glass" style — abstract colorful shapes, premium look
// Palette encoded as hex without # for URL params
const BG_COLORS = 'cc97ff,699cff,ff6daf,34d399';

function avatarUrl(seed: string, size: number): string {
  // Request 2x for retina displays, capped at 256
  const px = Math.min(size * 2, 256);
  return `https://api.dicebear.com/9.x/glass/png?seed=${encodeURIComponent(seed)}&size=${px}&backgroundColor=${BG_COLORS}`;
}

interface AgentAvatarProps {
  /** Seed string for generating unique avatar. null = Reflexa default. */
  seed: string | null;
  /** Diameter in px (default 40) */
  size?: number;
}

/**
 * Deterministic avatar using DiceBear's glass style.
 * Each seed produces a unique abstract design in the Reflexa palette.
 */
export function AgentAvatar({ seed, size = 40 }: AgentAvatarProps) {
  const name = seed ?? DEFAULT_NAME;
  const uri = avatarUrl(name, size);

  return (
    <View style={[styles.container, { width: size, height: size, borderRadius: size / 2 }]}>
      <Image
        source={{ uri }}
        style={{ width: size, height: size }}
        resizeMode="cover"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    backgroundColor: alpha(colors.white, 0.05),
  },
});
