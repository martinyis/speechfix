import { View, Image, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { resolveAvatarId, getAvatarImage, getAvatarGradient } from '../lib/avatars';

interface AgentAvatarProps {
  /** Seed string for avatar selection. null = Reflexa default. */
  seed: string | null;
  /** Diameter in px (default 40) */
  size?: number;
}

/**
 * Local character avatar with gradient background.
 * Resolves any seed (including legacy DiceBear strings) to one of 9 character images.
 */
export function AgentAvatar({ seed, size = 40 }: AgentAvatarProps) {
  const id = resolveAvatarId(seed);
  const image = getAvatarImage(id);
  const gradient = getAvatarGradient(id);
  const radius = size / 2;

  return (
    <View style={[styles.container, { width: size, height: size, borderRadius: radius }]}>
      <LinearGradient
        colors={gradient.colors}
        start={gradient.start}
        end={gradient.end}
        style={[StyleSheet.absoluteFill, { borderRadius: radius }]}
      />
      <Image
        source={image}
        style={{ width: size, height: size }}
        resizeMode="cover"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
