# Phase 3 — Frontend: Score Removal

**Goal:** Remove every score rendering, store field, and type reference from the mobile app.

**Depends on:** Phase 1 (backend score removal)
**Blocks:** Phase 4 & 5 (cleaner base for new insights UI)
**Estimated effort:** small

---

## Scope

### Delete entirely

| File | Notes |
|---|---|
| `mobile/components/session/ScoreRing.tsx` | 175-line animated ring component. Nothing else should use this after deletion — if a reference remains, it's a leak. |

### Modify

| File | Change |
|---|---|
| `mobile/components/session/SessionVerdict.tsx` | Remove the `readScore()` helper, `delivery`/`language`/`legacy` variables (lines 21–33), the `hasTwin` branch and twin-rings block (lines 36, 53–73), and the legacy fallback block (76–84). Keep only the metric strip + verdict text parts that remain after scores are gone. If the whole component becomes trivially thin, consider inlining into `session-detail.tsx` — but prefer keeping it as a named component for clarity. |
| `mobile/components/session/SessionRow.tsx` | Remove `getScoreColor()` (13–18), `score = item.clarityScore ?? null` (70), conditional score badge render (127), score tag icon/percentage block (135–153). The session row should still show title/duration/date — just no score pill. |
| `mobile/types/session.ts` | Remove `deliveryScore: number \| null` and `languageScore: number \| null` from `PhasedInsightsPayload` (lines 47–60). Remove `'delivery_score'` and `'language_score'` from the `SessionInsight` type union (31–45). Remove `clarityScore?: number \| null` from `SessionListItem` (150). |
| `mobile/stores/sessionStore.ts` | Remove `deliveryScore` and `languageScore` params from `setInsightsReady()` (41–49) and `finalizeStreamingSession()` (51–61). Remove any internal state fields holding those values. |
| `mobile/app/session-detail.tsx` | Wherever `SessionVerdict` is rendered (line 145–151), adjust props to no longer pass score-related insight filtering. |

### Copy hunt

After removing scores, search mobile for any UI copy that names scoring:

- `"Delivery"` as a score label
- `"Language"` as a score label
- `"out of 100"`, `"/100"`, `%` near score contexts
- Strings like `"Your score"`, `"Session score"`, `"Clarity score"`

If found, remove the string + its surrounding container.

---

## Verification

1. `grep -rE "deliveryScore|languageScore|clarityScore|ScoreRing|getScoreColor|readScore" mobile/` returns **nothing**
2. `grep -rE "delivery_score|language_score|clarity_score" mobile/` returns **nothing**
3. TypeScript check: `npx tsc --noEmit -p mobile/tsconfig.json` passes
4. Open the app, complete a session, confirm the results screen has no ring, no percentage, no score badge
5. Open an older historical session — same confirmation
6. Home screen / session list — no score tag on row cards

---

## Risks / watch out for

- **Empty SessionVerdict.** After removing both the twin-ring block and the legacy-ring block, the component may be visually thin. That's fine — placeholder for where the new insights UI will land in Phase 4. Do not add filler.
- **Stale session data.** Historical sessions' `analysis.sessionInsights[]` may still contain `{ type: 'delivery_score', value: 87 }` entries. The type removal means these won't deserialize cleanly if strict. Use a permissive parser or filter `sessionInsights` to known types before rendering. Do not attempt to clean the old DB JSONB — historical values are frozen.
- **Onboarding gate.** Check `mobile/app/(onboarding)/` — no score references expected, but verify.
- **Test fixtures.** Any mock / stub data in `mobile/` with score fields should also be cleaned.

---

## Out of scope

- Backend changes (Phase 1 handles those)
- Adding replacement UI (Phases 4/5)
- Removing scores from design docs in `.planning/design/` (docs can be stale; focus on shipped code)
