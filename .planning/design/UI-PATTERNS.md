# Reflexa — UI Patterns & Component Guidelines

> How to build UI in Reflexa. Rules, patterns, and recipes for consistent components.

## Layout Philosophy

**Default to open, flat layouts.** Use spacing, typography, and subtle dividers to create hierarchy — not card wrappers. Most content sits directly on the dark background.

Glass cards are reserved for elements that are **tappable and navigate somewhere** (e.g., session rows, expandable corrections). Everything else — stats, sections, controls, metadata — should be flat.

## Content Row (SessionRow, List Items)

```
[Icon/Badge]   Title                    [Meta]
               Subtitle/Description
               Supporting detail
```

- Left: icon or colored badge/indicator
- Center: text hierarchy (title → subtitle → detail)
- Right: metadata (time, count, chevron)
- Padding: `spacing.lg` (16px), gap: `spacing.md` (12px)
- Separate rows with thin dividers or spacing

### Inline Stat

```
LABEL            ← labelSm, uppercase, muted
42               ← headlineMd, primary or white
description      ← bodySm, muted
```

- Flat on background, horizontal rows (2-3 columns with flex)

### Action Row (Tappable)

```
[Icon]   Title                          [→]
         Description
```

- Pressable with spring feedback + haptic
- Chevron on right edge

## Buttons

### Primary Button

- Background: `colors.primary` (#cc97ff)
- Text: `colors.black` (#000000), `bodyMdMedium`
- Border radius: `borderRadius.lg` (32px) — pill shape
- Padding: `spacing.md` vertical, `spacing.xl` horizontal
- Shadow: `shadows.glow` on press

### Secondary Button

- Background: `alpha(colors.white, 0.08)`
- Border: `alpha(colors.white, 0.12)`, 1px
- Text: `colors.onSurface` (#ffffff), `bodyMdMedium`
- Border radius: `borderRadius.lg` (32px)

### Ghost Button

- Background: transparent
- Text: `colors.primary` (#cc97ff), `bodyMdMedium`
- No border
- Use for tertiary actions, "Show more", "See all"

### Destructive Button

- Background: `alpha(colors.error, 0.15)`
- Text: `colors.error` (#ff6e84)
- Border: `alpha(colors.error, 0.20)`, 1px

## Badges & Pills

### Severity Badge

```typescript
// Pattern for severity-colored badges
const severityColors = {
  error:       { bg: alpha(colors.severityError, 0.15),       text: colors.severityError },
  improvement: { bg: alpha(colors.severityImprovement, 0.15), text: colors.severityImprovement },
  polish:      { bg: alpha(colors.severityPolish, 0.15),      text: colors.severityPolish },
};
```

- Border radius: `borderRadius.sm` (8px)
- Padding: `spacing.xs` vertical, `spacing.sm` horizontal
- Text: `labelSm` (uppercase, 10px, bold)
- Colored dot (6px circle) before text for extra clarity

### Count Pill

- Background: `alpha(colors.white, 0.08)`
- Text: `bodySmMedium`, white
- Border radius: `borderRadius.full`
- Used for: correction counts, filler counts, notification badges

### Filter Chip (active/inactive)

**Inactive:**
- Background: `alpha(colors.white, 0.05)`
- Border: `alpha(colors.white, 0.08)`, 1px
- Text: `onSurfaceVariant`

**Active:**
- Background: `alpha(colors.primary, 0.15)`
- Border: `alpha(colors.primary, 0.25)`, 1px
- Text: `colors.primary`

## Navigation

### Bottom Tab Bar

- Position: floating, absolute bottom with safe area offset
- Shape: pill (`borderRadius.xl` = 48px)
- Background: `glass.navBar` + blur
- Icons: SF Symbols style, outlined when inactive, weight shift when active
- Active indicator: small dot below icon + purple glow shadow
- Animation: fade out during voice session overlay

### Screen Headers

- Background: transparent (no header background)
- Title: `headlineMd`, left-aligned or centered depending on context
- Back button: chevron icon, `colors.onSurface`
- Right actions: icon buttons with `colors.onSurfaceVariant`

### Modal Screens

- Presentation: `'card'` (native push animation)
- Background: `colors.background` (#0e0e0e)
- Close: back chevron, not X (follows iOS conventions)

## Lists & Sections

### Section Header

```
SECTION TITLE                    [Action →]
```

- Text: `labelMd`, uppercase, `onSurfaceVariant`
- Optional right-side action link in `colors.primary`
- Margin bottom: `spacing.md`

### Grouped List with Date Headers

- Section titles: `labelMd`, uppercase, muted
- Items: flat rows separated by spacing or thin dividers
- Gap between items: `spacing.sm` (8px)
- Gap between sections: `spacing.xl` (24px)

## Score Visualization

### Score Ring (ScoreRingHero)

- 60 arc dots arranged in a circle
- Filled dots: first half `colors.primary`, second half `colors.secondary`
- Unfilled dots: `alpha(colors.white, 0.06)` — barely visible
- Center: score number (`headlineLg`), "Clarity" label (`labelSm`)
- Background glow: radial gradient behind ring
- Dynamic headline based on score range

### Score Ranges

| Range   | Headline               | Tone         |
|---------|------------------------|--------------|
| 90-100  | "Excellent Clarity"    | Confident    |
| 75-89   | "Strong Clarity"       | Positive     |
| 60-74   | "Room to Improve"      | Neutral      |
| < 60    | "Needs Attention"      | Direct       |

## Expandable Content

### Correction (Expandable)

```
[●] ERROR  •  Article Usage               [v]

"I went to ___store___ yesterday"
         ↓
  "the store"

▸ Common for speakers whose L1 lacks
  definite articles...
```

- Card IS appropriate here — each correction is a distinct interactive unit
- Severity badge (colored dot + type)
- Context line with error word highlighted (underline or bold)
- Arrow indicator pointing to correction
- Correction shown in pill with `alpha(colors.secondary, 0.15)` background
- Expandable explanation section (collapsed by default)
- Smooth height animation on expand/collapse

## Loading & Progress States

### Analyzing Banner

- Full orbital animation system (Skia Canvas)
- 3 concentric rings rotating at different speeds
- Pulsing core center
- Multi-layer glow halos (purple outer, blue mid, purple inner)
- Cycling status text: "Processing...", "Detecting fillers...", "Checking grammar...", "Generating insights..."

### Skeleton Loading

- Use `alpha(colors.white, 0.05)` rectangles
- Subtle pulse animation (opacity 0.05 → 0.10 → 0.05)
- Match the shape and layout of the content being loaded

### Pull to Refresh

- Standard React Native refresh control
- Tint color: `colors.primary`

## Interaction Feedback

### Press Feedback

All tappable elements use spring animation scale:

```typescript
// Standard press feedback
transform: [{ scale: withSpring(pressed ? 0.97 : 1, { damping: 15, stiffness: 300 }) }]
```

### Haptic Feedback

| Action              | Haptic Type             |
|---------------------|-------------------------|
| Tap interactive element | `ImpactFeedbackStyle.Light` |
| Start recording      | `ImpactFeedbackStyle.Medium` |
| End recording        | `ImpactFeedbackStyle.Medium` |
| Error/warning        | `NotificationFeedbackType.Warning` |
| Success              | `NotificationFeedbackType.Success` |

### Active Tab Indicator

- Animated dot (4px) below icon
- Icon gets purple glow shadow when active
- Spring animation on tab switch

---

*Import all tokens from `@/theme`. Use glass presets as base, customize with `alpha()` helper.*
