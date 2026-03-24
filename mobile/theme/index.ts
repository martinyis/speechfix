// Reflexa Design Tokens — "Vibrant Glass" design system
// Dark glassmorphic theme with vivid accent colors

// ---------------------------------------------------------------------------
// Colors
// ---------------------------------------------------------------------------

export const colors = {
  // Primary (purple)
  primary: '#cc97ff',
  primaryContainer: '#c284ff',
  primaryDim: '#9c48ea',

  // Secondary (blue)
  secondary: '#699cff',

  // Tertiary (pink)
  tertiary: '#ff6daf',

  // Error
  error: '#ff6e84',

  // Surface hierarchy (dark glassmorphic)
  background: '#0e0e0e',
  surface: '#0e0e0e',
  surfaceContainer: '#1a1919',
  surfaceContainerLow: '#131313',
  surfaceContainerHigh: '#201f1f',
  surfaceContainerHighest: '#262626',
  surfaceVariant: '#262626',
  surfaceBright: '#2c2c2c',

  // On-surface
  onSurface: '#ffffff',
  onSurfaceVariant: '#adaaaa',

  // Outline
  outline: '#777575',
  outlineVariant: '#494847',

  // Severity (for corrections/issues)
  severityError: '#ff6e84',
  severityImprovement: '#699cff',
  severityPolish: '#34d399',

  // Utility
  transparent: 'transparent',
  white: '#ffffff',
  black: '#000000',
} as const;

// ---------------------------------------------------------------------------
// Typography
// ---------------------------------------------------------------------------

export const typography = {
  // Display — Manrope 800, extra large for hero numbers
  displayLg: {
    fontSize: 44,
    fontWeight: '800' as const,
    letterSpacing: -1.5,
    fontFamily: 'Manrope',
  },
  displayMd: {
    fontSize: 36,
    fontWeight: '800' as const,
    letterSpacing: -1.25,
    fontFamily: 'Manrope',
  },

  // Headlines — Manrope 800, tight tracking
  headlineLg: {
    fontSize: 32,
    fontWeight: '800' as const,
    letterSpacing: -1,
    fontFamily: 'Manrope',
  },
  headlineMd: {
    fontSize: 24,
    fontWeight: '800' as const,
    letterSpacing: -0.75,
    fontFamily: 'Manrope',
  },
  headlineSm: {
    fontSize: 20,
    fontWeight: '800' as const,
    letterSpacing: -0.5,
    fontFamily: 'Manrope',
  },

  // Body — Inter / system, 400-500
  bodyLg: {
    fontSize: 17,
    fontWeight: '400' as const,
    letterSpacing: 0,
  },
  bodyMd: {
    fontSize: 15,
    fontWeight: '400' as const,
    letterSpacing: 0,
  },
  bodySm: {
    fontSize: 13,
    fontWeight: '400' as const,
    letterSpacing: 0,
  },
  bodyMdMedium: {
    fontSize: 15,
    fontWeight: '500' as const,
    letterSpacing: 0,
  },
  bodySmMedium: {
    fontSize: 13,
    fontWeight: '500' as const,
    letterSpacing: 0,
  },

  // Labels — Inter / system, 600-700, wide tracking, uppercase
  labelLg: {
    fontSize: 14,
    fontWeight: '700' as const,
    letterSpacing: 1.2,
    textTransform: 'uppercase' as const,
  },
  labelMd: {
    fontSize: 12,
    fontWeight: '600' as const,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
  },
  labelSm: {
    fontSize: 10,
    fontWeight: '700' as const,
    letterSpacing: 0.8,
    textTransform: 'uppercase' as const,
  },
} as const;

// ---------------------------------------------------------------------------
// Spacing
// ---------------------------------------------------------------------------

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

// ---------------------------------------------------------------------------
// Layout constants (commonly repeated values)
// ---------------------------------------------------------------------------

export const layout = {
  /** Standard horizontal screen padding */
  screenPadding: 20,
  /** Standard card inner padding */
  cardPadding: 16,
  /** Standard section gap */
  sectionGap: 24,
} as const;

// ---------------------------------------------------------------------------
// Icon sizes
// ---------------------------------------------------------------------------

export const iconSize = {
  xs: 14,
  sm: 18,
  md: 22,
  lg: 28,
  xl: 36,
  xxl: 48,
} as const;

// ---------------------------------------------------------------------------
// Opacity presets (for alpha() helper)
// ---------------------------------------------------------------------------

export const opacity = {
  /** Barely visible — unfilled dots, ghost elements */
  ghost: 0.06,
  /** Very subtle — glass backgrounds, placeholder shapes */
  subtle: 0.08,
  /** Light — borders, inactive chips, skeleton loading */
  light: 0.10,
  /** Moderate — severity backgrounds, tinted overlays */
  moderate: 0.15,
  /** Medium — hover states, active tints */
  medium: 0.25,
  /** Strong — prominent overlays, dimming */
  strong: 0.50,
  /** Heavy — scrim, backdrop overlays */
  heavy: 0.70,
} as const;

// ---------------------------------------------------------------------------
// Border Radius
// ---------------------------------------------------------------------------

export const borderRadius = {
  sm: 8,
  default: 16,
  lg: 32,
  xl: 48,
  full: 9999,
} as const;

// ---------------------------------------------------------------------------
// Shadows (soft, diffused — suited for dark glassmorphic UI)
// ---------------------------------------------------------------------------

export const shadows = {
  sm: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  glow: {
    shadowColor: '#cc97ff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
} as const;

// ---------------------------------------------------------------------------
// Glass presets (raw values for composing glass effects)
// ---------------------------------------------------------------------------

export const glass = {
  /** Standard glass card — white/5 bg, white/10 border */
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderColor: 'rgba(255, 255, 255, 0.10)',
    borderWidth: 1,
    borderRadius: borderRadius.default,
  },
  /** Elevated glass — slightly brighter, white/8 bg, white/12 border */
  cardElevated: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 1,
    borderRadius: borderRadius.default,
  },
  /** Floating nav bar glass */
  navBar: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderColor: 'rgba(255, 255, 255, 0.10)',
    borderWidth: 1,
    borderRadius: borderRadius.xl,
  },
} as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert a hex color + opacity into an rgba string */
export function alpha(hex: string, opacity: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}
