# Reflexa — UX Principles

> How the app behaves, moves, and communicates. The experience layer on top of visual design.

## Core UX Principles

### 1. Precision Over Encouragement

Reflexa is an instrument, not a cheerleader. Every piece of information should be precise, measurable, and actionable. "Your filler rate is 2.3/min" not "You used some fillers."

### 2. Corrections First, Score Second

Users open results to see what they got wrong. The clarity score provides context, but individual corrections are the hero content. Always lead with the specific, actionable feedback.

### 3. Full Attention for Full Effort

When the user starts recording, the app gives their speech its complete attention — full-screen takeover, no distractions. This communicates respect for the user's effort and creates a focused practice environment.

### 4. Progressive Disclosure

Show essential information first. Details are one tap away, never hidden but never forced. A correction card shows the error and fix upfront; the linguistic explanation is expandable.

### 5. Data Earns Trust

Show real numbers. Don't round "2.3 fillers/min" to "a few fillers." Don't say "some errors" when you can say "4 errors, 2 improvements, 1 polish." Precision builds confidence that the analysis is thorough.

### 6. Neutral Context, Never Judgment

Errors are presented as linguistic patterns, not personal failures:
- "Common for speakers whose L1 lacks articles" — normalizes
- "Subject-verb disagreement" — clinical, objective
- Never: "You made a mistake" — personalizes failure

## Motion & Animation Philosophy

### Rich & Expressive, But Purposeful

Every animation should serve one of these purposes:

| Purpose           | Example                                    |
|-------------------|--------------------------------------------|
| **State change**  | Orb bloom scales up when recording starts  |
| **Attention**     | Pulsing core during analysis               |
| **Feedback**      | Spring scale on tap, haptic on actions     |
| **Continuity**    | Smooth transitions between screens         |
| **Delight**       | Orbital particles, waveform bars           |

### Animation Standards

| Type              | Duration    | Curve                           |
|-------------------|-------------|----------------------------------|
| Micro-interaction | 150-250ms   | `ease-out` or spring (damping 15)|
| State transition  | 300-500ms   | spring (damping 12, stiffness 200)|
| Page transition   | 350-450ms   | Native card push                 |
| Loading loop      | 2-4s cycle  | `linear` for rotation, `ease-in-out` for pulse |
| Reveal/expand     | 250-400ms   | spring (damping 15, stiffness 250)|

### Skia Canvas Usage

Reserve Skia Canvas for:
- The MicBloomOrb (radial gradient bloom, multi-layer glow)
- The AnalyzingBanner (orbital rings, particle system)
- ScoreRingHero (arc dot rendering)

Do NOT use Skia for simple UI elements — standard React Native Animated or Reanimated suffices for cards, transitions, and layout animations.

### Voice Session Animation States

| State       | Orb Behavior                          | Label      |
|-------------|---------------------------------------|------------|
| Connecting  | Subtle pulse (0.98-1.02 scale)        | Connecting |
| Listening   | Breathing pulse (1.0-1.06), calm      | Listening  |
| Speaking    | Energetic bloom (1.0-1.15), bright    | Speaking   |
| Thinking    | Slow rotation, muted glow             | Thinking   |
| Analyzing   | Orbital particles, cycling text       | Analyzing  |
| Muted       | Dimmed, static, muted badge           | Muted      |

## Information Hierarchy

### Screen-Level Hierarchy

Every screen follows this vertical structure:

```
1. Context Bar     — Where am I? (screen title, back nav)
2. Hero Content    — The most important thing (score ring, orb, main CTA)
3. Primary Data    — Corrections, patterns, drill content
4. Supporting Data — Stats, metadata, secondary insights
5. Actions         — Navigation, "See all", "Show more"
```

### Text Hierarchy on Dark Surfaces

| Level     | Color                        | Weight | Example             |
|-----------|------------------------------|--------|---------------------|
| Primary   | `#ffffff` (100%)             | 800/500| Headlines, key data |
| Secondary | `#ffffff` (70% opacity)      | 400    | Descriptions, body  |
| Tertiary  | `#ffffff` (50% opacity)      | 400    | Timestamps, hints   |
| Muted     | `#adaaaa` (onSurfaceVariant) | 400    | Labels, captions    |
| Disabled  | `#ffffff` (35% opacity)      | 400    | Inactive elements   |

## Voice Session UX

### The Recording Flow

```
1. User on Home screen
2. Taps MicBloomOrb
3. Full-screen VoiceSessionOverlay slides in
4. WebSocket connects → "Connecting" state
5. Ready → "Listening" state (orb breathes)
6. AI responds → "Speaking" state (orb blooms)
7. User taps End Session
8. → "Analyzing" state (orbital animation)
9. Results ready → Push to session-detail screen
```

### Session Overlay Layout

```
┌──────────────────────────────────────┐
│  [LIVE MODE]  Dr. Aris  [00:32]     │  ← Top badge
│                                      │
│                                      │
│              ┌──────┐                │
│              │ ◉◉◉◉ │                │  ← Bloom orb + waveform
│              │ ◉◉◉◉ │                │
│              └──────┘                │
│                                      │
│            LISTENING                 │  ← State label
│                                      │
│  ┌─────────────┐  ┌──────────────┐  │
│  │  🔇 Mute    │  │  ■ End       │  │  ← Control cards
│  └─────────────┘  └──────────────┘  │
│                                      │
│        🔒 Secure Connection          │  ← Trust badge
└──────────────────────────────────────┘
```

### Mute Behavior

- Tap mute → orb dims, waveform stops, "Muted" state label
- Tap again → resume listening
- Visual feedback must be instant — no delay between tap and state change

## Session Results UX

### Fresh Session (Just Recorded)

1. AnalyzingBanner shows with orbital animation
2. Cycling text indicates progress phases
3. When ready: banner collapses, corrections fade in
4. Score ring animates fill from 0 to actual score

### Historical Session (From History)

1. No analyzing banner
2. All data loads and displays immediately
3. Same layout as fresh session, minus the loading state

### Correction Interaction

1. Cards visible with severity badge + correction preview
2. Tap to expand → explanation slides in
3. "Show N more" button if > initial display count
4. Filter by severity using pill chips at top

## Empty States

### Pattern: Guide to Action

Every empty state follows this template:

```
┌──────────────────────────────────────┐
│                                      │
│              [Icon]                  │
│                                      │
│         Feature Title                │
│                                      │
│    What the user needs to do         │
│    to activate this feature.         │
│                                      │
│         [Primary CTA]               │
│                                      │
└──────────────────────────────────────┘
```

- Icon: relevant Ionicons, muted color
- Title: `headlineSm`, white
- Description: `bodyMd`, muted (50% white)
- CTA button: optional, primary style

### Specific Empty States

| Screen     | Message                                          | CTA              |
|------------|--------------------------------------------------|------------------|
| Home (no sessions) | "Record your first session to get started" | Tap orb below    |
| Practice   | "Complete 3 sessions to generate practice drills" | Start a session  |
| Patterns   | "Patterns surface after 10+ sessions"            | Keep practicing   |
| Session corrections (clean) | "No corrections detected. Clean speech." | —          |

## Accessibility Baseline

### Color Contrast

- All text on dark backgrounds meets WCAG AA minimum (4.5:1 for body, 3:1 for large text)
- Severity colors are reinforced with icons/dots — never color alone
- Interactive elements have visible focus states

### Touch Targets

- Minimum tap target: 44x44pt (iOS guideline)
- Cards and buttons have generous padding to exceed this
- Tab bar icons have expanded hit areas

### Screen Reader

- All icons have accessibility labels
- Score ring announces "Clarity score: 87 percent"
- Correction cards announce severity and correction
- Voice session state changes announced

### Reduced Motion

- Respect `useReducedMotion()` from `react-native-reanimated`
- Replace complex Skia animations with simple fade/opacity
- Keep functionality identical — only visual complexity changes

## Freemium Considerations

### Free Tier Indicators

- Subtle badge or label on limited features — not aggressive overlays
- "Pro" pill next to premium features in settings/UI
- Usage counter: "2 of 5 sessions this week" — informative, not punishing

### Upgrade Prompts

- Appear only at natural boundaries (session limit reached, premium feature tapped)
- Informational tone: "Unlock unlimited sessions with Reflexa Pro"
- Dismissible — never block core functionality aggressively
- Never interrupt an active voice session

---

*These principles apply to all current and future screens. Reference alongside DESIGN-TOKENS.md and UI-PATTERNS.md.*
