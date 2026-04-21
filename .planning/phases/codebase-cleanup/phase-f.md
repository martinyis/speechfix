# Phase F — Cosmetic component reorganization

**Source audit**: `.planning/audits/codebase-audit-2026-04-20.md` (§3.3 N5 + §5 target tree + §6 Phase F + §9 Risk #3)
**Depends on**: Phases A + B + C + D + E merged (all are — see `README.md`).
**Branch to create**: `cleanup/phase-f-component-reshuffle`
**Expected impact**: ~27 file moves (no content changes), 6 new folders, all 58 external importers + ~25 intra-component importers updated to new paths. **Zero behavior change — pure renaming/moving**.
**Expected effort**: 1.5–2.5 hours of focused moving + import-path fixing.
**Review gate**: **F1 MUST be approved by user before F2 begins.** This phase has the largest git-diff of any cleanup phase. User sign-off is mandatory because every UI screen reviewer will see moved files (audit §9 Risk #3: "big git-diff, no behavior change — should only run with user sign-off because it's pure churn for reviewers"). F1 also contains the exact file→folder mapping, including one file the audit didn't classify (`PracticeTaskCard.tsx`, confirmed during F1 review as a **correction**-practice card and routed to `correction/`).

---

## One-paragraph briefing (read this first if you have no prior context)

`mobile/components/` currently has **30 flat top-level `.tsx` files** + 2 subfolders (`practice/` already feature-grouped, `ui/` primitives). At that scale, feature-grouping helps — a new engineer opening the folder shouldn't have to skim 30 sibling files to find the three that belong to "corrections". Phase F creates 6 new feature folders (`agent/`, `correction/`, `orbs/`, `pattern/`, `session/`, `voice/`), `git mv`s files into them per audit §5, and updates all call-site imports. Four generic/utility components (`GradientText`, `PracticeFeedbackPanel`, `StyleChips`, `SuccessCelebration`) stay at the top level per the audit's target. `components/practice/` and `components/ui/` are unchanged. No logic changes anywhere — if a diff on any moved file shows anything other than an import-path line edit, that's a bug. Every commit ends with `npx tsc --noEmit` clean on mobile (baseline 1) and a key-screen smoke on device. If a screen breaks after a move, the blame is almost always "forgot to update an importer" — grep fixes it in seconds.

---

## Preconditions (verify before starting)

Run these checks. If any fails, STOP and re-plan.

1. `git status` → clean working tree.
2. `git rev-parse --abbrev-ref HEAD` → should be `main`.
3. `git log --oneline -8 | grep "mark phase E shipped"` → should match (confirms Phase E is merged).
4. **Current-state inventory** (confirms audit's mapping still reflects the real tree; prior phases may have shifted things):
   - `ls mobile/components/*.tsx | wc -l` → **30** files at top level (±1 ok).
   - `ls mobile/components/` directories → exactly **`practice/` + `ui/`** (no others; `session-variants/` was deleted in C2, `lab/` in C3, `button-showcase/` + `patterns/` in A1/A2).
   - Every file named in §F1.1's mapping must exist at its expected source path. `ls` each one before starting — if any has moved, STOP and update §F1.1.
5. **Import footprint** (for sizing the codemod):
   - `rg "from ['\"].*components/" mobile/app mobile/components --type ts --type tsx | wc -l` → baseline number (~80). Re-check post-phase: same count (we change paths, not counts).
6. **Typecheck baseline**:
   - `cd mobile && npx tsc --noEmit 2>&1 | grep -c "error TS"` → **1** (post-Phase-E baseline; this is the pre-existing GradientText issue).
   - `cd server && npx tsc --noEmit 2>&1 | grep -c "error TS"` → **1** (baseline; server untouched in Phase F).

> If #4 returns unexpected file counts or directory set, the tree drifted between Phase E and F. STOP and reconcile §F1.1 before writing code.

---

## Scope

**In scope:**
1. Create 6 new folders under `mobile/components/`: `agent/`, `correction/`, `orbs/`, `pattern/`, `session/`, `voice/`.
2. `git mv` 27 files per the F1.1 mapping. File contents only change insofar as **relative import paths inside each moved file** must be re-anchored (e.g., `../theme` → `../../theme`).
3. Update every external importer (app screens, other components) to the new paths.
4. Leave `components/practice/` and `components/ui/` untouched (both are already feature-grouped).
5. Leave 4 files at top level: `GradientText.tsx`, `PracticeFeedbackPanel.tsx`, `StyleChips.tsx`, `SuccessCelebration.tsx` (generic utilities per audit §5 "After" tree).

**Out of scope** (DO NOT touch in this phase):
- **Any logic change.** If a file's diff shows anything other than import-path edits, that's a bug — revert and retry.
- **Renaming files.** Moves only, same filename. (`SessionRow.tsx` stays `SessionRow.tsx` in `session/`.)
- **Splitting `session-manager.ts`** (N4, explicitly deferred).
- **Adding barrel `index.ts` files** to the new folders. Consumers import by full path, matching the current style (see Phase C where we explicitly avoided creating barrels). Exception: `components/practice/index.ts` and `components/ui/index.ts` stay as-is (pre-existing, live consumers).
- **Moving or renaming `components/practice/` internals.** Its FrequencyStrip landing was done in C3. Leave it.
- **Moving `components/ui/` primitives.** All still live, all imported under `./ui` pattern.
- **Changing the four top-level stays.** Don't move `GradientText`, `PracticeFeedbackPanel`, `StyleChips`, or `SuccessCelebration` into a feature folder — audit kept them at root deliberately (generic primitives used in multiple features).
- **Introducing path aliases (e.g. `@components/session/...`)**. That's a codemod of its own; orthogonal to this phase. Keep relative paths.
- **Server changes.** Zero.
- **Pushing to origin without confirmation.**

---

## F1 — Design (THIS SECTION IS F1 — USER REVIEWS BEFORE F2 BEGINS)

### F1.1 — Exact file→folder mapping (every move)

Target tree matches audit §5 with one clarification noted below (PracticeTaskCard).

```
mobile/components/
├── agent/                              ← NEW
│   ├── AgentAvatar.tsx                 ← from mobile/components/AgentAvatar.tsx
│   ├── AgentCreationSheet.tsx          ← from mobile/components/AgentCreationSheet.tsx
│   ├── AgentSelector.tsx               ← from mobile/components/AgentSelector.tsx
│   └── VoicePicker.tsx                 ← from mobile/components/VoicePicker.tsx
├── correction/                         ← NEW
│   ├── CorrectionCard.tsx              ← from mobile/components/CorrectionCard.tsx
│   ├── CorrectionFilterChips.tsx       ← from mobile/components/CorrectionFilterChips.tsx
│   ├── CorrectionsPreview.tsx          ← from mobile/components/CorrectionsPreview.tsx
│   └── PracticeTaskCard.tsx            ← from mobile/components/PracticeTaskCard.tsx   (NOTE A)
├── orbs/                               ← NEW
│   ├── AISpeakingOrb.tsx               ← from mobile/components/AISpeakingOrb.tsx
│   ├── MicBloomOrb.tsx                 ← from mobile/components/MicBloomOrb.tsx
│   └── PracticeRecordOrb.tsx           ← from mobile/components/PracticeRecordOrb.tsx
├── pattern/                            ← NEW
│   ├── PatternTaskCard.tsx             ← from mobile/components/PatternTaskCard.tsx
│   └── QueuedPatternCard.tsx           ← from mobile/components/QueuedPatternCard.tsx
├── practice/                           ← UNCHANGED (pre-existing, feature-grouped)
├── session/                            ← NEW
│   ├── AnalyzingBanner.tsx             ← from mobile/components/AnalyzingBanner.tsx
│   ├── ConversationRhythmStrip.tsx     ← from mobile/components/ConversationRhythmStrip.tsx
│   ├── DeliverySignalStrip.tsx         ← from mobile/components/DeliverySignalStrip.tsx
│   ├── PitchRibbon.tsx                 ← from mobile/components/PitchRibbon.tsx
│   ├── PitchRibbonCaption.tsx          ← from mobile/components/PitchRibbonCaption.tsx
│   ├── ScoreRing.tsx                   ← from mobile/components/ScoreRing.tsx
│   ├── SessionFullReport.tsx           ← from mobile/components/SessionFullReport.tsx
│   ├── SessionPatterns.tsx             ← from mobile/components/SessionPatterns.tsx
│   ├── SessionRow.tsx                  ← from mobile/components/SessionRow.tsx
│   ├── SessionStrengthsFocus.tsx       ← from mobile/components/SessionStrengthsFocus.tsx
│   ├── SessionTranscript.tsx           ← from mobile/components/SessionTranscript.tsx
│   └── SessionVerdict.tsx              ← from mobile/components/SessionVerdict.tsx
├── ui/                                 ← UNCHANGED (pre-existing primitives)
├── voice/                              ← NEW
│   └── VoiceSessionOverlay.tsx         ← from mobile/components/VoiceSessionOverlay.tsx
├── GradientText.tsx                    ← STAYS (generic primitive)
├── PracticeFeedbackPanel.tsx           ← STAYS (shared across practice modes; cross-feature)
├── StyleChips.tsx                      ← STAYS (generic chip UI — used by home filters + practice modes)
└── SuccessCelebration.tsx              ← STAYS (generic celebration overlay)
```

**NOTE A — `PracticeTaskCard.tsx`:** The audit's §5 target tree doesn't explicitly map this file. Despite its `Practice*` name, it is a **correction**-practice card — it renders a single correction row (props: `correctionId`, `correctedText`, `severity`, `practiceCount`) and on tap routes to `/practice-session?mode=say_it_right`. Its only callers are `app/corrections-list.tsx` and `components/practice/CorrectionsMode.tsx` — both correction-facing. It therefore belongs in `correction/` alongside `CorrectionCard` / `CorrectionFilterChips` / `CorrectionsPreview`. It does **not** belong in `pattern/` (no pattern involvement) or `practice/` (reserved for practice-tab mode screens, not cards). Confirmed by user during F1 review on 2026-04-20.

### F1.2 — Import codemod pattern

For each moved file `components/X.tsx` → `components/<feature>/X.tsx`:

1. **Inside the moved file** (relative imports shift one level deeper):
   - `'../theme'` → `'../../theme'`
   - `'../lib/...'` → `'../../lib/...'`
   - `'../types/...'` → `'../../types/...'`
   - `'../stores/...'` → `'../../stores/...'`
   - `'../hooks/...'` → `'../../hooks/...'`
   - `'./ui'` → `'../ui'`  (when the file imports from `./ui` barrel)
   - `'./<Sibling>'` for sibling that's ALSO moving into the same folder → stays `'./<Sibling>'` (both end up in the same folder). **Watch out**: if the sibling is staying at root while this file moves, the path becomes `'../<Sibling>'`. Audit F1.1's mapping to decide.

2. **In every external importer** (under `mobile/app/` + other `mobile/components/` files):
   - `from '../components/X'` → `from '../components/<feature>/X'`
   - `from '../../components/X'` → `from '../../components/<feature>/X'`
   - `from './X'` (within `components/`) → `from './<feature>/X'` (or `'../<feature>/X'` depending on moved-importer depth).

**Mechanical codemod command per move (safest: grep-driven sed)**:
```bash
# Example for moving AgentAvatar into agent/
git mv mobile/components/AgentAvatar.tsx mobile/components/agent/AgentAvatar.tsx

# 1. Update import paths INSIDE the moved file (one level deeper)
#    → manually Edit the moved file; update `../theme` → `../../theme`, etc.

# 2. Update external importers
rg -l "from ['\"][\.\./]*components/AgentAvatar['\"]" mobile/ | while read f; do
  # sed pattern depends on file depth; safer to Edit each importer manually using the grep output.
done

# 3. Typecheck after each file moved
npx tsc --noEmit 2>&1 | grep -c "error TS"   # must stay at 1
```

**Reality check**: sed-driven import rewriting across varying file depths is error-prone. **The plan uses interactive Edit calls per importer**, guided by `rg -n "from ['\"].*components/<Name>['\"]"` output. That's more tool calls but more reliable. Expect **~80 Edit calls** across the whole phase (27 moved files × ~3 importers each, averaged).

### F1.3 — Commit granularity

**Per-feature-folder commits, not per-file.** 27 file-level commits would be noise; 1 mega-commit is unrevertable. Sweet spot: **one commit per feature folder + one final commit for intra-`components/` importer updates if any are left over.**

Proposed sequence:
- **F2** — move `agent/` (4 files + importers).
- **F3** — move `correction/` (3 files + importers).
- **F4** — move `orbs/` (3 files + importers).
- **F5** — move `pattern/` (3 files + importers).
- **F6** — move `session/` (12 files + importers). **Biggest commit.**
- **F7** — move `voice/` (1 file + importers).
- **F8** — (may not be needed) any leftover internal re-anchoring.

After each commit: `cd mobile && npx tsc --noEmit 2>&1 | grep -c "error TS"` → **1** (baseline). If ever above 1, fix before committing — don't commit a breaking state.

### F1.4 — Smoke cadence

**After each folder-level commit**, a quick device tap of the screens touched:
- **F2 (agent)**: Profile → Create agent → voice picker → confirm agent list renders.
- **F3 (correction)**: Home tab → any session → session detail → corrections preview + filter chips render; tap a correction. Practice tab → Corrections mode → PracticeTaskCard list renders. Corrections list screen renders.
- **F4 (orbs)**: Any voice session start → AISpeakingOrb + MicBloomOrb render; PracticeRecordOrb appears on practice screens.
- **F5 (pattern)**: Practice tab → Patterns mode → PatternTaskCard list + QueuedPatternCard render.
- **F6 (session)**: Home tab → any session row → session detail renders with **every** session-* primitive visible (Verdict + FullReport + PitchRibbon + ScoreRing + ConversationRhythmStrip + DeliverySignalStrip + SessionPatterns + SessionStrengthsFocus + SessionTranscript + AnalyzingBanner on a fresh session).
- **F7 (voice)**: Any voice session → VoiceSessionOverlay renders full-screen during the call.
- **Final**: Full audit §8 smoke matrix (11 flows).

Lightweight smoke after each commit is cheap compared to the cost of finding a broken import 3 commits later.

### F1.5 — Risks & gotchas

1. **Metro cache stale after moves.** If Metro runs during the renames, it may hold old paths. Recommend: kill Metro before F2, restart only when asked to smoke. Expo Fast Refresh handles added files but sometimes flakes on `git mv`.
2. **iOS/Android deep-import shortcuts via IDE auto-import.** After file moves, if the user's IDE triggers auto-import on a different file, it may re-resolve to the new path **or** the old (if cached). `tsc` is authoritative — always check `npx tsc --noEmit` after each edit batch, not just after a full commit.
3. **Barrel `./ui` imports.** Many components use `from './ui'` — after moving to a feature folder, that becomes `'../ui'`. Easy to forget. Grep as sanity check: `rg "from ['\"]\./ui['\"]" mobile/components/<feature>/` should be empty post-move.
4. **Relative-path explosion in moved files.** A file moved from `components/` to `components/session/` needs `../theme` → `../../theme`, `../lib/...` → `../../lib/...`, etc. **Inside each moved file**, count the number of `../` prefixes before and after; they should differ by exactly one level.
5. **File moved + importer moved in the same commit.** If a session-primitive (e.g., `SessionVerdict`) imports from a sibling that ALSO moves into the same folder (e.g., `CorrectionCard` moving to `correction/`), the import inside the moving-sibling file changes type. Sequence matters:
   - F3 (correction/) lands BEFORE F6 (session/) so that when F6 moves `SessionVerdict.tsx`, its `CorrectionCard` import already points to `../correction/CorrectionCard`. F3 edits `SessionVerdict` (still at root) from `./CorrectionCard` to `./correction/CorrectionCard`; F6 then rewrites again to `../correction/CorrectionCard` on move. Alternative: batch F3+F6 edits carefully. **Simpler sequence (per F1.3): F3 before F6, accept the two-step edit**.
6. **`PracticeFeedbackPanel.tsx` stays at root** but imports `./ui` — that import stays intact. No rewrites needed.
7. **Imports in `app/(tabs)/index.tsx`** (home tab) probably touch a dozen moved files. This file alone might get 10+ edits.
8. **Rollback granularity**: if F6 (session, 12 files) lands and one obscure screen breaks, `git reset --hard HEAD~1` takes the entire session/ move back. Not ideal. Mitigation: smoke the session screens **during** F6 (not just after). If tsc is clean and the primary session-detail screen renders, the 11 other session-* files are passive consumers — unlikely to break independently.
9. **Audit §9 Risk #3 explicit callout**: Phase F has the biggest reviewer churn of any phase. Not a technical risk, but the user must pre-agree that this is worth landing. F1 review gate is where that sign-off happens.

### F1.6 — Known unknowns

- Whether any file uses a **transitive re-export** (e.g., an `index.ts` elsewhere re-exports from a moved file). Quick grep: `rg "export.*from ['\"].*components/" mobile/` before F2 — handle any hits on the fly.
- Whether Expo Router's static analysis follows moved imports correctly for `app/*` screens. It should (Expo Router only statically watches `app/`, not `components/`), but flag if anything surprises.
- `PracticeFeedbackPanel` classification — if the user views it as a practice-screen component, we could move it into `components/practice/`. Current plan: stay at root (generic). Reconfirm in F1 review.

**→ REVIEW GATE: user reads this section, confirms (a) the PracticeTaskCard placement in `correction/` (pre-confirmed 2026-04-20), (b) the 4 top-level stays, (c) the per-folder commit granularity. Only then proceed to F2.**

---

## Execution (step-by-step, one commit per folder)

All sub-steps commit to `cleanup/phase-f-component-reshuffle`. After each folder commit, device-smoke the screens listed in F1.4. **Do not proceed to the next folder until smoke confirms green.**

### F2 — Move `agent/` (4 files)

1. `mkdir -p mobile/components/agent`
2. For each of `AgentAvatar.tsx`, `AgentCreationSheet.tsx`, `AgentSelector.tsx`, `VoicePicker.tsx`:
   - `git mv mobile/components/<File>.tsx mobile/components/agent/<File>.tsx`
   - Edit the file: update all `../theme`/`../lib`/etc. imports to add one level.
3. Grep external importers: `rg -n "from ['\"][\./]*components/(AgentAvatar|AgentCreationSheet|AgentSelector|VoicePicker)['\"]" mobile/`
4. Edit each importer to insert `/agent/` into the path.
5. **Verify**: `cd mobile && npx tsc --noEmit 2>&1 | grep -c "error TS"` → **1**.
6. **Device smoke** (F1.4 F2 row).
7. **Commit**: `chore(cleanup): F2 — move agent/* components into components/agent/`

### F3 — Move `correction/` (4 files)

1. `mkdir -p mobile/components/correction`
2. `git mv` for `CorrectionCard.tsx`, `CorrectionFilterChips.tsx`, `CorrectionsPreview.tsx`, `PracticeTaskCard.tsx`; edit internal imports.
3. Importer grep: `rg -n "from ['\"][\./]*components/(CorrectionCard|CorrectionFilterChips|CorrectionsPreview|PracticeTaskCard)['\"]" mobile/`
4. Edit each importer. **Note**: some live in `components/` (e.g., `SessionVerdict.tsx`, `practice/CorrectionsMode.tsx`) — `SessionVerdict` still lives at root at this point, so its path becomes `./correction/CorrectionCard`; after F6 when it moves, it becomes `../correction/CorrectionCard` (a second edit in F6). `practice/CorrectionsMode.tsx` already sits one level down and its current `../PracticeTaskCard` needs to shift to `../correction/PracticeTaskCard` in this F3 commit.
5. **Verify**: tsc → 1.
6. **Smoke** (F1.4 F3 row).
7. **Commit**: `chore(cleanup): F3 — move correction/* components into components/correction/`

### F4 — Move `orbs/` (3 files)

1. `mkdir -p mobile/components/orbs`
2. `git mv` for `AISpeakingOrb.tsx`, `MicBloomOrb.tsx`, `PracticeRecordOrb.tsx`; edit internal imports.
3. Importer grep + edits as above.
4. **Verify**: tsc → 1.
5. **Smoke** (F1.4 F4 row).
6. **Commit**: `chore(cleanup): F4 — move orb components into components/orbs/`

### F5 — Move `pattern/` (2 files)

1. `mkdir -p mobile/components/pattern`
2. `git mv` for `PatternTaskCard.tsx`, `QueuedPatternCard.tsx`; edit internal imports.
3. Importer grep: `rg -n "from ['\"][\./]*components/(PatternTaskCard|QueuedPatternCard)['\"]" mobile/` + edits.
4. **Verify**: tsc → 1.
5. **Smoke** (F1.4 F5 row).
6. **Commit**: `chore(cleanup): F5 — move pattern-card components into components/pattern/`

### F6 — Move `session/` (12 files) — **biggest commit**

1. `mkdir -p mobile/components/session`
2. `git mv` for each of: `AnalyzingBanner.tsx`, `ConversationRhythmStrip.tsx`, `DeliverySignalStrip.tsx`, `PitchRibbon.tsx`, `PitchRibbonCaption.tsx`, `ScoreRing.tsx`, `SessionFullReport.tsx`, `SessionPatterns.tsx`, `SessionRow.tsx`, `SessionStrengthsFocus.tsx`, `SessionTranscript.tsx`, `SessionVerdict.tsx`.
3. Edit internal imports in each moved file (theme, lib, types, hooks → one level deeper; `./correction/CorrectionCard` becomes `../correction/CorrectionCard`; sibling session-* imports stay `./SessionX`).
4. Importer grep: `rg -n "from ['\"][\./]*components/(AnalyzingBanner|ConversationRhythmStrip|DeliverySignalStrip|PitchRibbon|PitchRibbonCaption|ScoreRing|SessionFullReport|SessionPatterns|SessionRow|SessionStrengthsFocus|SessionTranscript|SessionVerdict)['\"]" mobile/`
5. Edit every importer to insert `/session/` into the path.
6. **Verify**: tsc → 1.
7. **Mid-commit smoke** (during execution, not just after): open session detail with a real session, confirm verdict + pitch ribbon + corrections preview + full report all render.
8. **Full smoke** (F1.4 F6 row).
9. **Commit**: `chore(cleanup): F6 — move session-* components into components/session/`

### F7 — Move `voice/` (1 file)

1. `mkdir -p mobile/components/voice`
2. `git mv mobile/components/VoiceSessionOverlay.tsx mobile/components/voice/VoiceSessionOverlay.tsx`; edit internal imports.
3. Importer grep (`rg -n "VoiceSessionOverlay" mobile/app mobile/components`) + edits.
4. **Verify**: tsc → 1.
5. **Smoke** (F1.4 F7 row).
6. **Commit**: `chore(cleanup): F7 — move VoiceSessionOverlay into components/voice/`

### F8 (may be unnecessary) — any cleanup

If the incremental commits left any file with an import still pointing at the old root (e.g., a sibling I missed during F3 that broke during F6 and was patched hastily), do a final grep sweep:

```bash
rg "from ['\"][\./]*components/(AgentAvatar|AgentCreationSheet|AgentSelector|VoicePicker|CorrectionCard|CorrectionFilterChips|CorrectionsPreview|AISpeakingOrb|MicBloomOrb|PracticeRecordOrb|PatternTaskCard|PracticeTaskCard|QueuedPatternCard|AnalyzingBanner|ConversationRhythmStrip|DeliverySignalStrip|PitchRibbon|PitchRibbonCaption|ScoreRing|SessionFullReport|SessionPatterns|SessionRow|SessionStrengthsFocus|SessionTranscript|SessionVerdict|VoiceSessionOverlay)['\"]" mobile/
```

Every hit's path must include the feature folder (`/agent/`, `/correction/`, etc.). **Zero root-level hits**. Anything the grep catches that's wrong — fix in this commit.

**Commit** (only if needed): `chore(cleanup): F8 — final import-path sweep`

---

## Post-phase verification

### Typecheck parity
- `cd mobile && npx tsc --noEmit 2>&1 | grep -c "error TS"` → **1** (baseline, untouched by moves).
- `cd server && npx tsc --noEmit 2>&1 | grep -c "error TS"` → **1** (baseline, untouched).

### Structural sanity
- `ls mobile/components/*.tsx | wc -l` → **4** (only GradientText, PracticeFeedbackPanel, StyleChips, SuccessCelebration at root).
- `ls mobile/components/` directories → exactly **`agent/`, `correction/`, `orbs/`, `pattern/`, `practice/`, `session/`, `ui/`, `voice/`** (8 total — 6 new + 2 unchanged).
- `ls mobile/components/agent/ | wc -l` → 4 files.
- `ls mobile/components/correction/ | wc -l` → 4 files.
- `ls mobile/components/orbs/ | wc -l` → 3 files.
- `ls mobile/components/pattern/ | wc -l` → 2 files.
- `ls mobile/components/session/ | wc -l` → 12 files.
- `ls mobile/components/voice/ | wc -l` → 1 file.
- `rg "from ['\"][\./]*components/<OldFile>['\"]" mobile/` for **each** moved filename → 0 root-level hits.

### git log sanity
- 6–7 commits on the phase branch (F2–F7, optional F8).
- Every commit's diff is **overwhelmingly rename + path edits**. If any commit changes logic — revert.

### LOC sanity
- Git should detect all 27 moves as renames (similarity ≥ 85%). `git log --summary cleanup/phase-f-component-reshuffle` shows `rename mobile/components/X.tsx => mobile/components/<feature>/X.tsx (100%)` for each.
- Non-rename net LOC: ~0 (only import-path edits).

### Full smoke matrix (required before merge — run on device)

Audit §8 smoke matrix, all 11 flows, must pass:

1. Sign up → onboarding voice session → land on Home tab.
2. Home tab → open a session row → session detail renders verdict + pitch ribbon + corrections preview + full report. **(Session folder — F6.)**
3. Home tab → voice session → speak → end → analysis screen renders.
4. Home tab → QueuedPatternCard + PatternTaskCard visible. Corrections list → PracticeTaskCard list renders; tapping one routes into a correction practice session. **(Correction folder — F3; Pattern folder — F5.)**
5. Practice tab → switch Corrections / Weak Spots / Fillers / Patterns modes.
6. Practice tab → start a weak-spot drill → pass/fail returns to list.
7. Practice tab → start a correction practice → record → result screen.
8. Practice tab → start a pattern exercise → complete → auto-promote next.
9. Filler Coach → session completes → results screen → session row.
10. Profile → open agent → create agent (voice flow). **(Agent folder — F2.)**
11. Any voice session → VoiceSessionOverlay + AISpeakingOrb + MicBloomOrb render. **(Voice + Orbs — F4/F7.)**

### Log sanity
- No `Cannot find module` in Metro — if seen, a stale import survived the codemod.
- Server logs unchanged.

---

## Merge procedure

Same structure as Phases B + C + D + E:
1. All sub-step commits on `cleanup/phase-f-component-reshuffle`.
2. Full smoke matrix passes on device.
3. `git checkout main && git merge --ff-only cleanup/phase-f-component-reshuffle`.
4. Delete local branch: `git branch -d cleanup/phase-f-component-reshuffle`.
5. DO NOT push to origin unless the user explicitly asks.
6. Update `.planning/phases/codebase-cleanup/README.md`: flip Phase F row to SHIPPED + date + summary. This also **completes the A–F cleanup plan** — add a note that the follow-up `session-manager.ts` SRP split (N4) is now the next flagged initiative.
7. Commit the README update to main: `chore(cleanup): mark phase F shipped — cleanup complete`.

---

## Rollback policy

- Per-folder commits. If F6 smoke fails, `git reset --hard HEAD~1` drops the whole session/ move. F2–F5 + F7 stay.
- If a single file within a folder commit breaks after merge, the fix is usually a missed importer. Grep + Edit; re-commit as a follow-up patch (don't try to amend history mid-phase).
- If Metro is the culprit (cache), kill + restart Metro before reverting. Rule out cache issues before assuming a code problem.
- If tsc is green but runtime crashes on a screen, the likely culprit is a **runtime string-based require** or a **dynamic import** — neither exists in this repo per audit §1, but worth grepping if it happens: `rg "require\(|import\(" mobile/components/`.

---

## Out-of-scope reminders

- **Do NOT** rename any file. Moves only.
- **Do NOT** add barrel `index.ts` files to the new folders.
- **Do NOT** move `PracticeFeedbackPanel`, `GradientText`, `StyleChips`, `SuccessCelebration`. They stay at root.
- **Do NOT** restructure `components/practice/` or `components/ui/`.
- **Do NOT** introduce path aliases (`@components/...`) during this phase.
- **Do NOT** change any logic. If a file's diff shows a single line that isn't an import-path edit, revert.
- **Do NOT** split `session-manager.ts` (N4) — that's the post-F follow-up initiative.
- **Do NOT** push to origin without asking the user.
- **Do NOT** co-author commit messages ("Co-Authored-By" is banned per global CLAUDE.md).
- **Do NOT** bypass the F1 review gate. User needs to confirm PracticeTaskCard placement + top-level stays + commit granularity.
- **Do NOT** attempt F in a single mega-commit. Per-folder commits or bust.

---

## What to hand back to the user when done

```
Phase F complete — codebase cleanup A–F done.
- Branch: cleanup/phase-f-component-reshuffle (merged to main, deleted)
- Commits: F2, F3, F4, F5, F6, F7 (+ optional F8) + README update
- Files touched: 27 moved + ~80 importers updated (app screens + intra-components)
- Net LOC: ~0 (pure moves + path rewrites)
- Typecheck: mobile 1 / server 1 (both baseline, unchanged)
- Smoke matrix: PASSED on device (all 11 flows covered across 6 feature folders)
- Cleanup A–F complete. Next flagged initiative: session-manager.ts SRP split (audit N4), deferred.
```
