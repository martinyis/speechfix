# Phase 4 — Frontend: Overall Insights UI (Text Stack)

**Goal:** Render `overall`-type deep insights on the session results screen as an editorial text stack — headline + one-line unpack, no cards, no chrome, generous whitespace.

**Depends on:** Phase 2 (backend deep-insights payload)
**Blocks:** — (ships independently once Phase 2 data arrives)
**Parallelizable with:** Phase 5
**Estimated effort:** small/medium

---

## Design brief

Each insight is:

```
[very small dim tag:  OVERALL]
[headline, editorial type, large, bold]
[unpack, one short sentence, lighter weight, smaller]

(lots of vertical space)

[next insight...]
```

- **No card wrappers.** Open/flat layout. User's "Vibrant Glass" design system explicitly forbids card-heavy UIs.
- **No borders or backgrounds** behind individual insights.
- **Typography is the design.** Use the existing `Manrope 800` (headlines) and `Inter` (body) from `mobile/theme/index.ts`.
- **Color**: headline in primary text, unpack in dim/secondary, tag in even dimmer.
- **Tag copy**: just the word `OVERALL` in small caps with wide letter-spacing. No icon. Very subtle — should feel like a pull-quote byline, not a UI chrome.

### Visual rhythm

Between insights: ~32–48dp of vertical space. Between the tag and the headline: ~8dp. Between headline and unpack: ~6dp.

No dividers or rules needed in v1; the whitespace does the work.

---

## Scope

### Create

| File | Purpose |
|---|---|
| `mobile/components/session/InsightsOverall.tsx` | Renders a vertical stack of overall insights. Input: `DeepInsight[]` (filtered to `type === 'overall'`). Output: a section with editorial typography as above. Empty state: render nothing — no "no insights" placeholder. |

### Modify

| File | Change |
|---|---|
| `mobile/types/session.ts` | Add `DeepInsight` type (mirror from `server/src/modules/sessions/deep-insights.ts` — redefine locally, do not import from server). Include the optional `anchor` field even though this phase doesn't use it. |
| `mobile/stores/sessionStore.ts` | Add `deepInsights: DeepInsight[] \| null` to the session state. Add a setter action that consumes the new `deep_insights_complete` WebSocket message from Phase 2. |
| `mobile/hooks/voice/useVoiceSessionCore.ts` (or wherever the WebSocket handler lives) | Handle the `deep_insights_complete` message: parse payload, call the new setter on the store. |
| `mobile/app/session-detail.tsx` | Add `<InsightsOverall />` below whatever stays of `SessionVerdict`. Pass the filtered overall insights from the store (or from the session row for historical views). For historical sessions, fetch via `GET /sessions/:id/deep-insights` on mount. |

### WebSocket message handling

Phase 2 adds a `deep_insights_complete` message. The handler should:
- Parse the payload — an array of `DeepInsight` objects
- Store via the new `sessionStore` action
- The screen automatically re-renders with the new data

Do NOT block the screen's initial render on this. Render what's available immediately. When deep insights arrive, they fade in.

### Fade-in animation (optional but recommended)

When insights arrive post-analysis, fade them in with `react-native-reanimated` over ~400ms. No slide, no scale — just opacity.

---

## Verification

1. `npx tsc --noEmit -p mobile/tsconfig.json` passes
2. Complete a fresh voice session; confirm:
   - Results screen shows immediately with existing analysis
   - After ~10s, the overall insights fade in
   - Each insight is stacked vertically with the described typography
3. Open a historical session with existing `deep_insights`: insights render without delay
4. Open a historical session where deep insights don't exist: no section visible (render nothing)
5. Visually: matches the design brief — dim `OVERALL` tag above each headline, generous whitespace, no cards
6. Scroll: insights section scrolls with the rest of the screen (no pinned/sticky layout)

---

## Risks / watch out for

- **Mixing with specific insights.** `DeepInsight[]` contains both types. This component must filter to `type === 'overall'`. Phase 5 handles the other half. Do not render specific insights here.
- **Long unpacks.** The prompt caps unpacks at 15 words, but an 8-word headline plus 15-word unpack can wrap. Test on the smallest supported device width (iPhone SE). If wrapping looks awkward, tighten letter-spacing or reduce headline size one notch.
- **Short sessions.** Some sessions (under 20s) may legitimately return zero insights. Render nothing — no placeholder, no "generating..." spinner after the fade-in window. Silence is by design.

---

## Out of scope

- Ribbon markers (Phase 5)
- Deep linking to a specific insight from outside the screen
- Saving / sharing individual insights (V2)
- Tap-to-expand unpacks beyond one sentence (the one sentence is the whole unpack)
