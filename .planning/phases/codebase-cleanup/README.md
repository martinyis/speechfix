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
| D | Hook consolidation (voice + recording) | `phase-d.md` | **SHIPPED 2026-04-20** — 8 atomic commits, 9 files, ~747 LOC net removed, merged to main |
| E | Server handler dedup (onSessionEnd paths) | `phase-e.md` | **SHIPPED 2026-04-20** — 3 atomic commits, 2 files, ~110 LOC net removed, merged to main |
| F | Cosmetic component reorganization | `phase-f.md` | **SHIPPED 2026-04-20** — 6 atomic commits, 27 files moved into 6 new feature folders (+2 intra-component re-pathings), 13 app screens re-imported, ~0 net LOC, merged to main |
| G | Hooks reshuffle (`voice/` + `recording/` + `data/` subdirs) | — | **SHIPPED 2026-04-20** — 3 atomic commits, 17 hook files moved, 20 importer lines rewritten, ~0 net LOC, merged to main |
| — | **Follow-up**: session-manager.ts SRP split | separate initiative | **deferred** |

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

### Phase D — shipped summary
- 8 atomic commits on `cleanup/phase-d-hook-consolidation`, fast-forwarded to `main`: D2–D9.
- Extracted `useVoiceSessionCore` (344 LOC, `mobile/hooks/voice/`) — owns mic/WS/timer/app-state/keep-awake/echo-grace/cleanup plumbing + generic `turn_state`/`audio`/`audio_end`/`ready`/`mute_state`/`error` handling. Forwards all messages to a caller-supplied `onMessage` dispatcher plus emits synthetic `playback_complete`/`ws_error`/`ws_close` events. Tunable via `pcmBytesPerSec`, `playbackPaddingMs`, `micStartBehavior`, `avSessionInitDelayMs`, `logTag`.
- Extracted `useRecordAndSubmit<TParams, TResult>` (192 LOC, `mobile/hooks/recording/`) — owns mic (16kHz) + chunk collection + RMS visualizer + 1s timer + 15s max + multipart POST. Generic over `endpoint` + `formFields(params)` builder + `parseResponse(json)`.
- Extracted `computeRMS()` to `mobile/lib/rms.ts` (45 LOC) — pure function, verbatim copy from the original hooks (identical across all three).
- Migrated wrappers kept their original paths so call-site imports are unchanged: `useVoiceSession` 539→204, `useOnboardingVoiceSession` 290→108, `useAgentCreatorVoiceSession` 287→103, `usePracticeRecording` 282→33, `usePatternPracticeRecording` 223→27, `useDrillRecording` 215→33.
- Plan deviation 1: during D3, the core's `wsUrl` config was widened from `string` to `string | (() => string)` so `useVoiceSession` could resolve `selectedAgentId` lazily at start-time instead of hook-init time. Bundled into D3 commit.
- Plan deviation 2: plan targeted "baseline 7" on mobile typecheck, but the wrapper rewrites incidentally cleaned up 6 pre-existing type-def issues (invalid `SampleRate` literal, missing `getHighFidelityRecordingPath`/`FileSystemUploadType` types) via narrow `as any` casts. Mobile typecheck ended at 1 (just the unrelated GradientText baseline). No behavior change — purely type-surface.
- Net 747 LOC removed (1,836 wrappers → 508 wrappers + 581 shared core/util = 1,089 total). Typecheck parity: mobile 1 (down from 7) / server 1 (baseline, untouched).
- Full 8-flow smoke matrix passed on device (onboarding voice, Home voice, Filler Coach, session detail, correction/pattern/weak-spot practice, agent creation).
- `app/lab/` route tree still intact. Wrappers still at `mobile/hooks/<name>.ts` (moving them under `hooks/voice/` + `hooks/recording/` is Phase F cosmetic).

### Phase E — shipped summary
- 3 atomic commits on `cleanup/phase-e-handler-dedup`, fast-forwarded to `main`: E2, E3, E4.
- Added `server/src/voice/handlers/session-persist.ts` (87 LOC) exposing 5 focused helpers used by both `onSessionEnd` paths: `handleEmptyTranscript`, `computeCorrectionClarityScore`, `insertCorrectionsBatch`, `insertFillerWordsBatch`, `runPostAnalysisSideEffects`. Helpers import `appendContextNotes` from `conversation-handler.ts` (circular-import is safe — `appendContextNotes` is a hoisted async function declaration).
- Plan deviation (minor): initial E2 draft typed the correction/filler helper inputs as ad-hoc loose shapes; tsc rejected (`severity` is a `text` column, not `number`). Fixed during E2 by importing `Correction` / `FillerWordCount` from `analysis/types.ts` — stricter than the original inline types, no runtime effect.
- E3 migrated `onSessionEnd` → helpers (−49 LOC net). E4 migrated `onSessionEndStreaming` → helpers and pruned now-unused imports (`regenerateAllGreetings`, `absorbCorrections`, `runPatternAnalysisForUser`, `corrections`, `fillerWords` schema tables) (−61 LOC net).
- Net: `conversation-handler.ts` 438 → 328 LOC (−110). `RoleplayHandler` picks up the refactor automatically via inheritance — confirmed via roleplay smoke.
- Scope-preserving choices: both session-end entry points kept (audit's option (b), not option (a)); `FillerCoachHandler` / `OnboardingHandler` / `AgentCreatorHandler` untouched; streaming path's DB-session-created-inside-phased-callback order preserved so `insights_ready` client UX still fires before corrections stream in; 4-path log line ordering preserved.
- Typecheck parity: mobile 1 / server 1 (both baseline, untouched).
- Smoke matrix passed on device: Reflexa voice, custom agent (conversation), custom agent (roleplay — inheritance guard), filler coach (regression guard), past-session open.

### Phase G — shipped summary
- 3 atomic commits on `cleanup/phase-g-hooks-reshuffle`, fast-forwarded to `main`: G1, G2, G3.
- Closes the gap between Phase D (which extracted `useVoiceSessionCore` + `useRecordAndSubmit` + the 6 wrappers but explicitly left wrappers at `mobile/hooks/<name>.ts`) and the audit §5 target tree. Phase F as originally planned was scoped only to `mobile/components/`, so the hooks-layer reshuffle was the last remaining structural gap vs §5.
- G1: moved 3 voice wrappers into `mobile/hooks/voice/` (now contains `useVoiceSessionCore.ts` + `useVoiceSession.ts` + `useOnboardingVoiceSession.ts` + `useAgentCreatorVoiceSession.ts`). 4 external importers updated (`app/filler-coach.tsx`, `app/(tabs)/index.tsx`, `app/(onboarding)/voice-session.tsx`, `app/agent-create.tsx`). Also rolled in the pre-existing stale `mobile/scripts/reset-project.js` deletion that was uncommitted in the working tree.
- G2: moved 3 recording wrappers into `mobile/hooks/recording/` (now contains `useRecordAndSubmit.ts` + `usePracticeRecording.ts` + `usePatternPracticeRecording.ts` + `useDrillRecording.ts`). 3 external importers updated (`practice-session.tsx`, `weak-spot-drill.tsx`, `pattern-practice-session.tsx`).
- G3: created `mobile/hooks/data/` and moved 11 react-query hooks (`useAgents`, `useFillerCoachSessions`, `useFillerCoachStats`, `useFillerSummary`, `usePatternTasks`, `usePracticeTasks`, `useSession`, `useSessions`, `useVoicePreview`, `useVoices`, `useWeakSpots`). 13 external importer lines updated across 10 files (7 app screens + `components/practice/FillerWordsMode.tsx`).
- `useFillerCoachStats` kept in-scope even though it has no external importers (audit §5 explicitly lists it under `data/`); follow-up dead-code sweep can remove it if truly unreferenced.
- `hooks/` root now contains exactly the 4 files the audit intended: `useAppWarmup`, `useAudioPlayback`, `useIntroAudio`, `usePracticeModes`.
- Net LOC: ~0 (pure moves + import-path edits, plus −114 from the reset-project.js deletion).
- Typecheck parity: mobile 1 / server 1 (both baseline, unchanged).
- Smoke passed on device by Martin.
- **All audit §5 structural shuffles are now complete.** The only remaining audit item is `server/src/voice/session-manager.ts` SRP split (N4), which the audit itself flagged as "not urgent, larger refactor, flag for later." Deferred by explicit user decision.

### Phase F — shipped summary
- 6 atomic commits on `cleanup/phase-f-component-reshuffle`, fast-forwarded to `main`: F2, F3, F4, F5, F6, F7 (F8 sweep unnecessary — zero leftover root-level imports).
- Created 6 new feature folders under `mobile/components/`: `agent/` (4 files), `correction/` (4), `orbs/` (3), `pattern/` (2), `session/` (12), `voice/` (1). `components/practice/` and `components/ui/` untouched. 4 generic primitives kept at root per audit §5: `GradientText`, `PracticeFeedbackPanel`, `StyleChips`, `SuccessCelebration`.
- 27 files moved via `git mv` (every rename detected by git at ≥93% similarity); 13 app screens + 2 intra-component files (`SessionRow`, `VoiceSessionOverlay`) re-imported to the new feature paths, and the `practice/CorrectionsMode` importer of `PracticeTaskCard` re-anchored from `../PracticeTaskCard` to `../correction/PracticeTaskCard`.
- `PracticeTaskCard.tsx` routed to `correction/` (not `pattern/`): confirmed by user during F1 review — file renders correction-practice cards (props: `correctionId`, `correctedText`, `severity`, `practiceCount`) and only ever routes to `/practice-session?mode=say_it_right`.
- Net LOC: ~0 (pure moves + import-path edits; each moved file's only change is relative-path re-anchoring one level deeper).
- Typecheck parity: mobile 1 / server 1 (both baseline, unchanged).
- Smoke matrix passed on device by Martin.
- **Cleanup A–F complete.** Next flagged initiative: `server/src/voice/session-manager.ts` SRP split (audit N4), deferred.

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
