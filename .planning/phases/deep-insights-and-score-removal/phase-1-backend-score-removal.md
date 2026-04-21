# Phase 1 — Backend: Score Removal

**Goal:** Remove every trace of delivery_score, language_score, and clarity_score from the backend. No scoring logic, no DB column, no WebSocket payload field.

**Depends on:** — (none; can run in parallel with Phase 2)
**Blocks:** Phase 3 (frontend score removal)
**Estimated effort:** small (mechanical, well-scoped)

---

## Scope

### Files to modify

| File | Change |
|---|---|
| `server/src/modules/sessions/scoring.ts` | **Delete entirely.** Contains only `computeDeliveryScore` and `computeLanguageScore`. |
| `server/src/modules/sessions/insights-generator.ts` | Remove `import { computeDeliveryScore }`. Remove the score computation and the `{ type: 'delivery_score', ... }` insight push. Update `PhasedInsightsPayload` return shape to drop `deliveryScore` and `languageScore`. |
| `server/src/analysis/types.ts` | Remove `deliveryScore: number \| null` and `languageScore: number \| null` from `PhasedInsightsPayload`. Remove `'delivery_score'` and `'language_score'` from the `SessionInsight` type union (and the corresponding value field if score-specific). |
| `server/src/modules/voice/handlers/types.ts` | Remove `clarityScore`, `deliveryScore`, `languageScore` from `SessionEndResult` (lines 23–25). |
| `server/src/modules/voice/handlers/conversation-handler.ts` | Remove `computeLanguageScore` import. Remove `clarityScore` computation. Remove `clarityScore`/`deliveryScore`/`languageScore` from session insert, returned `SessionEndResult`, and anywhere they're passed to the client (lines 102–105, 131, 160, 195–196, 206, 226, 260–269, 280, 294–296). |
| `server/src/analysis/runner.ts` | Remove `deliveryScore: null, languageScore: null` from `emptyPayload` (lines 72–79). Remove any forwarding of these fields. |
| `server/src/modules/sessions/routes.ts` | Remove `clarityScore` from the session list query select (line 18). |
| `server/src/modules/voice/session-manager.ts` | Remove `deliveryScore`, `languageScore`, `clarityScore` from the `analysis_complete` WebSocket payload (lines 931–932, 967–969). |
| `server/src/modules/agents/greeting-generator.ts` | Remove `clarityScore` from `ctx.lastSession` reads (lines 21, 55, 85). Remove the `"clarity: ${ctx.lastSession.clarityScore}%"` injection (line 146) — greeting prompt drops that line entirely. |

### DB migration

New Drizzle migration to drop `clarity_score` column:

```
server/drizzle/<NN>_drop_clarity_score.sql
```

- Adjust `server/src/db/schema.ts` — remove `clarityScore: integer('clarity_score')` from `sessions` table.
- Generate migration via `npm run db:generate` (which calls drizzle-kit).
- The migration file should be reviewable as a plain `ALTER TABLE sessions DROP COLUMN clarity_score` — do not keep the column around "just in case."

### No longer needed types

- Any field values like `{ type: 'delivery_score' | 'language_score', value: number }` in `SessionInsight`. Audit these are dropped cleanly.

---

## Verification

1. `npx tsc --noEmit -p server/tsconfig.json` passes with zero new errors
2. `grep -rE "deliveryScore|languageScore|clarityScore|computeDeliveryScore|computeLanguageScore" server/src/` returns **nothing** (including comments)
3. `grep -rE "delivery_score|language_score|clarity_score" server/src/` returns **nothing**
4. `npm run db:generate` produces a clean migration that only drops the `clarity_score` column
5. Start the server, run a real voice session end-to-end, confirm the `analysis_complete` WebSocket payload has NO score fields (can inspect via mobile logs or a curl/websocat test)
6. Greeting generation still works (regenerate a greeting, confirm it doesn't crash and doesn't include clarity percentage in the prompt)

---

## Risks / watch out for

- **Frontend type mirror.** `mobile/types/session.ts` also has `PhasedInsightsPayload` with score fields and `SessionListItem.clarityScore`. DO NOT touch mobile types here — Phase 3 handles that. But be aware: between shipping Phase 1 and Phase 3, the mobile client will attempt to read fields the server no longer sends. This is acceptable because the fields are optional/nullable on mobile and rendering defensively defaults to no-display. Verify this claim during the audit in Phase 3 before shipping Phase 1 alone.
- **Archive / analytics readers.** If any external analytics or scripts read `clarity_score`, they'll break. Audit: `grep -r "clarity_score" .` outside `server/src/` and `mobile/`. Likely nothing, but check.
- **Sessions table history.** Existing sessions have historical `clarity_score` values. Dropping the column deletes that history. Confirm founder is OK with that (he said "no more score" — this is the literal interpretation).
- **Filler coach path.** `filler_coach_sessions` table and its handler are UNRELATED to regular sessions; do not touch.

---

## Out of scope

- Touching anything in `mobile/`
- Replacing scores with any fallback metric
- Modifying the `delivery_score` value in existing historical session JSONB (`sessions.analysis.sessionInsights[]`) — leave history intact; just stop producing new ones
