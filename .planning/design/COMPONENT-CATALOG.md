# Reflexa — Component Catalog

> Every existing component documented. Use this as reference when building new features.
> All components live in `mobile/components/`.

---

## MicBloomOrb

**File**: `mobile/components/MicBloomOrb.tsx`
**Purpose**: The primary call-to-action on the Home screen. Tap to start a voice session.

### Visual

- Skia Canvas rendering with multi-layer radial gradients
- Layers (back to front):
  1. Full-screen bloom (large radial gradient, very subtle)
  2. Mid-reinforcement glow
  3. Halo ring
  4. Outer ring
  5. Main orb body (solid gradient fill)
  6. Specular highlight (top-left light reflection)
  7. Bottom depth shadow

### Behavior

- Idle: subtle breathing animation
- Tap: triggers `onPress` callback → starts voice session
- During session: replaced by VoiceSessionOverlay

### Usage

```tsx
<MicBloomOrb onPress={handleStartSession} />
```

---

## VoiceSessionOverlay

**File**: `mobile/components/VoiceSessionOverlay.tsx`
**Purpose**: Full-screen overlay during active voice recording. The "full takeover" experience.

### Visual

- Full-screen overlay on top of all content
- Gradient border ring orb with animated bloom
- 5-bar waveform animation inside orb
- Top: "LIVE MODE" badge, timer pill
- Center: orb + state label
- Bottom: Mute and End Session control cards
- Footer: "Secure Connection" trust badge

### States

| State      | Orb Scale     | Glow     | Label      |
|------------|---------------|----------|------------|
| Connecting | 0.98-1.02     | Dim      | Connecting |
| Listening  | 1.0-1.06      | Medium   | Listening  |
| Speaking   | 1.0-1.15      | Bright   | Speaking   |
| Thinking   | Slow rotation  | Muted    | Thinking   |
| Analyzing  | Orbital rings  | Cycling  | Analyzing  |
| Muted      | Static         | Dimmed   | Muted      |

### Props

- Controlled by Zustand store: `isVoiceSessionActive`, `voiceSessionState`, `elapsedTime`, `isMuted`

---

## ScoreRingHero

**File**: `mobile/components/ScoreRingHero.tsx`
**Purpose**: Circular clarity score visualization on session results screen.

### Visual

- 60 arc dots arranged in a circle
- Filled dots gradient: first half `primary` (#cc97ff), second half `secondary` (#699cff)
- Unfilled dots: `alpha(white, 0.06)` — barely visible
- Center: percentage number + "Clarity" label
- Background: radial glow behind ring
- Dynamic headline below based on score range

### Props

```tsx
interface ScoreRingHeroProps {
  score: number;        // 0-100
  animated?: boolean;   // Animate fill from 0
}
```

---

## CorrectionCard

**File**: `mobile/components/CorrectionCard.tsx`
**Purpose**: Displays a single correction with severity, context, fix, and explanation.

### Visual

```
[● ERROR]  •  Article Usage                    [v]
"I went to ___store___ yesterday"
         ↓
  ┌─ "the store" ──────────────────────────┐
  └────────────────────────────────────────┘

▸ Common for speakers whose L1 lacks articles.
  The definite article "the" is required before...
```

### Behavior

- Expandable: tap to reveal/hide explanation
- Severity badge with colored dot
- Error word highlighted in context line
- Correction shown in secondary-colored pill
- Smooth height animation on expand/collapse

### Props

```tsx
interface CorrectionCardProps {
  correction: Correction;  // From session types
  expanded?: boolean;
  onToggle?: () => void;
}
```

---

## SeverityPills

**File**: `mobile/components/SeverityPills.tsx`
**Purpose**: Horizontal filter pills showing error/improvement/polish counts.

### Visual

- Row of pills: "All (N)" | "Errors (N)" | "Improvements (N)" | "Polish (N)"
- Active pill: colored background (severity color at 15% opacity), colored text
- Inactive pill: subtle glass background, muted text

### Props

```tsx
interface SeverityPillsProps {
  counts: { error: number; improvement: number; polish: number };
  active: 'all' | 'error' | 'improvement' | 'polish';
  onSelect: (severity: string) => void;
}
```

---

## CorrectionFilterChips

**File**: `mobile/components/CorrectionFilterChips.tsx`
**Purpose**: Horizontal scrollable filter chips for correction types.

### Behavior

- Hidden if fewer than 2 corrections
- Scroll horizontally if many chips
- Active chip highlighted with primary color

---

## FillerChips

**File**: `mobile/components/FillerChips.tsx`
**Purpose**: Grid display of detected filler words with counts.

### Visual

```
FILLER WORDS          2.3/min
[High Impact]

  "um"    x12     "like"   x8
  "so"    x5      "you know" x3
```

- Section header with frequency per minute
- "High Impact" badge if >= 5 total fillers
- 2-column grid layout
- Color-coded: top 3 use `primary`, `secondary`, `tertiary`

---

## SessionRow

**File**: `mobile/components/SessionRow.tsx`
**Purpose**: Compact card for session history lists.

### Visual

```
┌─────────────────────────────────────────────┐
│  [◆]    2:45 PM              3 corrections  │
│         3m 22s • 2 fillers                   │
│         "I think the main problem with..."   │
└─────────────────────────────────────────────┘
```

- Left: rotated icon with gradient (3 variants: purple/blue, pink/purple, cyan/blue)
- Center: time, duration, filler count, transcript snippet (italic)
- Right: correction count or "Clean" badge
- Glass card background

### Props

```tsx
interface SessionRowProps {
  session: Session;
  onPress: () => void;
}
```

---

## AnalyzingBanner

**File**: `mobile/components/AnalyzingBanner.tsx`
**Purpose**: Animated loading state during session analysis.

### Visual

- Skia Canvas orbital animation:
  - 3 concentric rings rotating at different speeds
  - Pulsing core center dot
  - Multi-layer glow halos (purple outer, blue mid, purple inner)
- Cycling status text below:
  1. "Processing..."
  2. "Detecting fillers..."
  3. "Checking grammar..."
  4. "Generating insights..."

### Usage

```tsx
<AnalyzingBanner visible={isAnalyzing} />
```

---

## SummaryBar

**File**: `mobile/components/SummaryBar.tsx`
**Purpose**: Alternative/legacy session summary layout.

### Visual

```
│ ANALYSIS              ┌──────────┐
│ Session               │   87%    │
│ Analysis.             │  ◯◯◯◯◯  │
│ 3 errors, 2 improve.. └──────────┘
│
│  ● 3 Errors  ● 2 Improvements  ● 1 Polish
```

- Left side: decorative line, labels, headline
- Right side: score ring (140px)
- Bottom: stats row with severity dots and counts

---

## SessionInsightCard

**File**: `mobile/components/SessionInsightCard.tsx`
**Purpose**: Card for deep pattern insights (repetitive words, hedging, discourse patterns).

### Visual

```
┌─────────────────────────────────────────┐
│  DEEP INSIGHTS              [⚡ Impact]  │
│                                         │
│  [🔄]  Repetitive Word Usage            │
│                                         │
│  You used "basically" 7 times in this   │
│  session. Consider varying your...      │
│                                         │
│  ┌──────────────────────────────────┐   │
│  │     Generate Drill          →    │   │
│  └──────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

### Types

| Type              | Icon | Description                    |
|-------------------|------|--------------------------------|
| repetitive_word   | 🔄   | Same word used excessively     |
| hedging_pattern   | ⚖️   | Excessive hedging phrases      |
| discourse_pattern | 🔗   | Discourse markers overused     |

---

## Custom Tab Bar

**File**: `mobile/app/(tabs)/_layout.tsx` (inline)
**Purpose**: Floating glassmorphic bottom navigation.

### Visual

- Floating pill at bottom of screen (safe area offset)
- `glass.navBar` background + blur
- 4 icons: home, chat-bubble, time, person
- Active: purple glow shadow + animated dot indicator
- Fades out during voice session

### Tab Configuration

| Tab      | Icon (Ionicons)   | Label    |
|----------|--------------------|----------|
| Home     | `home-outline`     | Home     |
| Practice | `chatbubble-outline`| Practice |
| Patterns | `time-outline`     | Patterns |
| Profile  | `person-outline`   | Profile  |

**Note**: Navigation model is transitioning to 3 tabs + settings. Profile tab will move to a header icon.

---

## Shared Patterns Across Components

### Color Import Pattern

```typescript
import { colors, typography, spacing, borderRadius, glass, alpha, shadows } from '@/theme';
```

### Glass Card Base

```typescript
const styles = StyleSheet.create({
  container: {
    ...glass.card,
    padding: spacing.lg,
  },
});
```

### Severity Color Lookup

```typescript
const SEVERITY_COLORS = {
  error:       colors.severityError,
  improvement: colors.severityImprovement,
  polish:      colors.severityPolish,
} as const;
```

### Section Header Pattern

```typescript
<Text style={[typography.labelMd, { color: colors.onSurfaceVariant }]}>
  SECTION TITLE
</Text>
```

### Muted Text

```typescript
{ color: alpha(colors.white, 0.50) }  // Tertiary
{ color: alpha(colors.white, 0.70) }  // Secondary
{ color: colors.onSurfaceVariant }     // Named muted
```

---

*All components import from `@/theme`. New components should follow these patterns exactly.*
