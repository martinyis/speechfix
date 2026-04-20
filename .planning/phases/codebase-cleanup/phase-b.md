# Phase B — Legacy `score` Alias Removal

**Source audit**: `.planning/audits/codebase-audit-2026-04-20.md` (S13 + §6 Phase B + §9 Risk #4)
**Depends on**: Phase A merged (it is — see `README.md`).
**Branch to create**: `cleanup/phase-b-score-alias`
**Expected impact**: 4 files edited, ~10 LOC net removed. Zero behavior change for mobile clients.
**Expected effort**: 15–30 minutes.

---

## One-paragraph briefing (read this first if you have no prior context)

The server used to emit a single `score` field on voice-session WebSocket payloads. During the session-results redesign, this was split into `deliveryScore` (how well the user delivered) and `languageScore` (language quality). To avoid breaking the mobile client during migration, a `score` alias was kept on two server types + populated on two WebSocket emissions. Both are marked `@deprecated` in the code. Phase A removed the last mobile consumer (`components/patterns/` tree, which had the only remaining `.score` reads on a non-session `category.score`). This phase removes the server-side alias entirely.

---

## Preconditions (verify before starting)

Run these checks. If any fails, STOP and re-plan.

1. `git status` → clean working tree.
2. `git rev-parse --abbrev-ref HEAD` → should be `main`.
3. `git log --oneline -3 | grep "mark phase A shipped"` → should match (confirms Phase A is merged).
4. **Mobile re-verification** (B1):
   - `rg "\b(session|result|payload|insights)\.score\b" mobile/` → **must be 0 hits**.
   - `rg "\bscore:\s*(number|null)" mobile/types/` → **must be 0 hits**.
   - If either returns hits, STOP. Mobile still reads the alias; we cannot remove it.

> **Verified as of 2026-04-20 by the Phase A session**: all preconditions passed. Re-check anyway — time may have passed.

---

## Scope

Remove the `score` field from **two server interfaces** and **three emission/assignment sites**. Nothing else.

**In scope:**
1. `PhasedInsightsPayload.score` in `server/src/analysis/types.ts`.
2. `SessionEndResult.score` in `server/src/voice/handlers/types.ts`.
3. `session-manager.ts` line ~932 — `score: payload.score,` inside `insights_ready` payload.
4. `session-manager.ts` line ~971 — `score: result.score,` inside `analysis_complete` payload.
5. `analysis/runner.ts` line ~73 — `score: null,` inside the empty-session `PhasedInsightsPayload` literal.

**Out of scope** (DO NOT touch in this phase):
- `SessionInsight.type: 'score'` union member in `server/src/analysis/types.ts` (~line 40). This is a **different** `score` — it tags an insight object as being a score insight, not an alias. Audit does not flag this.
- `clarityScore` anywhere — that's a real, live field, not the alias.
- `deliveryScore` / `languageScore` — the replacements; keep them.
- Anything in `session-manager.ts` besides the two `score:` assignment lines.
- Any `@deprecated` comments on fields other than `score`.

---

## Execution (step-by-step, one commit each)

Each sub-step is its own commit for clean rollback.

### B2a — Remove `PhasedInsightsPayload.score`

**File**: `server/src/analysis/types.ts`

**Current state** (around line 47–62):
```ts
export interface PhasedInsightsPayload {
  /** @deprecated alias for legacy readers — mirrors deliveryScore (or languageScore if delivery null). Remove in Phase 3. */
  score: number | null;
  deliveryScore: number | null;
  languageScore: number | null;
  insights: SessionInsight[];
  ...
}
```

**Edit**: delete the `@deprecated` comment line and the `score: number | null;` line. Result:
```ts
export interface PhasedInsightsPayload {
  deliveryScore: number | null;
  languageScore: number | null;
  insights: SessionInsight[];
  ...
}
```

Also update `server/src/analysis/runner.ts` in the SAME commit — find the empty-session payload literal around line 71–80:
```ts
    const emptyPayload: PhasedInsightsPayload = {
      score: null,
      deliveryScore: null,
      ...
    };
```
Delete the `score: null,` line.

**Verify**:
- `cd server && npx tsc --noEmit 2>&1 | grep -c "error TS"` → should equal the baseline (**1** as of end of Phase A — a pre-existing Buffer/fetch issue in `transcription.ts`). If it goes above 1, something else in the server still references `.score` on the payload; DO NOT suppress it, investigate.

**Commit**: `chore(cleanup): B2a — remove score alias from PhasedInsightsPayload`

### B2b — Remove `SessionEndResult.score`

**File**: `server/src/voice/handlers/types.ts`

**Current state** (around line 20–43):
```ts
export interface SessionEndResult {
  type: 'analysis' | 'onboarding' | 'agent-created' | 'filler-practice';
  dbSessionId?: number;
  clarityScore?: number;
  /** @deprecated alias kept for legacy readers — equals languageScore ?? deliveryScore. */
  score?: number | null;
  deliveryScore?: number | null;
  languageScore?: number | null;
  ...
}
```

**Edit**: delete the `@deprecated` comment and the `score?: number | null;` line.

**Verify**: `npx tsc --noEmit` on server → still 1 error (baseline). If >1, check whether a handler still returns a `score` field.

**Commit**: `chore(cleanup): B2b — remove score alias from SessionEndResult`

### B2c — Remove server emission of `score`

**File**: `server/src/voice/session-manager.ts`

Around line 926–942, the `insights_ready` payload:
```ts
        const onInsightsReady = (payload: any, dbSessionId: number) => {
          this.sendToClient({
            type: 'insights_ready',
            dbSessionId,
            data: {
              // Legacy alias (kept for one release)
              score: payload.score,
              deliveryScore: payload.deliveryScore ?? null,
              languageScore: payload.languageScore ?? null,
              ...
            },
          });
        };
```

**Edit**: delete both the `// Legacy alias ...` comment and the `score: payload.score,` line.

Around line 958–976, the `analysis_complete` payload:
```ts
          this.sendToClient({
            type: 'analysis_complete',
            ...
            data: {
              ...
              clarityScore: result.clarityScore,
              // Legacy alias (kept for one release)
              score: result.score,
              deliveryScore: result.deliveryScore ?? null,
              ...
            },
          });
```

**Edit**: delete the `// Legacy alias ...` comment and the `score: result.score,` line.

> **Type safety note**: the `onInsightsReady` `payload` is typed `any`, and `sendToClient` data is an untyped object. TypeScript will NOT catch a dangling `payload.score` read or emission on its own — manual grep is required. After the edits, run `rg "\bscore\s*:" server/src/voice/session-manager.ts` and confirm only `clarityScore: ...` remains.

**Verify**:
- `npx tsc --noEmit` on server → still 1 baseline error.
- `rg "\bscore\s*:\s*(payload|result)\.score" server/src/` → **must be 0 hits**.

**Commit**: `chore(cleanup): B2c — stop emitting legacy score alias in ws payloads`

---

## Post-phase verification

### Typecheck parity
- `cd mobile && npx tsc --noEmit 2>&1 | grep -c "error TS"` → **7** (baseline, unrelated).
- `cd server && npx tsc --noEmit 2>&1 | grep -c "error TS"` → **1** (baseline, unrelated).

### Manual smoke (required before merge — run on device)

The behavior-sensitive paths are **voice sessions that emit `insights_ready` and `analysis_complete`**. These go out over the WebSocket to mobile.

1. Sign in → start a voice session (any agent) → speak 2–3 sentences → end it.
2. **Check**: session detail screen renders with:
   - A **delivery score** (number) in the verdict.
   - A **language score** (number) in the verdict.
   - Pitch ribbon + corrections list populated.
3. Open Metro logs while this happens. Look for any "undefined" or red-screen errors around score display.
4. Open a previous session from the list — ensure older sessions still render (their scores are stored in DB `clarityScore`, unaffected by this change).

**Server log check** (tail `server/` logs while testing):
- Around session end you should see the usual `[conversation-handler]` logs.
- No new `TypeError: Cannot read property 'score'` lines.

If anything breaks → `git reset --hard HEAD~N` to before the failing sub-step. Most likely culprit if mobile breaks: mobile client was reading `.score` from an untyped WebSocket message despite our grep coming back clean (grep only catches literal `.score` reads — not destructuring like `{ score }`).

**Extra verification** (2 minutes, worth doing):
```bash
rg "\bscore\b" mobile/ --type ts --type tsx | grep -v "deliveryScore\|languageScore\|clarityScore\|\.score.*category"
```
Any remaining hits of a bare `score` on something that looks like session data → investigate before merge.

---

## Merge procedure

Same as Phase A:
1. All sub-step commits on `cleanup/phase-b-score-alias`.
2. Smoke test passes on device.
3. `git checkout main && git merge --ff-only cleanup/phase-b-score-alias`.
4. Delete local branch: `git branch -d cleanup/phase-b-score-alias`.
5. DO NOT push to origin unless the user explicitly asks.
6. Update `README.md` in this dir: flip Phase B row to SHIPPED + date + summary.
7. Commit the README update directly to main: `chore(cleanup): mark phase B shipped in master plan`.

---

## Rollback policy

- Each sub-step is its own commit. If B2c breaks smoke, `git reset --hard HEAD~1` and keep B2a/B2b (those are type-only changes and can't break runtime).
- If typecheck goes above baseline on B2a or B2b, something still references the removed field. DO NOT add `as any` casts to paper over it; find the real reference and decide if it should migrate to `deliveryScore`/`languageScore` or if we need to roll back and re-scope.
- If mobile breaks because the WebSocket payload shape changed unexpectedly, the fix is to restore the emission only (the type-only changes in B2a/B2b are fine to keep). But investigate first — this would mean some mobile code reads `.score` that the audit + grep didn't catch, which is itself important to discover.

---

## Out-of-scope reminders

- **Do NOT touch** `SessionInsight.type: 'score'` union member. Different concept.
- **Do NOT** refactor, rename, or move anything else. This phase is purely additive-deletion of the alias.
- **Do NOT** push to origin without asking the user.
- **Do NOT** co-author commit messages ("Co-Authored-By" lines are banned per user's global CLAUDE.md).
- **Do NOT** start Phase C after finishing B. Wait for the user to kick off the next phase with a fresh agent + `phase-c.md`.

---

## What to hand back to the user when done

A short report:
```
Phase B complete.
- Branch: cleanup/phase-b-score-alias (merged to main, deleted)
- Commits: B2a, B2b, B2c + README update (4 total)
- Files touched: 4 (analysis/types.ts, voice/handlers/types.ts, analysis/runner.ts, voice/session-manager.ts)
- Net LOC: -N (actual count from `git diff --stat main~4..main`)
- Typecheck: mobile 7 / server 1 (both baseline)
- Smoke: PASSED on device (user ran it)
- Ready for Phase C.
```
