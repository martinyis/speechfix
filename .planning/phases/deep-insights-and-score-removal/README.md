# Deep Insights + Score Removal — Master Plan

**Status:** Ready for execution (per-phase agents)
**Owner:** Martin
**Started:** 2026-04-21
**Prompt module:** `server/src/modules/sessions/deep-insights.ts` (prompt + anchor schema already finalized)
**Test script:** `server/scripts/test-deep-insights.ts` (verified against real sessions — output quality meets bar)

---

## Goal

Replace scores with a new AI-powered **Deep Insights** feature that gives users *"wow, I didn't know that about myself"*-level feedback about how they speak.

Two insight types:

- **Overall** — session-wide behavioral patterns (no time anchor)
- **Specific** — causal moment-level observations (with time anchor: point or range)

Display:

- **Overall** insights → editorial text stack (headline + one-line unpack)
- **Specific** insights → markers on the existing Skia pitch ribbon (point = dot, range = bracket); tap → insight text + optional audio scrub

Scores (delivery, language, clarity) are removed entirely from backend and frontend.

---

## Why

1. Scores are motivational noise. The founder decided they distract from the real value: insight quality.
2. The audit of existing session data confirms we have dense-enough signals (per-word timings, 200ms prosody samples, pauses, fillers, transcript, corrections) to power cross-signal insights.
3. Real-session test runs against Opus produced insights that hit the "wow" bar (see `.planning/deep-insights-tests/` after a run).

---

## Dependencies between phases

```
Phase 1 (backend: remove scores) ──┐
                                   ├─► Phase 3 (frontend: remove scores)
Phase 2 (backend: wire insights) ──┤
                                   ├─► Phase 4 (frontend: overall text section)
                                   └─► Phase 5 (frontend: ribbon markers)
```

- **Phase 1 & 2 can run in parallel** (both backend, non-overlapping files).
- **Phase 3 can start once Phase 1 ships** (frontend needs the backend payload change to not break).
- **Phase 4 and Phase 5 can run in parallel** once Phase 2 ships, but both depend on the new `deep_insights` field being present on session payload.
- **Phase 3 must NOT be skipped or delayed past Phase 4** — a half-removed score UI is worse than no change.

---

## Phases

| # | Phase | Surface | Depends on | Parallelizable with |
|---|---|---|---|---|
| 1 | [Backend: score removal](./phase-1-backend-score-removal.md) | server | — | Phase 2 |
| 2 | [Backend: deep-insights wiring](./phase-2-backend-insights-wiring.md) | server | — | Phase 1 |
| 3 | [Frontend: score removal](./phase-3-frontend-score-removal.md) | mobile | Phase 1 | — |
| 4 | [Frontend: overall insights UI](./phase-4-frontend-overall-ui.md) | mobile | Phase 2 | Phase 5 |
| 5 | [Frontend: ribbon markers for specifics](./phase-5-frontend-ribbon-markers.md) | mobile | Phase 2 | Phase 4 |

---

## What's already done (do not redo)

- ✅ Deep-insights module exists (`server/src/modules/sessions/deep-insights.ts`) with:
  - `DeepInsight` type with `type`, `headline`, `unpack`, `signals_used`, optional `anchor`
  - `DeepInsightAnchor` type with `kind: 'point' | 'range'`, `start_seconds`, `end_seconds`, `utterance_index`, `quoted_text`
  - Full system prompt (terse voice, two types, causal language rules, no numbers, no error-correlation, permission to return nothing, few-shot examples)
  - `buildUserPrompt` emits per-utterance timestamps + per-word timings so AI can populate anchors accurately
  - Robust JSON parser with anchor validation
- ✅ Test script (`server/scripts/test-deep-insights.ts`) that runs module against real DB sessions, dumps JSON per session
- ✅ Prompt verified end-to-end on real session #35 — 5 insights produced, anchors populated, quality meets bar

**The module is NOT yet wired into the live analysis pipeline. That's Phase 2.**

---

## Success criteria (cross-phase)

The feature ships when all five of these are true:

1. ✅ Running a voice session end-to-end stores deep insights in DB and returns them to the client
2. ✅ Results screen has zero score UI (no ring, no badge, no "X/100")
3. ✅ Results screen shows overall insights as editorial text
4. ✅ Results screen shows ribbon markers for specific insights; tapping opens the insight + scrubs audio
5. ✅ No orphaned references: `grep -r "deliveryScore\|languageScore\|clarityScore" server/src mobile` returns nothing material (only possibly test fixtures or archive)

---

## Out of scope (park for later)

- **Cross-session deep insights** — today's feature is per-session. Cross-session pattern detection already exists (`speech_patterns`) and can later be augmented with deep-insights aggregation across sessions.
- **Voice narration / TTS of insights** — text-only for V1.
- **User feedback on insight quality** — no thumbs up/down collection yet. Add later to tune prompt.
- **Insight prompt centralization** — founder said "forget about it, just improve the prompt" — do not create a new `prompts/` directory or refactor where prompts live.
- **Onboarding copy / empty states** — not part of this plan unless score removal leaves dead empty-state copy; see Phase 3.
