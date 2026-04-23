import { ImageSourcePropType } from 'react-native';

// ── Avatar IDs ──────────────────────────────────────────────────────────────

export type AvatarId = 'reflexa' | 'f2' | 'f3' | 'f4' | 'f5' | 'f6' | 'f7' | 'f8' | 'm1' | 'm2' | 'm3' | 'm4' | 'm5' | 'm6' | 'm7' | 'm8';

export const ALL_AVATAR_IDS: AvatarId[] = [
  'reflexa', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8', 'm1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7', 'm8',
];

export const DEFAULT_AVATAR_ID: AvatarId = 'reflexa';

// ── Image registry (static requires) ────────────────────────────────────────

const IMAGES: Record<AvatarId, ImageSourcePropType> = {
  reflexa: require('../assets/images/avatars/reflexa.png'),
  f2: require('../assets/images/avatars/f2.png'),
  f3: require('../assets/images/avatars/f3.png'),
  f4: require('../assets/images/avatars/f4.png'),
  f5: require('../assets/images/avatars/f5.png'),
  m1: require('../assets/images/avatars/m1.png'),
  m2: require('../assets/images/avatars/m2.png'),
  m3: require('../assets/images/avatars/m3.png'),
  m4: require('../assets/images/avatars/m4.png'),
  m5: require('../assets/images/avatars/m5.png'),
  m6: require('../assets/images/avatars/m6.png'),
  m7: require('../assets/images/avatars/m7.png'),
  m8: require('../assets/images/avatars/m8.png'),
  f6: require('../assets/images/avatars/f6.png'),
  f7: require('../assets/images/avatars/f7.png'),
  f8: require('../assets/images/avatars/f8.png'),
};

export function getAvatarImage(id: AvatarId): ImageSourcePropType {
  return IMAGES[id];
}

// ── Gradient registry ───────────────────────────────────────────────────────

export interface AvatarGradient {
  colors: [string, string, string];
  start: { x: number; y: number };
  end: { x: number; y: number };
}

const GRADIENTS: Record<AvatarId, AvatarGradient> = {
  reflexa: { colors: ['#cc97ff', '#7c3aed', '#2e1065'], start: { x: 0.1, y: 0 }, end: { x: 0.9, y: 1 } },
  f2:      { colors: ['#f472b6', '#be185d', '#500724'], start: { x: 0.1, y: 0 }, end: { x: 0.9, y: 1 } },
  f3:      { colors: ['#a78bfa', '#6d28d9', '#1e1b4b'], start: { x: 0.1, y: 0 }, end: { x: 0.9, y: 1 } },
  f4:      { colors: ['#fb923c', '#c2410c', '#431407'], start: { x: 0.1, y: 0 }, end: { x: 0.9, y: 1 } },
  f5:      { colors: ['#699cff', '#2563eb', '#172554'], start: { x: 0.1, y: 0 }, end: { x: 0.9, y: 1 } },
  m1:      { colors: ['#818cf8', '#4338ca', '#1e1b4b'], start: { x: 0.1, y: 0 }, end: { x: 0.9, y: 1 } },
  m2:      { colors: ['#34d399', '#059669', '#022c22'], start: { x: 0.1, y: 0 }, end: { x: 0.9, y: 1 } },
  m3:      { colors: ['#f97316', '#c2410c', '#431407'], start: { x: 0.1, y: 0 }, end: { x: 0.9, y: 1 } },
  m4:      { colors: ['#38bdf8', '#0369a1', '#082f49'], start: { x: 0.1, y: 0 }, end: { x: 0.9, y: 1 } },
  m5:      { colors: ['#94a3b8', '#475569', '#0f172a'], start: { x: 0.1, y: 0 }, end: { x: 0.9, y: 1 } },
  m6:      { colors: ['#fbbf24', '#b45309', '#451a03'], start: { x: 0.1, y: 0 }, end: { x: 0.9, y: 1 } },
  m7:      { colors: ['#2dd4bf', '#0d9488', '#042f2e'], start: { x: 0.1, y: 0 }, end: { x: 0.9, y: 1 } },
  m8:      { colors: ['#a3e635', '#65a30d', '#1a2e05'], start: { x: 0.1, y: 0 }, end: { x: 0.9, y: 1 } },
  f6:      { colors: ['#fb7185', '#e11d48', '#4c0519'], start: { x: 0.1, y: 0 }, end: { x: 0.9, y: 1 } },
  f7:      { colors: ['#e879f9', '#a21caf', '#4a044e'], start: { x: 0.1, y: 0 }, end: { x: 0.9, y: 1 } },
  f8:      { colors: ['#f97171', '#dc2626', '#450a0a'], start: { x: 0.1, y: 0 }, end: { x: 0.9, y: 1 } },
};

export function getAvatarGradient(id: AvatarId): AvatarGradient {
  return GRADIENTS[id];
}

// ── System mode avatars ─────────────────────────────────────────────────────

export const SYSTEM_MODE_AVATARS: Record<string, AvatarId> = {
  conversation: 'reflexa',
  onboarding: 'reflexa',
  'agent-creator': 'f6',
};

/**
 * Resolve the avatar for a voice session.
 * Priority: explicit agent seed → system mode map → reflexa fallback.
 */
export function getSessionAvatarId(mode?: string, agentAvatarSeed?: string | null): AvatarId {
  if (agentAvatarSeed) return resolveAvatarId(agentAvatarSeed);
  if (mode && SYSTEM_MODE_AVATARS[mode]) return SYSTEM_MODE_AVATARS[mode];
  return DEFAULT_AVATAR_ID;
}

// ── Seed → AvatarId resolution ──────────────────────────────────────────────

const ID_SET = new Set<string>(ALL_AVATAR_IDS);

/** Simple string hash → index */
function hashToIndex(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h) % ALL_AVATAR_IDS.length;
}

/**
 * Resolve any seed string to a valid AvatarId.
 * - null/undefined → DEFAULT_AVATAR_ID (reflexa)
 * - Already a valid AvatarId → pass through
 * - Legacy DiceBear seed → deterministic hash pick
 */
export function resolveAvatarId(seed: string | null | undefined): AvatarId {
  if (!seed) return DEFAULT_AVATAR_ID;
  if (ID_SET.has(seed)) return seed as AvatarId;
  return ALL_AVATAR_IDS[hashToIndex(seed)];
}
