# Implementation Plan: Practice Screen Restructure

## Summary

Restructure the practice experience from a scattered list of features into a cohesive, module-based practice hub. Kill the Patterns tab (currently a placeholder), fold all practice content into a unified Practice screen organized around "Practice Modules" -- elevated glass cards that give users a snapshot of each practice area before they commit. Reduce navigation from 4 tabs to 3 (Home, Practice, Profile). Make pattern generation automatic. Add a "Practice This" affordance on the session-detail/analysis screen so corrections are discovered there but practiced from the hub.

## Context & Problem

The current Practice tab is a vertical dump of unrelated features:
1. Filler Word Coach CTA (top)
2. "Fill the Board" CTA (manual pattern generation trigger)
3. Patterns to Break section (pattern exercise cards)
4. Filter chips (error/improvement/polish)
5. "To Practice" flat list of corrections
6. "Practiced" collapsible section

Problems:
- No visual hierarchy -- everything competes at the same level
- Filler Coach (live conversation) sits next to record-and-evaluate drills with no differentiation
- Pattern generation is a manual button (implementation leaking into UI)
- The Patterns tab is wasted on an avatar preview grid
- Corrections appear on both session-detail AND practice, creating "where do I go?" confusion
- No progress visualization across practice modes
- No structure to accommodate future modes (pronunciation, intonation, pacing)

## Chosen Approach

**Module Card Architecture**: Each practice type becomes a self-contained "Practice Module Card" -- an elevated glass card with its own icon, title, progress indicator, item count, and description. Cards are stacked vertically in a ScrollView with clear visual hierarchy. Tapping a card enters that practice mode's dedicated flow.

This was chosen over alternatives (tabbed sub-views, horizontal carousel, grid layout) because:
- It scales linearly -- adding a new mode means adding a new card
- Each card can have its own progress visualization without complex layout
- The vertical stack respects the dark glassmorphic theme (wide cards with breathing room)
- It's the simplest architecture change -- mostly UI restructuring, minimal backend work

---

## Practice Screen Structure

### Layout Hierarchy (Top to Bottom)

```
+----------------------------------------------------------+
| Practice                                    [header]      |
|                                                           |
| +----- Progress Summary Strip ----------------------------+
| |  12 practiced today  ·  3-day streak                   |
| +--------------------------------------------------------+
|                                                           |
| YOUR PRACTICE                                             |
|                                                           |
| +-- Module Card: Corrections ----------------------------+|
| |                                                        ||
| |  [severity dots]   Corrections                         ||
| |                                                        ||
| |  ████████░░░░  8 of 14 practiced                       ||
| |                                                        ||
| |  3 errors  ·  5 improvements  ·  6 polish              ||
| |                                                        ||
| +--------------------------------------------------------+|
|                                                           |
| +-- Module Card: Speech Patterns ------------------------+|
| |                                                        ||
| |  [grid icon]       Speech Patterns                     ||
| |                                                        ||
| |  ████░░░░░░░░  2 of 7 completed                        ||
| |                                                        ||
| |  "basically"  ·  Hedging  ·  +2 more                   ||
| |                                                        ||
| +--------------------------------------------------------+|
|                                                           |
| +-- Module Card: Filler Coach ---------------------------+|
| |                                                        ||
| |  [chat icon]       Filler Coach         LIVE           ||
| |                                                        ||
| |  Practice reducing filler words in                     ||
| |  live AI conversation                                  ||
| |                                                        ||
| +--------------------------------------------------------+|
|                                                           |
| COMING SOON                                               |
|                                                           |
| +-- Locked Card -----+ +-- Locked Card -----------------+|
| |  Pronunciation     | |  Intonation & Pace             ||
| |  [lock icon]       | |  [lock icon]                   ||
| +--------------------+ +--------------------------------+|
|                                                           |
+----------------------------------------------------------+
```

### Section Breakdown

#### 1. Screen Header
- Standard `ScreenHeader variant="large" title="Practice"`
- Same as current

#### 2. Progress Summary Strip
- Compact horizontal strip below header, above module cards
- Shows: total items practiced today + streak count
- Style: no background, just text -- `labelMd` typography, `alpha(white, 0.3)`
- Example: "4 practiced today  ·  3-day streak"
- If no streak data exists yet, just show "0 practiced today"
- This is intentionally lightweight -- not a card, just ambient information

#### 3. Section Label: "YOUR PRACTICE"
- Standard section label: `fonts.bold`, 13px, `alpha(white, 0.25)`, letterSpacing 1.2
- Matches existing pattern in current practice.tsx (`sectionLabel` style)

#### 4. Module Cards (Core Content)
- See detailed breakdown below
- Stacked vertically with `spacing.md` (12px) gap between cards
- Each card uses `glass.cardElevated` as the base style

#### 5. Section Label: "COMING SOON"
- Same style as "YOUR PRACTICE"
- Only shown when there are locked/future modules to display

#### 6. Locked Module Cards (Future Modes)
- Displayed in a 2-column grid (2 cards per row)
- Half-width, shorter height than active module cards
- Dimmed appearance: `opacity: 0.4`, no tap handler
- Lock icon overlay
- Used for: Pronunciation, Intonation & Pace, etc.
- Purely aspirational -- shows users the app is growing

---

## Module Card Design (Detailed)

### Common Card Structure

Every active module card follows this template:

```
+----------------------------------------------------------+
|                                                           |
|  [icon 28px]     Title                       [badge]     |
|                                                           |
|  [progress bar ████████░░░░░░]  X of Y label             |
|                                                           |
|  Subtitle / detail line                                   |
|                                                           |
+----------------------------------------------------------+
```

**Anatomy:**
- Container: `glass.cardElevated` (white/8 bg, white/12 border, 16px borderRadius)
- Padding: 16px all sides (matches `layout.cardPadding`)
- Icon: 28px, inside a 40x40 rounded (12px radius) tinted background
- Title: `fonts.semibold`, 16px, `colors.onSurface`
- Badge (optional): small pill, right-aligned with title
- Progress bar: 4px height, full card width minus padding, rounded
- Progress label: `fonts.medium`, 13px, `alpha(white, 0.35)`
- Subtitle: `fonts.regular`, 13px, `alpha(white, 0.35)`, up to 2 lines

**Interaction:**
- Entire card is tappable (Pressable with spring scale animation, matching existing pattern)
- Press-in: scale 0.98 with spring. Press-out: scale 1.0 with spring
- Haptic: `ImpactFeedbackStyle.Light` on press

### Module: Corrections

**Icon:** Severity-colored dots (3 small circles: error red, improvement blue, polish green) inside a tinted container. Use `alpha(colors.primary, 0.12)` background.

**Title:** "Corrections"

**Badge:** None normally. If all corrections are practiced, show a green checkmark badge.

**Progress Bar:**
- Track: `alpha(white, 0.06)`
- Fill: gradient or solid `colors.primary` (`#cc97ff`)
- Value: practiced count / total count (from `usePracticeTasks`)
- Label: "8 of 14 practiced" -- format: `{practiced} of {total} practiced`

**Subtitle:** Severity breakdown -- "3 errors  ·  5 improvements  ·  6 polish"
- Each count colored with its severity color
- Middle dot separator in `alpha(white, 0.15)`

**Tap Action:** Navigate to a **Corrections List Screen** (new intermediate screen, see Flow section below)

**Empty State (no corrections exist):**
- Card still appears but in a "dormant" state
- Progress bar hidden
- Subtitle: "Complete a voice session to generate corrections"
- Icon tinted at lower opacity (0.3)
- Card is NOT tappable -- instead, tapping navigates to Home tab

### Module: Speech Patterns

**Icon:** Grid icon (`grid-outline` from Ionicons), inside `alpha(colors.tertiary, 0.12)` background

**Title:** "Speech Patterns"

**Badge:** None normally. If patterns exist but all are practiced, show green checkmark.

**Progress Bar:**
- Track: `alpha(white, 0.06)`
- Fill: `colors.tertiary` (`#ff6daf`)
- Value: practiced exercises / total exercises (aggregated across all pattern groups)
- Label: "2 of 7 completed"

**Subtitle:** Show up to 3 pattern identifiers/types, then "+N more"
- Example: `"basically"  ·  Hedging  ·  +2 more`
- Pattern identifiers in quotes, type labels unquoted
- If only one pattern: just show its identifier/type and description snippet

**Tap Action:** Navigate to a **Patterns List Screen** (new intermediate screen)

**Empty State (no patterns generated yet):**
- Card still appears in dormant state
- Subtitle: "Patterns emerge after a few voice sessions"
- NOT tappable
- No manual "Fill the Board" button -- generation is automatic (see Backend Changes)

### Module: Filler Coach

**Icon:** Chat bubbles icon (`chatbubbles-outline`), inside `alpha(colors.secondary, 0.12)` background

**Title:** "Filler Coach"

**Badge:** "LIVE" pill -- `fonts.bold`, 9px, `colors.secondary`, with `alpha(colors.secondary, 0.12)` background, 6px border radius. This differentiates it from record-and-evaluate modes.

**Progress Bar:** None. This is a session-based mode, not a task-completion mode.

**Subtitle:** "Practice reducing filler words in live AI conversation"

**Tap Action:** Navigate directly to `/filler-coach` (existing screen). The filler coach auto-starts on mount, which is correct behavior.

**Empty State:** This module is always available (no data dependency). It's always tappable.

### Module: Future Locked Cards

**Layout:** 2-column grid using `flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md`

**Card Style:**
- `glass.card` (not elevated -- visually recessed)
- `opacity: 0.35` on the entire card
- Smaller: no progress bar, no subtitle. Just icon + title + lock icon
- Height: ~72px

**Cards to show initially:**
- "Pronunciation" (icon: `volume-medium-outline`)
- "Intonation & Pace" (icon: `pulse-outline`)

**Not tappable.** No onPress handler. No scale animation.

---

## Intermediate List Screens

When a user taps a module card, they don't go straight to a drill. They see a focused list for that module. This is important because:
1. Users need to see what they're about to practice
2. It provides a natural place for filtering and sorting
3. It avoids cramming list views into the hub

### Corrections List Screen (`/corrections-list`)

```
+----------------------------------------------------------+
| <  Corrections                                            |
|                                                           |
| [all] [errors] [improvements] [polish]    filter chips    |
|                                                           |
| +-- Correction Strip -------- severity bar -- [dot] -----+|
| |  "I have been working..."                               |
| +--------------------------------------------------------+|
| +-- Correction Strip -------- severity bar -- [check] ---+|
| |  "She don't..."  -> "She doesn't..."                   |
| +--------------------------------------------------------+|
| ...                                                       |
|                                                           |
| Show practiced (12)                           [chevron]   |
|                                                           |
|                                                           |
| [========= Practice All (6) =========]    floating btn    |
+----------------------------------------------------------+
```

**Structure:**
- `ScreenHeader variant="back"` with title "Corrections"
- `CorrectionFilterChips` (reuse existing component)
- Flat list of `PracticeTaskCard` components (reuse existing)
- Collapsible "Show practiced" section (reuse existing pattern)
- Floating bottom button: "Practice All (N)" where N = unpracticed count
  - Tapping this enters the practice-session queue (same as current `fromList=true` behavior)
  - Individual card taps enter practice-session for that single correction (same as current)

This screen is essentially the bottom half of the current practice.tsx extracted into its own route. The existing components (`CorrectionFilterChips`, `PracticeTaskCard`) can be reused as-is.

### Patterns List Screen (`/patterns-list`)

```
+----------------------------------------------------------+
| <  Speech Patterns                                        |
|                                                           |
| +-- Pattern Group Card ----------------------------------+|
| |  "basically"                      Overused Word        ||
| |  ████████░░  3 of 5 practiced                   [3]   ||
| +--------------------------------------------------------+|
|                                                           |
| +-- Pattern Group Card ----------------------------------+|
| |  Hedging                         Reframe Exercise      ||
| |  ██░░░░░░░░  1 of 4 practiced                   [3]   ||
| +--------------------------------------------------------+|
| ...                                                       |
+----------------------------------------------------------+
```

**Structure:**
- `ScreenHeader variant="back"` with title "Speech Patterns"
- List of pattern group cards (enhanced version of current `PatternTaskCard`)
- Each card shows:
  - Pattern identifier or type label
  - Pattern type as secondary label
  - Mini progress bar (same 4px style as module card)
  - Unpracticed count badge
- Tapping a group card navigates to `/pattern-practice-session?patternId=X` (existing screen, no changes needed)

This is the current "PATTERNS TO BREAK" section from practice.tsx, extracted into its own route. The `PatternTaskCard` component needs a minor enhancement: add a mini progress bar showing practiced/total for that group.

---

## The Analysis-to-Practice Bridge

### Session Detail Screen Changes

The session-detail screen (`/session-detail`) already has a floating "Practice (N)" button at the bottom. This is good. Additions:

1. **Per-correction "Practice" button**: Add a small mic/practice icon to each `CorrectionCard` that navigates directly to `/practice-session?correctionId=X&mode=say_it_right`. This gives users a way to practice a specific correction immediately after discovering it.

2. **"Practiced" badge stays**: The existing green "Practiced" badge on CorrectionCard is already working and should remain.

3. **Floating button text update**: Change from `Practice (${unpracticedCount})` to `Practice ${unpracticedCount} Corrections` for clarity.

### CorrectionCard Enhancement

Add an `onPractice` optional callback prop to `CorrectionCard`:

```
interface CorrectionCardProps {
  ...existing props...
  onPractice?: () => void;  // NEW: shown when correction has an ID and is not yet practiced
}
```

When `onPractice` is provided and `practiced` is false, render a small mic icon button in `row2` (right side, where the practiced badge would go). When `practiced` is true, show the existing green badge. When `onPractice` is not provided, current behavior (no icon).

---

## Empty States

### Global Empty (No Sessions Ever)

When the user has zero sessions, zero corrections, zero patterns:

```
+----------------------------------------------------------+
| Practice                                                  |
|                                                           |
|                                                           |
|              [mic-outline icon, 48px, dim]                |
|                                                           |
|           Nothing to practice yet                         |
|                                                           |
|     Complete a voice session and your                     |
|     practice modules will appear here.                    |
|                                                           |
|          [ Start a Session ]  primary btn                 |
|                                                           |
+----------------------------------------------------------+
```

Use existing `EmptyState` component. This replaces the entire scroll view.
Decision: show this ONLY when there are zero corrections AND zero patterns AND zero filler word sessions.

### Per-Module Empty States

These are handled inline within each module card (see Module Card descriptions above). The card renders in a "dormant" visual state with explanatory subtitle text. The card is not removed -- it stays visible so users know the feature exists.

### Corrections All Practiced

When all corrections have been practiced (unpracticed count = 0):

Module card shows:
- Progress bar at 100% (fully filled, green tint `colors.severityPolish`)
- Label: "All 14 practiced" with a small checkmark
- Subtitle changes to: "Keep talking to generate new corrections"
- Card is still tappable (user can review/re-practice)

### Patterns All Practiced

Same pattern as corrections:
- Progress bar at 100%
- Label: "All 7 completed"
- Subtitle: "New patterns will appear as you keep talking"
- Card still tappable (spaced repetition may resurface exercises)

---

## Progress Visualization

### Progress Summary Strip (Top of Screen)

**"Practiced today" count:**
- Query: count of `practice_attempts` + `pattern_practice_attempts` where `created_at` is today and `passed = true`
- New API endpoint: `GET /practice/stats` returning `{ practicedToday: number, streak: number }`

**Streak:**
- Streak = consecutive days with at least 1 passed practice attempt
- Computed server-side from practice_attempts + pattern_practice_attempts tables
- Query: for each day going backwards from today, check if there's at least 1 passed attempt. Count consecutive days.
- If today has no attempts yet, check if yesterday was the last active day (streak is still alive until end of today)

### Module Card Progress Bars

Each module card has its own progress bar. The bar style:
- Height: 4px
- Border radius: 2px
- Track: `alpha(colors.white, 0.06)`
- Fill: module's accent color (corrections = primary purple, patterns = tertiary pink)
- Animation: `withTiming` width transition when data changes (300ms, ease-out)

### Completed State Color

When a module hits 100%, the fill color transitions to `colors.severityPolish` (green `#34d399`) to signal completion, regardless of the module's normal accent color.

---

## How Future Modes Slot In

### Adding a New Practice Mode

To add a new mode (e.g., Pronunciation):

1. **Create the mode's practice session screen** (e.g., `/pronunciation-session.tsx`)
2. **Create the mode's intermediate list screen** (if it has discrete items) or skip straight to session (if it's session-based like Filler Coach)
3. **Add a new module card definition** to the Practice screen's module list
4. **Create a hook** (e.g., `usePronunciationTasks`) that returns item count and progress
5. **Remove the mode from the "Coming Soon" locked cards**

The Practice screen itself requires zero structural changes. You're just adding another card to the array.

### Module Registry Pattern

Define modules as data, not as hardcoded JSX blocks. The Practice screen should iterate over a `PRACTICE_MODULES` array:

```typescript
interface PracticeModule {
  id: string;
  title: string;
  icon: string;                     // Ionicons name
  iconTint: string;                 // alpha(color, 0.12) for icon background
  accentColor: string;              // for progress bar fill
  badge?: { label: string; color: string };  // e.g., "LIVE" for filler coach
  route: string;                    // navigation target
  // Data hook returns:
  useData: () => {
    total: number;
    completed: number;
    subtitle: string;
    isEmpty: boolean;
    isAvailable: boolean;           // false = dormant state
  };
}
```

This makes adding future modules trivial -- define the config, implement the hook, done.

**Important caveat:** Don't over-abstract this in the first implementation. Start with 3 hardcoded module card renders (Corrections, Patterns, Filler Coach). Extract the registry pattern only when adding the 4th mode. The three current modes have enough differences (progress bar vs no progress bar, severity breakdown vs pattern names, etc.) that premature abstraction would create awkward conditional rendering.

---

## Tab Navigation Changes

### Before (4 tabs)
```
[Home]  [Practice]  [Patterns]  [Profile]
```

### After (3 tabs)
```
[Home]  [Practice]  [Profile]
```

### Changes to `mobile/app/(tabs)/_layout.tsx`:

1. Remove the `patterns` tab from `TabLayout`
2. Update `TAB_ICONS` map: remove `patterns` entry
3. The `patterns.tsx` file can be deleted or repurposed later
4. Tab bar width adjusts automatically (3 items instead of 4)

### Tab Icon Update

Consider changing the Practice tab icon from `chatbubble` to something more fitting:
- `fitness-outline` / `fitness` -- matches the existing "Practice" button icon on session-detail
- `barbell-outline` / `barbell` -- physical practice metaphor
- Keep `chatbubble` if you prefer -- it's fine, just less semantically precise

Recommendation: `fitness-outline` / `fitness` to match existing usage.

---

## Automatic Pattern Generation

### Current Flow (Kill This)
User manually taps "Fill the Board" -> POST /practice/generate-patterns -> patterns appear

### New Flow
Pattern generation runs automatically after each voice session analysis completes. The user never triggers it.

### Implementation

In the server-side session analysis pipeline (the handler that runs after a voice session ends and corrections are saved):

1. After corrections are saved for a session, check if the user has >= 3 completed sessions (minimum data needed for pattern detection)
2. If yes, call `runPatternAnalysisForUser(userId, { awaitExercises: false })` -- fire-and-forget, don't block the response
3. This is the same function the manual button called, just triggered automatically

The pattern analysis function already handles:
- Deduplication (won't re-analyze sessions already in `sessionsAnalyzed`)
- Exercise generation for new patterns
- This should be called from the voice session completion handler (likely in `voice-session-ws.ts` or wherever analysis results are saved)

### UI Cleanup
- Remove the "Fill the Board" Pressable card from practice.tsx entirely
- Remove `useGeneratePatterns` hook (no longer needed)
- The patterns module card shows "Patterns emerge after a few voice sessions" when empty -- no action needed from the user

---

## Files Affected

### New Files
| File | Purpose |
|------|---------|
| `mobile/app/corrections-list.tsx` | Intermediate list screen for corrections |
| `mobile/app/patterns-list.tsx` | Intermediate list screen for pattern groups |
| `mobile/components/PracticeModuleCard.tsx` | Reusable module card component |
| `mobile/components/ProgressBar.tsx` | Thin reusable progress bar (4px, animated) |
| `mobile/components/LockedModuleCard.tsx` | Small locked/coming-soon card |
| `mobile/hooks/usePracticeStats.ts` | Hook for practiced-today count + streak |
| `server/src/routes/practice-stats.ts` OR add endpoint to existing `practice.ts` | GET /practice/stats endpoint |

### Modified Files
| File | Change |
|------|--------|
| `mobile/app/(tabs)/practice.tsx` | Complete rewrite -- module card hub layout |
| `mobile/app/(tabs)/_layout.tsx` | Remove Patterns tab, update to 3 tabs |
| `mobile/app/(tabs)/patterns.tsx` | Delete (avatar sandbox, not needed) |
| `mobile/components/CorrectionCard.tsx` | Add optional `onPractice` prop + mic icon button |
| `mobile/app/session-detail.tsx` | Wire `onPractice` to each CorrectionCard, update floating button text |
| `mobile/components/PatternTaskCard.tsx` | Add mini progress bar for practiced/total |
| `mobile/hooks/usePatternTasks.ts` | Remove `useGeneratePatterns` export |
| `server/src/voice/handlers/conversation-handler.ts` (or wherever analysis completes) | Add automatic `runPatternAnalysisForUser` call after session |
| `server/src/routes/practice.ts` | Add `/stats` endpoint, keep `/generate-patterns` route but it's no longer called from UI |

### Deleted Files
| File | Reason |
|------|--------|
| `mobile/app/(tabs)/patterns.tsx` | Tab removed, content folded into Practice |

---

## Data Flow

### Practice Screen Load

```
PracticeScreen mounts
  -> usePracticeTasks()        -> GET /practice/tasks        -> corrections data
  -> usePatternTasks()         -> GET /practice/pattern-tasks -> pattern groups data
  -> usePracticeStats()        -> GET /practice/stats         -> { practicedToday, streak }

Each module card computes its own state from this data:
  - Corrections card: total/practiced counts from practice tasks
  - Patterns card: total/practiced counts aggregated from pattern groups
  - Filler Coach card: static (always available)
```

### Practice Flow (Corrections)

```
Practice Screen
  -> tap Corrections card
  -> /corrections-list (filter chips + flat list, reusing existing components)
    -> tap individual card -> /practice-session?correctionId=X&mode=say_it_right
    -> tap "Practice All" floating btn -> /practice-session?fromList=true&correctionId=X
```

### Practice Flow (Patterns)

```
Practice Screen
  -> tap Speech Patterns card
  -> /patterns-list (list of pattern groups)
    -> tap pattern group -> /pattern-practice-session?patternId=X
```

### Practice Flow (Filler Coach)

```
Practice Screen
  -> tap Filler Coach card
  -> /filler-coach (existing screen, auto-starts voice session)
```

### Analysis to Practice Bridge

```
Session Detail (/session-detail)
  -> CorrectionCard rendered with onPractice callback
  -> tap mic icon on a correction -> /practice-session?correctionId=X&mode=say_it_right
  -> tap floating "Practice N Corrections" -> /practice-session?sessionId=X&mode=say_it_right
```

---

## ASCII Mockup: Full Practice Screen

### State: Active User with All Modules Populated

```
+----------------------------------------------------------+
|                                                           |
|  Practice                                                 |
|                                                           |
|  4 practiced today  ·  3-day streak                       |
|                                                           |
|  YOUR PRACTICE                                            |
|                                                           |
|  +------------------------------------------------------+ |
|  |                                                      | |
|  |  [ooo]  Corrections                                  | |
|  |    ^                                                 | |
|  |  severity                                            | |
|  |  dots     ████████████░░░░░░  8 of 14 practiced      | |
|  |                                                      | |
|  |  3 errors  ·  5 improvements  ·  6 polish            | |
|  |                                                      | |
|  +------------------------------------------------------+ |
|                                                    12px    |
|  +------------------------------------------------------+ |
|  |                                                      | |
|  |  [grid]  Speech Patterns                             | |
|  |                                                      | |
|  |           ████░░░░░░░░░░░░░░  2 of 7 completed       | |
|  |                                                      | |
|  |  "basically"  ·  Hedging  ·  +2 more                 | |
|  |                                                      | |
|  +------------------------------------------------------+ |
|                                                    12px    |
|  +------------------------------------------------------+ |
|  |                                                      | |
|  |  [chat]  Filler Coach                     LIVE       | |
|  |                                                      | |
|  |  Practice reducing filler words                      | |
|  |  in live AI conversation                             | |
|  |                                                      | |
|  +------------------------------------------------------+ |
|                                                    24px    |
|  COMING SOON                                              |
|                                                    12px    |
|  +------------------------+ +---------------------------+ |
|  |  [volume]              | |  [pulse]                  | |
|  |  Pronunciation    [lk] | |  Intonation & Pace  [lk] | |
|  +------------------------+ +---------------------------+ |
|                                                           |
+----------------------------------------------------------+
|        [Home]       [Practice]       [Profile]            |
+----------------------------------------------------------+
```

### State: New User (No Sessions)

```
+----------------------------------------------------------+
|                                                           |
|  Practice                                                 |
|                                                           |
|                                                           |
|                                                           |
|                                                           |
|              [mic-outline, 48px, dim]                     |
|                                                           |
|           Nothing to practice yet                         |
|                                                           |
|     Complete a voice session and your                     |
|     practice modules will appear here.                    |
|                                                           |
|            [ Start a Session ]                            |
|                                                           |
|                                                           |
|                                                           |
+----------------------------------------------------------+
```

### State: Has Corrections but No Patterns Yet

```
+----------------------------------------------------------+
|                                                           |
|  Practice                                                 |
|                                                           |
|  0 practiced today                                        |
|                                                           |
|  YOUR PRACTICE                                            |
|                                                           |
|  +------------------------------------------------------+ |
|  |                                                      | |
|  |  [ooo]  Corrections                                  | |
|  |                                                      | |
|  |           ░░░░░░░░░░░░░░░░░░  0 of 6 practiced       | |
|  |                                                      | |
|  |  2 errors  ·  3 improvements  ·  1 polish            | |
|  |                                                      | |
|  +------------------------------------------------------+ |
|                                                           |
|  +------------------------------------------------------+ |
|  |                                                      | |
|  |  [grid]  Speech Patterns                (dimmed)     | |
|  |       (0.5 opacity)                                  | |
|  |  Patterns emerge after a few                         | |
|  |  voice sessions                                      | |
|  |                                                      | |
|  +------------------------------------------------------+ |
|                                                           |
|  +------------------------------------------------------+ |
|  |                                                      | |
|  |  [chat]  Filler Coach                     LIVE       | |
|  |                                                      | |
|  |  Practice reducing filler words                      | |
|  |  in live AI conversation                             | |
|  |                                                      | |
|  +------------------------------------------------------+ |
|                                                           |
|  COMING SOON                                              |
|  ...                                                      |
+----------------------------------------------------------+
```

### State: All Corrections Practiced

```
+----------------------------------------------------------+
|  ...                                                      |
|  +------------------------------------------------------+ |
|  |                                                      | |
|  |  [ooo]  Corrections                          [chk]   | |
|  |                                                      | |
|  |           ████████████████████  All 14 practiced      | |
|  |                              (green fill)             | |
|  |  Keep talking to generate new corrections             | |
|  |                                                      | |
|  +------------------------------------------------------+ |
|  ...                                                      |
+----------------------------------------------------------+
```

---

## Corrections List Screen Mockup

```
+----------------------------------------------------------+
|  <  Corrections                                           |
|                                                           |
|  [All 14] [Errors 3] [Improvements 5] [Polish 6]         |
|                                                           |
|  TO PRACTICE  ·  6 remaining                              |
|                                                           |
|  |err|  "She don't work here"                        [·] |
|  -----                                                    |
|  |imp|  "I have been going to the store"             [·] |
|  -----                                                    |
|  |pol|  "It's very unique"                           [·] |
|  -----                                                    |
|  |err|  "Me and him went..."                         [·] |
|  -----                                                    |
|  ...                                                      |
|                                                           |
|  Show practiced (8)                              [v]      |
|                                                           |
|                                                           |
|  +======================================================+ |
|  |           Practice All (6)                            | |
|  +======================================================+ |
+----------------------------------------------------------+
```

---

## Component Architecture

### New Components

**`PracticeModuleCard`**
```
Props:
  icon: string (Ionicons name)
  iconTint: string (background color for icon container)
  title: string
  accentColor: string (progress bar fill color)
  badge?: { label: string; color: string }
  total: number (0 = hide progress bar)
  completed: number
  progressLabel: string (e.g., "8 of 14 practiced")
  subtitle: string
  isDormant?: boolean (dimmed, not tappable)
  isCompleted?: boolean (green progress bar, checkmark badge)
  onPress: () => void
```

**`ProgressBar`**
```
Props:
  progress: number (0-1)
  color: string
  completedColor?: string (defaults to colors.severityPolish)
  isCompleted?: boolean
  height?: number (default 4)
```

**`LockedModuleCard`**
```
Props:
  icon: string
  title: string
```

**`PracticeSummaryStrip`**
```
Props:
  practicedToday: number
  streak: number
```

### Reused Components (No Changes)
- `ScreenHeader`
- `EmptyState`
- `CorrectionFilterChips`
- `PracticeTaskCard`
- `PracticeFeedbackPanel`
- `PracticeRecordOrb`
- `GlassIconPillButton`

### Modified Components
- `CorrectionCard` -- add `onPractice` prop
- `PatternTaskCard` -- add mini progress bar

---

## Edge Cases & Error Handling

1. **Race condition on practice stats**: The "practiced today" count should use `refetchOnMount: 'always'` (same pattern as `usePracticeTasks`) to stay fresh when navigating back to the Practice tab.

2. **Pattern generation timing**: Automatic pattern generation is fire-and-forget. If it fails, the user just doesn't see patterns yet. No error surfaces. Next session completion will retry.

3. **Pattern generation minimum data**: Don't trigger pattern analysis if user has < 3 sessions. The check already exists in `runPatternAnalysisForUser` but should be verified.

4. **Streak timezone**: Streak calculation should use UTC dates (not local time) for consistency. The server returns the number; the client doesn't compute it.

5. **Module card data loading**: All three data hooks fire in parallel on mount. Use React Query's built-in loading states. Show the full screen empty state only if ALL hooks have resolved and all are empty. Show skeleton/loading state while any hook is pending.

6. **Back navigation from intermediate lists**: Corrections List and Patterns List use `ScreenHeader variant="back"` which calls `router.back()`. This correctly returns to the Practice tab.

7. **Deep linking from session-detail**: When tapping "Practice This" on a CorrectionCard in session-detail, the user goes to `/practice-session` directly (skipping the corrections list). The back button from practice-session should return to session-detail, not to the corrections list. This already works correctly because `router.back()` pops the navigation stack.

---

## Testing Considerations

1. **Module card states**: Test all combinations -- empty, partial, complete, dormant
2. **Tab reduction**: Verify 3-tab layout renders correctly, indicator pill slides properly
3. **Navigation flows**: Test all entry points to practice-session (from corrections list, from session-detail CorrectionCard, from session-detail floating button)
4. **Auto pattern generation**: Verify patterns appear after 3+ sessions without manual trigger
5. **Stats accuracy**: Verify "practiced today" count matches actual attempts with `passed=true` for today
6. **Streak calculation**: Test edge cases -- first day, gap day, multiple practices in one day
7. **Existing practice session screens**: Verify `/practice-session` and `/pattern-practice-session` still work identically (no changes to these screens)
8. **Empty state transitions**: User completes their first session -> returns to Practice tab -> should see corrections module card populate

---

## Migration / Breaking Changes

- **No database migrations needed**. All data already exists. The new `/practice/stats` endpoint reads from existing tables.
- **No API breaking changes**. All existing endpoints remain. One new endpoint added.
- **Tab count change** is a UI-only change. No deep links reference the patterns tab.
- **Pattern generation trigger moves** from client-initiated to server-initiated. The old POST endpoint can remain (idempotent, harmless) but the UI no longer calls it.

---

## Implementation Order

Recommended sequence for the implementing agent:

1. **Tab reduction**: Remove Patterns tab from `_layout.tsx`. Delete/stub `patterns.tsx`. Verify 3-tab layout works.
2. **New components**: Build `ProgressBar`, `PracticeModuleCard`, `LockedModuleCard`, `PracticeSummaryStrip`.
3. **Practice screen rewrite**: Replace `practice.tsx` content with module card hub layout using hardcoded module cards (not a registry pattern yet).
4. **Corrections List screen**: Create `/corrections-list.tsx`, extracting the filter+list+practiced section from old `practice.tsx`.
5. **Patterns List screen**: Create `/patterns-list.tsx`, extracting pattern group list from old `practice.tsx`.
6. **Practice stats endpoint**: Add `GET /practice/stats` to server, create `usePracticeStats` hook.
7. **CorrectionCard enhancement**: Add `onPractice` prop, wire it in session-detail.
8. **PatternTaskCard enhancement**: Add mini progress bar.
9. **Automatic pattern generation**: Add `runPatternAnalysisForUser` call to post-session handler.
10. **Cleanup**: Remove `useGeneratePatterns` hook, remove "Fill the Board" references.

---

## Open Questions

1. **Streak visualization**: The plan includes a text-only streak count. Should this eventually become a visual streak calendar (like GitHub contributions)? If so, that's a separate feature -- the text count is sufficient for now.

2. **Filler Coach progress**: Currently there's no progress tracking for filler coach sessions. Should filler word counts across sessions be surfaced somewhere? This could become a "Filler words per minute" trend line in a future iteration. For now, the Filler Coach module card has no progress bar, which is fine.

3. **Re-practice**: When corrections are all practiced, the card is still tappable. Should re-practicing a correction reset its "practiced" status, or just increment the count? Current behavior (increment count, keep practiced=true) seems correct.

4. **Pattern exercise spaced repetition**: Pattern exercises already have `nextPracticeAt` for spaced repetition. When an exercise resurfaces, does `completed` count in the progress bar go back down? Current query filters by `next_practice_at <= NOW()`, so resurfaced exercises would appear as unpracticed. The progress bar should reflect this accurately (completed = exercises where `practiced=true AND (next_practice_at IS NULL OR next_practice_at > NOW())`). This may need a backend tweak to return the "truly done" count separately from the "due for review" count.
