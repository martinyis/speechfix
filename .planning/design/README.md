# Reflexa Design System Documentation

> These documents define the soul, visual identity, and interaction patterns of Reflexa.
> **Any agent building features for this app should read these files first.**

## Documents

| File | Purpose | Read When |
|------|---------|-----------|
| [APP-SOUL.md](./APP-SOUL.md) | App identity, brand personality, target audience, core UX loop | Starting any work on Reflexa |
| [DESIGN-TOKENS.md](./DESIGN-TOKENS.md) | Colors, typography, spacing, borders, shadows, glass presets | Building any UI component |
| [UI-PATTERNS.md](./UI-PATTERNS.md) | Card patterns, buttons, badges, lists, navigation, loading states | Building new components |
| [UX-PRINCIPLES.md](./UX-PRINCIPLES.md) | Motion, hierarchy, voice session UX, empty states, accessibility | Designing interactions |
| [COMPONENT-CATALOG.md](./COMPONENT-CATALOG.md) | Every existing component with props, visuals, and usage | Before creating new components (check if one exists) |

## Quick Reference

- **Theme**: "Vibrant Glass" — dark glassmorphic + vivid accents
- **Tokens file**: `mobile/theme/index.ts`
- **Import**: `import { colors, typography, spacing, borderRadius, glass, alpha, shadows } from '@/theme'`
- **Fonts**: Manrope (headlines), Inter/system (body + labels)
- **Primary**: `#cc97ff` (purple), Secondary: `#699cff` (blue), Tertiary: `#ff6daf` (pink)
- **Background**: `#0e0e0e` (near-black)

## Design Principles (TL;DR)

1. Premium AI tool feel — Arc Browser / Linear inspiration
2. Corrections first, score second
3. Technical & precise copy — never bubbly or patronizing
4. Rich animations with purpose — Skia for complex, Reanimated for simple
5. Flat layouts by default — spacing and typography for hierarchy, minimize card wrappers
6. Balanced density — key info upfront, details expandable
