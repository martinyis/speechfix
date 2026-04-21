# Phase 2 — Backend: Deep-Insights Wiring

**Goal:** Integrate `generateDeepInsights()` into the live voice session pipeline. Persist results to DB. Return them to the client via the existing WebSocket `analysis_complete` flow.

**Depends on:** — (none; can run in parallel with Phase 1)
**Blocks:** Phase 4, Phase 5 (frontend needs the new payload)
**Estimated effort:** medium

---

## Current state (already done, do NOT redo)

- ✅ `server/src/modules/sessions/deep-insights.ts` exists and is tested end-to-end against real sessions
- ✅ `DeepInsight` / `DeepInsightAnchor` types defined
- ✅ System prompt + user prompt builder + JSON parser done
- ✅ Works on Opus 4.6 with ~10s latency, ~2000 input tokens, ~400 output tokens per session

What's missing: nothing is calling `generateDeepInsights()` outside the test script.

---

## Scope

### 1. Schema — add storage for deep insights

**File:** `server/src/db/schema.ts`

Add to the `sessions` table:

```ts
deepInsights: jsonb('deep_insights'),
```

The column holds `DeepInsight[]` or `null`. Generate a migration:

```
server/drizzle/<NN>_add_deep_insights.sql
```

### 2. Hook into the analysis pipeline

**File:** `server/src/modules/voice/handlers/conversation-handler.ts`

Currently the handler:
1. Runs analysis (grammar + fillers + insights) via `runAnalysis` or `runAnalysisPhased`
2. Inserts the session row with `analysis` JSONB
3. Runs post-analysis side effects (`absorbCorrections`, `runPatternAnalysisForUser`, etc.) fire-and-forget

**Add:** after the session is inserted and corrections/fillers are persisted, call `generateDeepInsights()` and:
- On success: `UPDATE sessions SET deep_insights = $1 WHERE id = $2`
- On failure: log the error, store `null`, do not block session completion
- Run it **fire-and-forget** like the other post-analysis side effects (`absorbCorrections`) — do not block the WebSocket `analysis_complete` response

### 3. Stream deep insights to client

Deep insights take ~10s on Opus and ~5s on Sonnet. The existing `analysis_complete` message fires as soon as grammar analysis is done (varies, sometimes before deep-insights completes). Two options:

**Option A (recommended):** Add a new WebSocket message `deep_insights_complete`
- Fires once `generateDeepInsights` finishes
- Payload: `{ type: 'deep_insights_complete', sessionId, insights: DeepInsight[] }`
- Client already holds the open WebSocket (for streaming corrections); just listens for this new message
- Pro: fast initial render, insights appear as a second reveal
- Con: two event types for the client to handle

**Option B:** Block `analysis_complete` until deep-insights done
- Simpler client logic, single payload
- Adds ~10s to perceived wait → bad UX

**Go with Option A.** Declare the new message in `server/src/modules/voice/session-manager.ts` alongside where `analysis_complete` is sent.

### 4. REST fallback endpoint

Add `GET /sessions/:id/deep-insights` that returns the stored `deep_insights` column. Used for:
- Historical sessions that didn't have deep insights at the time they were recorded (can be lazily computed on first view)
- Client refresh / deep-link into an older session

Route file: `server/src/modules/sessions/routes.ts`

### 5. Backfill on-demand (optional but nice)

If `GET /sessions/:id/deep-insights` is called and `deep_insights` is `null` for a completed session, run `generateDeepInsights` synchronously, save, and return. Add a header/query flag `?generate=1` so the backfill only happens when explicitly requested, to avoid runaway cost.

### 6. Model selection

Default: `claude-opus-4-6` for quality (confirmed with founder — he wants the "wow" bar, cost/latency acceptable for per-session analysis).

Make it configurable via env var `DEEP_INSIGHTS_MODEL` with fallback to `claude-opus-4-6`. Allows future A/B against Sonnet.

---

## Files to create

- Drizzle migration: `server/drizzle/NNNN_add_deep_insights.sql`

## Files to modify

- `server/src/db/schema.ts` — add `deepInsights` column
- `server/src/modules/voice/handlers/conversation-handler.ts` — trigger generator, persist result
- `server/src/modules/voice/session-manager.ts` — add `deep_insights_complete` WebSocket message type
- `server/src/modules/sessions/routes.ts` — add GET endpoint (+ optional lazy-backfill)

## Files to keep as-is

- `server/src/modules/sessions/deep-insights.ts` — DO NOT MODIFY (already tested; prompt finalized)
- `server/scripts/test-deep-insights.ts` — keep for ongoing prompt iteration

---

## Verification

1. `npx tsc --noEmit -p server/tsconfig.json` passes
2. `npm run db:generate` produces clean migration
3. Run a real voice session end-to-end. Observe server logs:
   - `[conversation-handler] Session stored: NN`
   - `[deep-insights] generated 3 insights for session NN in 9240ms` (or similar)
4. Query the DB: `SELECT deep_insights FROM sessions WHERE id = NN;` — returns valid JSON with the `DeepInsight[]` shape
5. Via mobile debug logs or websocat: the `deep_insights_complete` message arrives with the correct shape after `analysis_complete`
6. Hit `GET /sessions/<id>/deep-insights` — returns `{ insights: DeepInsight[] }` for the session just recorded
7. For a historical session with `null` deep_insights: `GET /sessions/<id>/deep-insights?generate=1` triggers the generator, persists, and returns results

---

## Risks / watch out for

- **Cost.** Opus is $15/M input, $75/M output. Average session ~2000 in + 400 out ≈ $0.06/session. For a power user doing 5 sessions/day, that's ~$9/month/user just for insights. **Mitigation:** provide `DEEP_INSIGHTS_MODEL` env to downgrade to Sonnet if needed; consider caching or disabling for free-tier users in future billing work.
- **Latency.** 10s generation is fine fire-and-forget. Do NOT put this on the critical path of `analysis_complete`.
- **Anchor drift.** If the AI returns a `start_seconds` that exceeds `durationSeconds`, clamp it client-side when rendering to avoid off-ribbon markers. Server-side validation is nice-to-have but not blocking.
- **Prompt injection via transcript.** Transcripts go into a user message. An attacker could craft speech to attempt prompt injection. Mitigation: the system prompt is strict about JSON-only output and we parse defensively. Accepted risk for V1.
- **Empty insights.** If the AI returns `[]`, persist `[]` (not `null`) so we know generation ran and the model chose silence.

---

## Out of scope

- Cross-session aggregation of deep insights (park for future)
- Prompt tuning / A/B testing infrastructure (manual via `DEEP_INSIGHTS_MODEL` for now)
- Rate limiting the backfill endpoint (add if/when abused)
