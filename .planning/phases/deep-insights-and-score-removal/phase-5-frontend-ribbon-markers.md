# Phase 5 — Frontend: Pitch Ribbon Markers for Specific Insights

**Goal:** Render `specific`-type deep insights as markers on the existing Skia pitch ribbon. Tap a marker → show the insight text in an overlay; optionally scrub the audio player to that moment.

**Depends on:** Phase 2 (backend deep-insights payload)
**Blocks:** —
**Parallelizable with:** Phase 4
**Estimated effort:** medium

---

## Design brief

The existing pitch ribbon already renders prosody over a horizontal timeline. Add a layer on top:

- **Point anchor** → small glowing dot at the correct x-position
- **Range anchor** → thin bracket / gradient band beneath the ribbon covering the range's x-span

Marker appearance:
- Dot: 8dp diameter, vivid primary accent, subtle pulse animation (scale 1.0 ↔ 1.15 over 1.6s ease-in-out, loop)
- Bracket: 3dp tall, same accent color at 50% opacity, rounded ends, sits just below the ribbon's baseline
- On hover/press: pulse stops, marker goes 100% opacity

Tap interaction:
1. User taps a marker
2. An overlay / peek panel appears (bottom sheet-style, NOT a card stack): just text — `[A SPECIFIC MOMENT]` tag, headline, unpack, optional quoted_text in italics
3. Audio scrubber jumps to `anchor.start_seconds` (does NOT auto-play; user explicitly chooses play)
4. Tapping outside the overlay dismisses it

Only one marker can be "active" at a time. Tapping a second marker switches the overlay content.

---

## Scope

### Files to read (existing ribbon implementation)

| File | Purpose |
|---|---|
| `mobile/components/orbs/IrisRingOrb.tsx` or wherever the Skia pitch ribbon lives | The ribbon drawing logic — understand its time-to-x coordinate mapping before adding markers |
| `mobile/lib/voiceAudioLevel.ts` | Any shared audio/time utilities |

(Cross-check the actual file locations — the ribbon may be a component under `mobile/components/session/` or similar. Grep for `prosodySamples` and `Skia` usage to find it.)

### Create

| File | Purpose |
|---|---|
| `mobile/components/session/InsightMarkers.tsx` | Renders dots + brackets on top of the pitch ribbon. Inputs: `{ insights: DeepInsight[]; durationSeconds: number; ribbonWidthPx: number; onMarkerPress: (insight) => void }`. Only renders `type === 'specific'` insights with `anchor` present. |
| `mobile/components/session/InsightPeek.tsx` | The overlay / peek panel that appears when a marker is tapped. Takes `DeepInsight` + close callback. Styled as editorial text, no card wrapper. Semi-transparent dark backdrop. |

### Modify

| File | Change |
|---|---|
| Pitch ribbon component (location TBD) | Accept a new `markers` prop and render `<InsightMarkers />` as a sibling overlay inside the same coordinate space. Do NOT mutate the Skia paths — the markers are a React Native (not Skia) layer positioned absolutely over the ribbon. |
| `mobile/app/session-detail.tsx` | Wire `deepInsights` from store → ribbon's `markers` prop. Manage active marker state (`useState<DeepInsight \| null>`) for the peek overlay. |
| `mobile/hooks/voice/` audio playback hook (or equivalent) | Expose a `scrubTo(seconds: number)` method if not already available, so marker tap can reposition playback without auto-starting. |

### Coordinate math

`markerX = (anchor.start_seconds / durationSeconds) * ribbonWidthPx`

For ranges:
- Bracket `leftX = (start / duration) * width`
- Bracket `rightX = (end / duration) * width`
- Bracket `width = rightX - leftX` (clamp minimum to 12dp so very short ranges are still visible)

Clamp `start_seconds` to `[0, durationSeconds]` to handle any anchor drift from the AI.

### Edge cases

- **Overlapping markers.** If two specific insights have anchors within 8dp of each other on the x-axis, stack them vertically (small vertical offset for the second). Or cluster them — pick one and document.
- **Anchor at t=0.** A point anchor near x=0 can clip the edge. Add 4dp horizontal padding.
- **No prosody samples.** Some older sessions have `prosodySamples: []`. The ribbon degrades to a flat line. Markers still work — they're positioned on duration, not on prosody.
- **Both ends same.** For a `point` anchor, `start == end` is valid. Treat as a dot.

---

## Verification

1. `npx tsc --noEmit -p mobile/tsconfig.json` passes
2. Complete a fresh session with specific insights. Markers appear on the ribbon at the correct timestamps (sanity-check by opening the JSON output of a test run and spotting the timestamps).
3. Tap a point marker: peek overlay shows with headline, unpack, and (if present) italicized quoted_text. Audio scrubber moves to that moment (does not auto-play).
4. Tap a range marker: bracket's containing utterance highlights, peek shows range insight.
5. Tap another marker while overlay is open: overlay content updates, scrubber re-positions.
6. Tap outside overlay: overlay dismisses.
7. Open a historical session with specific insights: markers render correctly.
8. Open a session with ONLY overall insights (no specifics): ribbon shows no markers — no "no markers" placeholder needed.
9. Visually: point = pulsing dot, range = soft bracket, both use the design system's primary accent color.
10. Interaction latency: marker press → overlay visible in < 150ms.

---

## Risks / watch out for

- **Ribbon re-renders.** The pitch ribbon is Skia; the markers layer is React Native. Make sure the RN layer stays synced when the ribbon resizes (orientation change, SafeAreaView changes, etc.). Use the same parent container and size both to the same layout dimensions.
- **Accidental audio auto-play.** Marker tap must NOT auto-play. It's a precise UX rule — the user wants to see the insight first, then decide to listen.
- **Marker overlap with filler dots.** If the pitch ribbon already has filler-position dots rendered, the insight markers need a distinct visual so they don't compete. Insight markers should be larger, more vivid, and have the pulse animation.
- **Range brackets on very short ranges.** A range of `[0.08s → 3.52s]` on a 120s session is a bracket of ~3% of width. Looks tiny. Consider a minimum visual width for brackets even if it slightly misrepresents.
- **Scroll container.** If the ribbon is inside a vertical ScrollView, touches on markers must not be swallowed by scroll gestures. Use `hitSlop` and `activeOpacity` properly.

---

## Out of scope

- Auto-playing audio when tapping a marker
- Showing both point AND range markers for a single insight (either/or)
- Cross-session insight markers (nothing historical on the current session's ribbon)
- Adding text labels next to markers on the ribbon itself (all text lives in the peek overlay)
