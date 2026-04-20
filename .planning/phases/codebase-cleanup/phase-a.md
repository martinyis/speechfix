# Phase A — Safe Dead-File Removal

**Goal**: Delete all code confirmed dead by the audit. Pure deletion, no refactor, zero behavior change.
**Expected impact**: ~3,500 LOC off mobile, ~700 LOC off server, 4 dead directories gone.
**Branch**: `cleanup/phase-a-dead-code` (created at start)
**PR**: one single PR with per-step commits for per-step rollback.

---

## Step list (each step = one commit)

### Mobile deletions

- **A1** — Delete `mobile/components/button-showcase/` entirely (12 `Set*.tsx` + `archive/` + `index.ts`).
  - Re-verify: grep for `button-showcase` and `Set11GlassIconPill` across `mobile/` → must be 0 hits outside the dir.

- **A2** — Delete `mobile/components/patterns/` entirely (`CategoryCard.tsx`, `FeaturedPatternCard.tsx`, `HeatMapTimeline.tsx`, `InsightCard.tsx`, `MiniScoreRing.tsx`, `mockData.ts`, `index.ts`).
  - Re-verify: grep `from ['\"].*components/patterns['\"]` → 0 hits.

- **A3** — Delete 5 dead session-results cards:
  - `mobile/components/SessionSummaryCard.tsx`
  - `mobile/components/SessionInsightCard.tsx`
  - `mobile/components/SessionInsightsCard.tsx`
  - `mobile/components/SummaryBar.tsx`
  - `mobile/components/StickySessionBar.tsx`
  - Re-verify each: grep the filename → only self-references.

- **A4** — Delete 2 more dead components:
  - `mobile/components/FillerWordsSummary.tsx`
  - `mobile/components/SessionRow.tsx` (top-level, not `session-variants/VariantC.tsx`)
  - Re-verify: grep filenames → only self-references.

- **A5** — Slim `mobile/components/lab/`:
  - Delete `FrequencySwitcher.tsx`
  - Delete `mockModes.ts`
  - Update `mobile/components/lab/index.ts` to only export `FrequencyStrip` / `StripMode`
  - Re-verify: grep `FrequencySwitcher`, `MOCK_MODES`, `MockMode` → 0 hits outside the deleted files.

- **A11** — Delete `mobile/.design-extract/` (9 frame JPGs) — user-confirmed to remove.
  - Re-verify: grep `.design-extract` → 0 hits.

- **A12** — Delete `mobile/dist/` contents (stale Expo web bundle, gitignored).
  - Just the contents; dir can stay empty if Expo regenerates.

### Server deletions

- **A6** — Delete `server/src/routes/patterns.ts`.
  - Remove `import { patternRoutes }` + `app.register(patternRoutes)` from `server/src/index.ts`.
  - Re-verify: grep `patternRoutes` → 0 hits after edit.

- **A7** — Trim `server/src/routes/sessions.ts`:
  - Delete `POST /sessions` handler block.
  - Delete local `computeClarityScore()` helper (only used there).
  - Keep `GET /sessions`, `GET /sessions/:id`, `GET /filler-summary`.
  - Re-verify: grep `computeClarityScore` → 0 hits after edit.

- **A8** — Trim `server/src/services/transcription.ts`:
  - Delete `transcribe()` function.
  - Delete `stripSilence()` function.
  - Keep `transcribeRawPCM()` and internal `callDeepgram()`.
  - Update file header comment.
  - Re-verify: grep `\btranscribe\(`, `\bstripSilence\(` → 0 hits after edit.

- **A9** — Delete `runAnalysisStreaming` from `server/src/analysis/runner.ts`:
  - Remove function definition.
  - Remove re-export in `server/src/analysis/index.ts`.
  - Remove unused import in `server/src/voice/handlers/conversation-handler.ts`.
  - Re-verify: grep `runAnalysisStreaming` → 0 hits after edit.

- **A10** — Delete project-root `/ios/` directory (orphan `Pods/Target Support Files/Pods-Reframe/`).
  - Confirmed: no xcworkspace/xcodeproj anywhere in repo (Expo regenerates).
  - Confirmed: root `.gitignore` already lists `ios/` — filesystem will align with gitignore.
  - Re-verify: grep `Pods-Reframe` → 0 hits (already confirmed).

---

## Verification gates

### After every sub-step
- [ ] `cd mobile && npx tsc --noEmit` clean
- [ ] `cd server && npx tsc --noEmit` clean
- [ ] Commit with short message: `chore(cleanup): A<N> — <what>`

### After Phase A complete (before merge)
- [ ] Metro/Expo starts with no "cannot resolve" warnings
- [ ] Manual smoke matrix (§8 of audit):
  1. Sign in → voice session → session detail renders
  2. Home tab → open session row → verdict + pitch ribbon + corrections
  3. Practice tab → Corrections / Weak Spots / Fillers / Patterns modes all load
  4. Weak-spot drill start → pass/fail → back to list
  5. Pattern exercise complete → auto-promote next
  6. Voice session end → new session row appears <15s
  7. Filler Coach flow → results screen → session in list
  8. Profile → open agent → create agent voice flow

### Log sanity
- [ ] No `[grammar-analyzer] Failed` during smoke
- [ ] No `[voice-session] Deepgram error` during smoke
- [ ] No "Cannot find module" in Metro

---

## Rollback policy

If any step fails typecheck OR smoke: `git reset --hard HEAD~1` on the failing sub-step, investigate, amend the plan before retrying. Don't push through a typecheck failure.

---

## Out of scope for Phase A

- Any rename or move (Phase C)
- Any hook consolidation (Phase D)
- Any server handler dedup (Phase E)
- Any folder reorganization (Phase F)
- Legacy `.score` alias (Phase B — needs explicit removal step after confirming all consumers)
