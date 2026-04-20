# Phase C — Rename + Move (surgical)

**Source audit**: `.planning/audits/codebase-audit-2026-04-20.md` (§3.3 N6+N7, §4 "Mobile — rename / move", §6 Phase C, §7 sequence)
**Depends on**: Phases A + B merged (both are — see `README.md`).
**Branch to create**: `cleanup/phase-c-rename-move`
**Expected impact**: 7 files touched, zero LOC net removed in source (mostly renames + path adjustments); 2 barrel `index.ts` files + 1 now-empty folder deleted. Zero behavior change.
**Expected effort**: 20–40 minutes.

---

## One-paragraph briefing (read this first if you have no prior context)

Two naming/location artifacts from the session-results redesign and lab-promotion process need cleaning up. First: `components/session-variants/VariantC.tsx` is the only surviving session-list row (Phase A deleted the other variants), but it still exports `SessionRowVariantC` and both call sites (`all-sessions.tsx`, `(tabs)/index.tsx`) have to alias it `as SessionRow`. We rename the export, delete the alias at import sites, move the file to top-level `components/SessionRow.tsx`, and remove the now-empty `session-variants/` directory (incl. barrel). Second: `components/lab/FrequencyStrip.tsx` is live on the Practice tab — it was promoted out of lab but never physically moved. We move it into `components/practice/`, update the one importer, and delete the now-empty `components/lab/` barrel + directory. The `/lab` route + `app/lab/` screens stay (Profile still has the dev-only entry point with an empty ENTRIES array, kept as ongoing infra per memory).

---

## Preconditions (verify before starting)

Run these checks. If any fails, STOP and re-plan.

1. `git status` → clean working tree.
2. `git rev-parse --abbrev-ref HEAD` → should be `main`.
3. `git log --oneline -6 | grep "mark phase B shipped"` → should match (confirms Phase B is merged).
4. **Current-state verification**:
   - `ls mobile/components/session-variants/` → must show `VariantC.tsx` + `index.ts` only.
   - `ls mobile/components/lab/` → must show `FrequencyStrip.tsx` + `index.ts` only (Phase A already deleted FrequencySwitcher + mockModes).
   - `ls mobile/components/SessionRow.tsx 2>/dev/null` → **must not exist** (destination must be free).
   - `ls mobile/components/practice/FrequencyStrip.tsx 2>/dev/null` → **must not exist** (destination must be free).
5. **Importer inventory**:
   - `rg "SessionRowVariantC|session-variants" mobile/` → should show exactly:
     - `components/session-variants/VariantC.tsx` (export)
     - `components/session-variants/index.ts` (barrel)
     - `app/all-sessions.tsx` (aliased import)
     - `app/(tabs)/index.tsx` (aliased import)
     - No other hits.
   - `rg "components/lab\b|from ['\"].*/lab['\"]|from ['\"].*/lab/" mobile/` → should show exactly:
     - `components/lab/FrequencyStrip.tsx` (self)
     - `components/lab/index.ts` (barrel)
     - `app/(tabs)/practice.tsx` (the one importer)
     - No other hits. (The `app/lab/` screen tree uses its own paths and does NOT import from `components/lab/`.)
6. **Typecheck baseline**:
   - `cd mobile && npx tsc --noEmit 2>&1 | grep -c "error TS"` → **7** (baseline, pre-existing, unrelated).
   - `cd server && npx tsc --noEmit 2>&1 | grep -c "error TS"` → **1** (baseline, pre-existing).

> If any of #4–#5 returns unexpected hits, something moved since the audit and B1-style re-verification is required. STOP and re-scope.

---

## Scope

Rename one symbol, move two files, delete two barrels and two now-empty folders. No behavior change.

**In scope:**
1. Rename `SessionRowVariantC` → `SessionRow` inside `VariantC.tsx`.
2. Remove the `as SessionRow` alias at both importers and point them at the new location.
3. `git mv mobile/components/session-variants/VariantC.tsx mobile/components/SessionRow.tsx`.
4. Fix internal relative imports in the moved file (4 paths change depth — see C2 detail).
5. Delete `mobile/components/session-variants/index.ts` and the now-empty folder.
6. `git mv mobile/components/lab/FrequencyStrip.tsx mobile/components/practice/FrequencyStrip.tsx`.
7. Update `app/(tabs)/practice.tsx` import path (lab → practice). Its relative depth is identical, but the namespace changes.
8. Delete `mobile/components/lab/index.ts` and the now-empty folder.

**Out of scope** (DO NOT touch in this phase):
- `app/lab/` screen tree (the `/lab` route). Memory says: "Lab infrastructure is ongoing infra; keep the layout + index.tsx + route". Phase F may revisit.
- The `components/SessionRow.tsx` final home. Audit §5 says it eventually lands in `components/session/`, but that's Phase F cosmetic reorg. Top-level is explicitly "for now" per audit §C.2.
- The `components/practice/index.ts` barrel — audit does NOT require adding `FrequencyStrip` to it (the practice folder has no barrel file today; leave it that way).
- `VariantC.tsx` internals (the `getScoreColor` helper, the `<SessionRow>` JSX, styling). Rename export name only.
- `FrequencyStrip.tsx` internals. Only its location changes.
- Any unrelated refactoring, typo fixes, or comment rewrites.

---

## Execution (step-by-step, one commit each)

Each sub-step is its own commit for clean rollback.

### C1 — Rename `SessionRowVariantC` → `SessionRow` (export + importers, file stays in place)

Do the rename **before** the move. Keeping the move as a pure `git mv` (no content change) gives git the cleanest rename-detection signal.

**File 1**: `mobile/components/session-variants/VariantC.tsx`

Find the single exported function:
```ts
export function SessionRowVariantC({ item }: { item: SessionListItem }) {
```
Rename to:
```ts
export function SessionRow({ item }: { item: SessionListItem }) {
```

No other occurrences inside this file — verify with `rg "SessionRowVariantC" mobile/components/session-variants/VariantC.tsx` after edit → 0 hits.

**File 2**: `mobile/components/session-variants/index.ts`

Current:
```ts
export { SessionRowVariantC } from './VariantC';
```
Change to:
```ts
export { SessionRow } from './VariantC';
```

**File 3**: `mobile/app/all-sessions.tsx` (around line 12)

Current:
```ts
import { SessionRowVariantC as SessionRow } from '../components/session-variants/VariantC';
```
Change to:
```ts
import { SessionRow } from '../components/session-variants/VariantC';
```
(Path stays — C2 moves the file.)

**File 4**: `mobile/app/(tabs)/index.tsx` (around line 25)

Current:
```ts
import { SessionRowVariantC as SessionRow } from '../../components/session-variants/VariantC';
```
Change to:
```ts
import { SessionRow } from '../../components/session-variants/VariantC';
```

**Verify**:
- `rg "SessionRowVariantC" mobile/` → **must be 0 hits**.
- `cd mobile && npx tsc --noEmit 2>&1 | grep -c "error TS"` → **7** (baseline).

**Commit**: `chore(cleanup): C1 — rename SessionRowVariantC to SessionRow`

### C2 — Move `VariantC.tsx` → `components/SessionRow.tsx` + fix relative imports

Use `git mv` so git tracks it as a rename:

```bash
git mv mobile/components/session-variants/VariantC.tsx mobile/components/SessionRow.tsx
```

Then **fix the internal relative imports** in the moved file — depth changed from `mobile/components/session-variants/…` (two levels under mobile/) to `mobile/components/…` (one level). Open `mobile/components/SessionRow.tsx` and change:

| Before (two levels deep) | After (one level deep) |
|---|---|
| `from '../../theme'` | `from '../theme'` |
| `from '../../lib/formatters'` | `from '../lib/formatters'` |
| `from '../AgentAvatar'` | `from './AgentAvatar'` |
| `from '../../types/session'` | `from '../types/session'` |

(There are four import lines at the top of the file matching these patterns. No other relative imports in this file.)

Then update **both importers** to the new path:

`mobile/app/all-sessions.tsx`:
```ts
import { SessionRow } from '../components/session-variants/VariantC';
```
→
```ts
import { SessionRow } from '../components/SessionRow';
```

`mobile/app/(tabs)/index.tsx`:
```ts
import { SessionRow } from '../../components/session-variants/VariantC';
```
→
```ts
import { SessionRow } from '../../components/SessionRow';
```

Then **delete the now-unused barrel + folder**:

```bash
rm mobile/components/session-variants/index.ts
rmdir mobile/components/session-variants
```

(The `rmdir` is deliberate — it only succeeds if the directory is empty, which verifies no other files linger.)

**Verify**:
- `rg "session-variants" mobile/` → **must be 0 hits**.
- `ls mobile/components/session-variants 2>/dev/null` → must be empty / not exist.
- `ls mobile/components/SessionRow.tsx` → exists.
- `cd mobile && npx tsc --noEmit 2>&1 | grep -c "error TS"` → **7** (baseline).

**Commit**: `chore(cleanup): C2 — move SessionRow to components/ top-level`

> Note: `git mv` + content edit in the same commit can make git show the file as "rewritten" rather than "renamed" if the content diff crosses git's similarity threshold. That's cosmetic — history is still intact via `git log --follow`. If you want the cleanest log, you *can* split into two commits (pure `git mv` first, then path-fix edits) but the plan's budget is 1 commit per sub-step; either is acceptable.

### C3 — Move `FrequencyStrip.tsx` → `components/practice/`

```bash
git mv mobile/components/lab/FrequencyStrip.tsx mobile/components/practice/FrequencyStrip.tsx
```

**No internal import changes needed.** The file imports `../../theme` — from `mobile/components/lab/` that resolved to `mobile/theme/`, and from `mobile/components/practice/` it still resolves to `mobile/theme/`. Same depth. Same resolution. Verify anyway: `rg "^import" mobile/components/practice/FrequencyStrip.tsx` → all paths still valid.

Update the **one** importer, `mobile/app/(tabs)/practice.tsx` (around lines 17–18):

Before:
```ts
import { FrequencyStrip } from '../../components/lab';
import type { StripMode } from '../../components/lab';
```
After:
```ts
import { FrequencyStrip } from '../../components/practice/FrequencyStrip';
import type { StripMode } from '../../components/practice/FrequencyStrip';
```

> Why not route through a `components/practice/index.ts` barrel? The `practice/` folder has no barrel today (verify with `ls mobile/components/practice/index.ts 2>/dev/null`). Adding one is out of scope — importing the file directly matches the style of every other file in that folder (e.g., `PracticePager`, `WeakSpotCard` are imported by path, not barrel).

Then **delete the now-unused barrel + folder**:

```bash
rm mobile/components/lab/index.ts
rmdir mobile/components/lab
```

(Again, `rmdir` fails if not empty — verification that nothing else is hiding there.)

**Verify**:
- `rg "components/lab\b|from ['\"].*/components/lab['\"]|from ['\"].*/components/lab/" mobile/` → **must be 0 hits**. (The `app/lab/` screen tree is unaffected and should not match this pattern — its paths are `app/lab/…` not `components/lab/…`.)
- `ls mobile/components/lab 2>/dev/null` → must be empty / not exist.
- `ls mobile/components/practice/FrequencyStrip.tsx` → exists.
- `cd mobile && npx tsc --noEmit 2>&1 | grep -c "error TS"` → **7** (baseline).

**Commit**: `chore(cleanup): C3 — move FrequencyStrip into components/practice`

---

## Post-phase verification

### Typecheck parity
- `cd mobile && npx tsc --noEmit 2>&1 | grep -c "error TS"` → **7** (baseline).
- `cd server && npx tsc --noEmit 2>&1 | grep -c "error TS"` → **1** (baseline — server untouched by Phase C).

### Final grep sweep (must all return 0 hits)
```bash
rg "SessionRowVariantC" mobile/
rg "session-variants" mobile/
rg "components/lab\b|from ['\"].*/components/lab['\"]|from ['\"].*/components/lab/" mobile/
```

### Structural sanity
- `ls mobile/components/session-variants 2>/dev/null` → nothing (directory gone).
- `ls mobile/components/lab 2>/dev/null` → nothing (directory gone).
- `ls mobile/components/SessionRow.tsx` → exists.
- `ls mobile/components/practice/FrequencyStrip.tsx` → exists.

### Manual smoke (required before merge — run on device)

Phase C is rename-only; runtime behavior MUST be identical. Verify the three affected UIs render.

1. **Home tab**: session list renders. Each row shows agent avatar, title, time, duration, correction dots + score pill (when clarityScore present).
2. **All Sessions screen**: navigate from Home → "See all" (or Profile → Recent Sessions). List renders with the same row component as Home.
3. **Practice tab**: the `FrequencyStrip` (pill-bar mode selector at the top of the practice screen) still renders and is tappable; tapping a mode animates the selected pill and switches the practice content.
4. Open Metro logs while navigating: no import-resolution errors, no red-box.

**No server log checks needed** — Phase C is mobile-only.

If anything breaks → `git reset --hard HEAD~N` to before the failing sub-step. Most likely culprit: a relative-import depth change in C2 was missed and typecheck should have caught it; if Metro is showing runtime error instead, check for hardcoded `require()` strings or dynamic `import()` calls (shouldn't exist in this codebase, but worth a `rg "require\(['\"].*(session-variants|components/lab)" mobile/` sanity grep).

---

## Merge procedure

Same as Phase B:
1. All sub-step commits on `cleanup/phase-c-rename-move`.
2. Smoke test passes on device.
3. `git checkout main && git merge --ff-only cleanup/phase-c-rename-move`.
4. Delete local branch: `git branch -d cleanup/phase-c-rename-move`.
5. DO NOT push to origin unless the user explicitly asks.
6. Update `README.md` in this dir: flip Phase C row to SHIPPED + date + summary; mark Phase D as "next".
7. Commit the README update directly to main: `chore(cleanup): mark phase C shipped in master plan`.

---

## Rollback policy

- Each sub-step is its own commit. If C2 or C3 breaks smoke or typecheck, `git reset --hard HEAD~1` walks back to the prior clean state.
- C1 is pure symbol rename + type-checked at commit time; effectively safe.
- If after C2 the Metro bundler can't find `SessionRow` from the new path, investigate before rolling back — it usually means one of the two importer updates got missed. Grep `rg "session-variants" mobile/` to find the straggler.
- If `rmdir` fails ("directory not empty"), something unknown lives in `session-variants/` or `lab/` that the audit missed. STOP. List the directory contents and decide whether to extend scope or re-scope.

---

## Out-of-scope reminders

- **Do NOT touch** `app/lab/` (the `/lab` route). It's kept as ongoing dev-only infra per memory.
- **Do NOT** add a `components/practice/index.ts` barrel. The practice folder has never had one; adding it now would spread scope.
- **Do NOT** move `SessionRow.tsx` into `components/session/` yet — that's Phase F's cosmetic reorg.
- **Do NOT** refactor the `SessionRow` component body (local `getScoreColor`, inline styles, etc.). The audit §3.3 N7 notes this is a pure rename + move.
- **Do NOT** push to origin without asking the user.
- **Do NOT** co-author commit messages ("Co-Authored-By" lines are banned per user's global CLAUDE.md).
- **Do NOT** start Phase D after finishing C. Wait for the user to kick off the next phase with a fresh agent + `phase-d.md`. Phase D requires a design-review checkpoint (`D1 → review → D2`) before any hook migration coding starts.

---

## What to hand back to the user when done

A short report:
```
Phase C complete.
- Branch: cleanup/phase-c-rename-move (merged to main, deleted)
- Commits: C1, C2, C3 + README update (4 total)
- Files touched: 7 (VariantC.tsx renamed → components/SessionRow.tsx,
  FrequencyStrip.tsx moved → components/practice/, 2 importers updated,
  2 barrel index.ts deleted, 2 empty dirs removed)
- Net LOC: ~0 (renames/moves; import-path shims net out)
- Typecheck: mobile 7 / server 1 (both baseline)
- Smoke: PASSED on device (user ran it — Home list, All Sessions, Practice tab all render)
- Ready for Phase D.
```
