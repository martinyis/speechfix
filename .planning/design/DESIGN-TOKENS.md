# Reflexa — Design Tokens Reference

> Complete reference for all design tokens. Source of truth: `mobile/theme/index.ts`
> Theme name: **Vibrant Glass** — dark glassmorphic with vivid accent colors.

## Colors

### Primary Palette

| Token              | Hex       | Usage                                           |
|--------------------|-----------|------------------------------------------------|
| `primary`          | `#cc97ff` | Main accent — buttons, active states, orb glow, score ring fill |
| `primaryContainer` | `#c284ff` | Brighter variant — hover states, emphasis       |
| `primaryDim`       | `#9c48ea` | Deeper variant — gradients, shadows, secondary emphasis |

### Accent Colors

| Token       | Hex       | Usage                                    |
|-------------|-----------|------------------------------------------|
| `secondary` | `#699cff` | Blue accent — second half of score ring, improvement badges, links |
| `tertiary`  | `#ff6daf` | Pink accent — highlights, alerts, third-tier emphasis |
| `error`     | `#ff6e84` | Error states, destructive actions        |

### Severity System

Used consistently across all correction-related UI:

| Token                | Hex       | Meaning      | Background (15% opacity) |
|----------------------|-----------|--------------|--------------------------|
| `severityError`      | `#ff6e84` | Grammar error | `rgba(255, 110, 132, 0.15)` |
| `severityImprovement`| `#699cff` | Can be better | `rgba(105, 156, 255, 0.15)` |
| `severityPolish`     | `#34d399` | Fine-tuning  | `rgba(52, 211, 153, 0.15)` |

### Surface Hierarchy (Dark Glassmorphic)

Surfaces layer from darkest (background) to brightest. Each level adds subtle depth:

| Token                     | Hex       | Usage                                |
|---------------------------|-----------|--------------------------------------|
| `background`              | `#0e0e0e` | App background, deepest layer        |
| `surface`                 | `#0e0e0e` | Base surface (same as background)    |
| `surfaceContainerLow`     | `#131313` | Recessed containers                  |
| `surfaceContainer`        | `#1a1919` | Standard containers, list backgrounds|
| `surfaceContainerHigh`    | `#201f1f` | Elevated containers, active areas    |
| `surfaceContainerHighest` | `#262626` | Highest elevation, modal backgrounds |
| `surfaceVariant`          | `#262626` | Alternative surface for differentiation |
| `surfaceBright`           | `#2c2c2c` | Brightest opaque surface             |

### Text & Outline Colors

| Token              | Hex       | Usage                              |
|--------------------|-----------|------------------------------------|
| `onSurface`        | `#ffffff` | Primary text on dark surfaces      |
| `onSurfaceVariant` | `#adaaaa` | Secondary/muted text               |
| `outline`          | `#777575` | Borders, dividers, medium emphasis |
| `outlineVariant`   | `#494847` | Subtle borders, low emphasis       |

### Opacity Conventions

When using white text on dark surfaces, follow these opacity levels:

| Purpose           | Opacity | Example                  |
|-------------------|---------|--------------------------|
| Primary text      | 1.0     | Headlines, body copy     |
| Secondary text    | 0.70    | Subtitles, descriptions  |
| Tertiary text     | 0.50    | Timestamps, hints        |
| Disabled text     | 0.35    | Inactive labels          |
| Ghost text        | 0.15    | Placeholders             |

## Typography

### Font Families

| Role      | Font     | Fallback        | Notes                          |
|-----------|----------|-----------------|--------------------------------|
| Headlines | Manrope  | System default   | Extra-bold (800), tight tracking |
| Body      | Inter    | System default   | Regular (400) and medium (500) |
| Labels    | Inter    | System default   | Semi-bold/bold, uppercase, wide tracking |

### Type Scale

#### Display — Manrope 800 (Hero Numbers)

```
displayLg:   44px  letterSpacing: -1.5    — Score numbers, large hero data
displayMd:   36px  letterSpacing: -1.25   — Secondary hero numbers, large stats
```

#### Headlines — Manrope 800

```
headlineLg:  32px  letterSpacing: -1.0    — Page titles, hero numbers
headlineMd:  24px  letterSpacing: -0.75   — Section headers, card titles
headlineSm:  20px  letterSpacing: -0.5    — Sub-headers, dialog titles
```

#### Body — Inter 400/500

```
bodyLg:        17px  weight: 400  — Primary body text, descriptions
bodyMd:        15px  weight: 400  — Standard body text, list items
bodySm:        13px  weight: 400  — Captions, supporting text
bodyMdMedium:  15px  weight: 500  — Emphasized body text
bodySmMedium:  13px  weight: 500  — Emphasized captions
```

#### Labels — Inter 600/700, UPPERCASE

```
labelLg:  14px  weight: 700  letterSpacing: 1.2  — Section labels, tab titles
labelMd:  12px  weight: 600  letterSpacing: 1.0  — Badge labels, chip text
labelSm:  10px  weight: 700  letterSpacing: 0.8  — Micro labels, status indicators
```

**Rule**: Labels are always `textTransform: 'uppercase'`. No exceptions.

## Spacing Scale

| Token  | Value | Usage                                    |
|--------|-------|------------------------------------------|
| `xxs`  | 2px   | Hairline gaps, icon-to-text micro spacing |
| `xs`   | 4px   | Tight element spacing, inline gaps       |
| `sm`   | 8px   | Default inner padding, chip padding      |
| `md`   | 12px  | Card inner padding, between related items |
| `lg`   | 16px  | Standard gap between components          |
| `xl`   | 24px  | Section spacing, screen horizontal padding |
| `xxl`  | 32px  | Major section breaks                     |
| `xxxl` | 48px  | Top-level spacing, above-fold breathing room |

### Layout Constants

| Context               | Value     | Notes                          |
|-----------------------|-----------|--------------------------------|
| Screen horizontal pad | 20-24px   | `spacing.xl` or 20px directly  |
| Card inner padding    | 16px      | `spacing.lg`                   |
| Section gap           | 24-32px   | `spacing.xl` to `spacing.xxl`  |
| Safe area respected   | Always    | Use `useSafeAreaInsets()`       |

## Border Radius

| Token     | Value  | Usage                                |
|-----------|--------|--------------------------------------|
| `sm`      | 8px    | Small chips, inline badges           |
| `default` | 16px   | Standard cards, modals, containers   |
| `lg`      | 32px   | Pills, rounded buttons               |
| `xl`      | 48px   | Navigation bar, fully rounded panels |
| `full`    | 9999px | Circles, dots, avatars               |

## Shadows

All shadows use black (`#000`) base for dark theme compatibility:

| Token  | Opacity | Radius | Elevation | Usage                       |
|--------|---------|--------|-----------|-----------------------------|
| `sm`   | 0.30    | 4px    | 2         | Subtle lift — chips, badges |
| `md`   | 0.35    | 8px    | 4         | Standard — cards, buttons   |
| `lg`   | 0.40    | 16px   | 8         | Prominent — modals, overlays |
| `glow` | 0.25    | 12px   | 6         | Purple glow — active states, orb |

**Glow shadow** uses `primary` (#cc97ff) as `shadowColor` — reserved for interactive/active elements.

## Glass Presets

The signature Vibrant Glass effect uses translucent white overlays on dark backgrounds:

### `glass.card` — Standard Glass Card

```
backgroundColor: rgba(255, 255, 255, 0.05)   — 5% white overlay
borderColor:     rgba(255, 255, 255, 0.10)   — 10% white border
borderWidth:     1
borderRadius:    16  (borderRadius.default)
```

Use for: Session rows, correction cards, stat containers, any content card.

### `glass.cardElevated` — Elevated Glass Card

```
backgroundColor: rgba(255, 255, 255, 0.08)   — 8% white overlay
borderColor:     rgba(255, 255, 255, 0.12)   — 12% white border
borderWidth:     1
borderRadius:    16  (borderRadius.default)
```

Use for: Active/selected cards, modal content, emphasized containers.

### `glass.navBar` — Floating Navigation

```
backgroundColor: rgba(255, 255, 255, 0.06)   — 6% white overlay
borderColor:     rgba(255, 255, 255, 0.10)   — 10% white border
borderWidth:     1
borderRadius:    48  (borderRadius.xl)
```

Use for: Bottom tab bar, floating action bars, pill-shaped navigation.

### Creating Custom Glass Levels

Use the `alpha()` helper for custom opacity levels:

```typescript
import { alpha, colors } from '@/theme';

// Custom glass surface
backgroundColor: alpha(colors.white, 0.03)  // Very subtle
borderColor: alpha(colors.white, 0.07)       // Faint border

// Colored glass (for accent areas)
backgroundColor: alpha(colors.primary, 0.10) // Purple tinted glass
```

## Layout Constants

| Token                  | Value | Usage                              |
|------------------------|-------|------------------------------------|
| `layout.screenPadding` | 20px  | Horizontal padding on all screens  |
| `layout.cardPadding`   | 16px  | Inner padding for cards            |
| `layout.sectionGap`    | 24px  | Vertical gap between sections      |

## Icon Sizes

| Token       | Value | Usage                              |
|-------------|-------|------------------------------------|
| `iconSize.xs`  | 14px | Inline indicators, micro icons     |
| `iconSize.sm`  | 18px | Small icons in badges, chips       |
| `iconSize.md`  | 22px | Standard icons in lists, buttons   |
| `iconSize.lg`  | 28px | Prominent icons, section headers   |
| `iconSize.xl`  | 36px | Feature icons, empty states        |
| `iconSize.xxl` | 48px | Hero icons, orb center             |

## Opacity Presets

For use with the `alpha()` helper:

| Token              | Value | Usage                              |
|--------------------|-------|------------------------------------|
| `opacity.ghost`    | 0.06  | Unfilled dots, ghost elements      |
| `opacity.subtle`   | 0.08  | Glass backgrounds, placeholders    |
| `opacity.light`    | 0.10  | Borders, inactive chips, skeletons |
| `opacity.moderate` | 0.15  | Severity backgrounds, tinted overlays |
| `opacity.medium`   | 0.25  | Hover states, active tints         |
| `opacity.strong`   | 0.50  | Prominent overlays, dimming        |
| `opacity.heavy`    | 0.70  | Scrim, backdrop overlays           |

**Usage pattern:**
```typescript
alpha(colors.primary, opacity.moderate)  // Purple at 15% — severity background
alpha(colors.white, opacity.subtle)      // White at 8% — glass elevated bg
alpha(colors.white, opacity.light)       // White at 10% — glass border
```

## Utility

### `alpha(hex, opacity)` Helper

Converts any hex color to rgba with specified opacity. Essential for the glassmorphic design:

```typescript
alpha('#cc97ff', 0.15)  → 'rgba(204, 151, 255, 0.15)'
alpha('#ffffff', 0.05)  → 'rgba(255, 255, 255, 0.05)'
```

---

*All tokens defined in `mobile/theme/index.ts`. Import via `@/theme`.*
