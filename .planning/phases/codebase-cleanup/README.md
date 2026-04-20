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
| B | Legacy `score` alias removal | `phase-b.md` (TBD) | next |
| C | Rename + move (SessionRow, FrequencyStrip) | `phase-c.md` (TBD) | pending |
| D | Hook consolidation (voice + recording) | `phase-d.md` (TBD) | pending |
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

Each phase plan file will be written **only when starting that phase** (to reflect the actual state after the previous phase lands).

---

## Decisions locked

- **`mobile/.design-extract/`** → delete (happens in Phase A).
- **Phase F (cosmetic reshuffle)** → include, final phase.
- **Root `/ios/Pods/Target Support Files/Pods-Reframe/`** → confirmed orphan (no xcworkspace/xcodeproj anywhere in repo), delete in Phase A.
- **Legacy `.score` alias** → confirmed safe to remove in Phase B (only references in mobile are in dead `patterns/` dir being deleted in A2).
- **session-manager.ts SRP split** → deferred until Phases A–F complete.

---

## Golden rules

1. One commit per sub-step (e.g., A1, A2, ...). Easy rollback.
2. `npx tsc --noEmit` clean on both sides after every sub-step.
3. Manual smoke matrix (§8 of audit) after every phase completes.
4. If anything fails, revert to the previous commit and re-plan.
5. Never batch unrelated deletions; stay surgical.
