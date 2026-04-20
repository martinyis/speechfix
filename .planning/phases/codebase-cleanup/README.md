# Codebase Cleanup — Master Plan

**Source audit**: `.planning/audits/codebase-audit-2026-04-20.md`
**Start date**: 2026-04-20
**Owner**: Claude + Martin

---

## Goal

Land the full audit cleanup in 6 sequential phases, one PR per phase, each independently revertible. Net expected outcome:
- Mobile: ~3,500 LOC deleted, ~700 LOC consolidated.
- Server: ~700 LOC deleted, 1 dead route / 1 dead export / 1 dead handler path consolidated.
- Zero behavior change.

After all 6 phases ship cleanly, proceed to the **session-manager.ts SRP split** (N4) as a separate multi-phase initiative.

---

## Phase sequence

| Phase | Scope | Plan file | Status |
|---|---|---|---|
| A | Safe dead-file removal (pure deletion) | `phase-a.md` | **SHIPPED 2026-04-20** — ~6,240 LOC deleted, merged to main |
| B | Legacy `score` alias removal | `phase-b.md` | **SHIPPED 2026-04-20** — 13 LOC deleted across 7 files, merged to main |
| C | Rename + move (SessionRow, FrequencyStrip) | `phase-c.md` | **SHIPPED 2026-04-20** — 3 atomic commits, 7 files touched, ~0 net LOC, merged to main |
| D | Hook consolidation (voice + recording) | `phase-d.md` (TBD) | next |
| E | Server handler dedup (onSessionEnd paths) | `phase-e.md` (TBD) | pending |
| F | Cosmetic component reorganization | `phase-f.md` (TBD) | pending |
| — | **Follow-up**: session-manager.ts SRP split | separate initiative | later |

### Phase A — shipped summary
- 9 atomic commits on `cleanup/phase-a-dead-code`, fast-forwarded to `main`.
- Mobile: 6,018 LOC deleted (button-showcase, patterns tree, 5 session cards, FillerWordsSummary, old SessionRow, FrequencySwitcher + mockModes).
- Server: 222 LOC deleted (/patterns route, dead POST /sessions + computeClarityScore, transcribe + stripSilence, runAnalysisStreaming).
- A10 (root /ios/ orphan) and A11 (.design-extract/) resolved as untracked-dir cleanups; A12 (mobile/dist/) was already clean.
- Typecheck parity: mobile 7 baseline errors + server 1 baseline error, both pre-existing and unrelated to cleanup. Zero new errors introduced.
- Smoke matrix passed on device by Martin.

### Phase B — shipped summary
- 4 atomic commits on `cleanup/phase-b-score-alias`, fast-forwarded to `main`: B2a, B2b, B2c, B2d.
- Server: removed the `@deprecated` `score` alias from `PhasedInsightsPayload` + `SessionEndResult`, plus 3 producer sites (`analysis/runner.ts`, `services/session-insights-generator.ts`, `voice/handlers/conversation-handler.ts`) and both WS emission sites in `voice/session-manager.ts` (`insights_ready` + `analysis_complete`). Server no longer produces `score` on the wire or in internal types.
- Mobile: removed the vestigial `score?: number | null` param fields on `setInsightsReady` and `finalizeStreamingSession` in `stores/sessionStore.ts` (unread; precondition grep only scanned `mobile/types/`).
- Plan deviations (all approved mid-phase): B2a extended with the `session-insights-generator.ts` producer the audit missed; B2b extended to include the `conversation-handler.ts` producer + `analysis_complete` consumer (plan's sub-step order could not satisfy tsc-at-baseline otherwise); B2d added for the mobile store gap.
- Net 13 LOC deleted across 7 files. Typecheck parity: mobile 7 / server 1 (both baseline, unchanged).
- Smoke passed on device by Martin.

### Phase C — shipped summary
- 3 atomic commits on `cleanup/phase-c-rename-move`, fast-forwarded to `main`: C1, C2, C3.
- C1: renamed export `SessionRowVariantC` → `SessionRow` (in the source file + barrel), dropped the `as SessionRow` alias at both importers (`all-sessions.tsx`, `(tabs)/index.tsx`).
- C2: `git mv mobile/components/session-variants/VariantC.tsx → mobile/components/SessionRow.tsx`; fixed 4 relative imports (theme / lib/formatters / AgentAvatar / types/session) for the new depth; updated both importers to the new path; deleted `session-variants/index.ts` barrel and the now-empty directory. Git kept it as a 96% rename.
- C3: `git mv mobile/components/lab/FrequencyStrip.tsx → mobile/components/practice/FrequencyStrip.tsx` (100% rename, no internal changes — `../../theme` resolves the same from both parents); updated the one importer in `app/(tabs)/practice.tsx` to import directly by file path (not via a barrel); deleted `components/lab/index.ts` and the now-empty directory.
- Plan deviation: plan claimed `components/practice/index.ts` barrel did not exist, but it does (6 pre-existing exports: PracticeModeSelector, CorrectionsMode, FillerWordsMode, PatternsMode, WeakSpotsMode, OrbitModeSwitcher). Plan's intent was followed: imported `FrequencyStrip` directly by file path, barrel left untouched. No behavior impact.
- Net ~0 LOC in source (pure rename/move). Typecheck parity: mobile 7 / server 1 (both baseline, unchanged).
- `app/lab/` route tree left intact per memory note (ongoing dev-only infra).
- Smoke passed on device by Martin.

Each phase plan file will be written **only when starting that phase** (to reflect the actual state after the previous phase lands).

---

## Decisions locked

- **`mobile/.design-extract/`** → delete (happens in Phase A).
- **Phase F (cosmetic reshuffle)** → include, final phase.
- **Root `/ios/Pods/Target Support Files/Pods-Reframe/`** → confirmed orphan (no xcworkspace/xcodeproj anywhere in repo), delete in Phase A.
- **Legacy `.score` alias** → removed in Phase B (shipped 2026-04-20).
- **session-manager.ts SRP split** → deferred until Phases A–F complete.

---

## Golden rules

1. One commit per sub-step (e.g., A1, A2, ...). Easy rollback.
2. `npx tsc --noEmit` clean on both sides after every sub-step.
3. Manual smoke matrix (§8 of audit) after every phase completes.
4. If anything fails, revert to the previous commit and re-plan.
5. Never batch unrelated deletions; stay surgical.
