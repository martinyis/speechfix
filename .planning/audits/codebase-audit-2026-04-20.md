# Reflexa Codebase Audit — 2026-04-20

> Staff-engineer-level audit of `mobile/` (Expo/React Native) and `server/` (Fastify/Node/Postgres/TS).
> Objective: identify dead, deprecated, duplicated, and misplaced code; propose a concrete
> cleanup and restructuring plan with minimal breakage risk.

---

## 1. Executive summary

**Overall shape**: The codebase is in solid "post-pivot" condition — core wiring (voice WS, analysis pipeline, scoring, weak spots, pattern practice, filler coach) works and is reasonably layered. What hurts it is **archaeological debris** from several feature pivots:

- The recording-first architecture (`POST /sessions` + Deepgram pre-recorded + `stripSilence`) was replaced by the WebSocket voice session + phased streaming analysis, but the old route and its helpers still ship.
- A "session results redesign" pivoted through three card-heavy iterations (`SessionSummaryCard`, `SessionInsightCard`, `SessionInsightsCard`, `SummaryBar`, `StickySessionBar`) before landing on the current flat `SessionVerdict` + `SessionFullReport` shape — all of the superseded components still ship.
- A "Patterns" redesign experiment (`mobile/components/patterns/*` — `FeaturedPatternCard`, `HeatMapTimeline`, `InsightCard`, `CategoryCard`, `mockData`) never went live. Zero imports outside its own barrel.
- A "button showcase" experiment (`mobile/components/button-showcase/` — 12 Set*.tsx files) was left behind after a design decision. Zero imports.
- The lab promoted `FrequencyStrip` into production on the Practice tab, but `components/lab/` also still contains `FrequencySwitcher` + `mockModes` which are unreferenced. The lab router (`app/lab/`) is kept as infra with an empty `ENTRIES` array.
- Three near-identical voice session hooks (`useVoiceSession` / `useOnboardingVoiceSession` / `useAgentCreatorVoiceSession`) at 539 + 290 + 287 lines duplicate ~70% of their skeleton.
- Two near-identical `onSessionEnd` paths in `ConversationHandler` (the non-streaming path runs `runAnalysis` only as a fallback for the streaming path that always wins in practice).
- `runAnalysisStreaming` (analysis/runner.ts) is exported but never called — a middle child between `runAnalysis` and `runAnalysisPhased`.
- `GET /patterns` (`server/src/routes/patterns.ts`) is dead — mobile uses `/practice/pattern-tasks` now.

**None of the above blocks shipping**, but every one is a paper cut that makes the repo harder to reason about and slows down onboarding/refactor. Nothing critical is broken; everything to remove or consolidate has zero runtime references or is a strict superset of a simpler path.

**Risk profile**: Dead-code removal here is unusually safe because:
1. No generated code, no dynamic imports, no reflection-based registration — Expo Router paths and Fastify plugins are all static.
2. The app has strict TS and every removal surface is behind imports; typecheck immediately catches orphans.
3. Recent git activity confirms most of the "suspect" files haven't been modified in the last commit wave (they're not active work).

**Expected outcome** (net, after the plan runs):
- Mobile: ~3,500 LOC deleted, ~4 archived directories removed, ~700 LOC consolidated, clearer folder structure.
- Server: ~700 LOC deleted, 1 dead route + 1 dead export + 1 dead service function + 1 dead handler path consolidated.
- Zero behavior change if the phase order is followed.

---

## 2. Current state map (annotated)

```
speechfix/
├── .planning/               # PRESERVE — design docs, phase plans, this audit
│   ├── audits/              # (new — this file lives here)
│   ├── design/              # tokens, UX principles, component catalog
│   └── phases/              # multi-phase redesign plans
├── brand/                   # PRESERVE — brand assets
├── docs/                    # PRESERVE — product research + future feature notes
├── ios/                     # ORPHAN — "Target Support Files" from old build, NOT gitignored at root
├── mobile/                  # React Native / Expo app
│   ├── android/ ios/        # native projects (git-ignored per root .gitignore rule 47–49)
│   ├── app/                 # Expo Router screens
│   │   ├── (auth)/          # login / signup
│   │   ├── (onboarding)/    # index + voice-session
│   │   ├── (tabs)/          # Home / Practice / Profile
│   │   ├── lab/             # dev-only prototypes (currently EMPTY entries)
│   │   ├── agent-create.tsx agent-detail.tsx
│   │   ├── all-sessions.tsx corrections-list.tsx
│   │   ├── filler-coach.tsx filler-coach-results.tsx filler-coach-sessions.tsx
│   │   ├── pattern-practice-session.tsx patterns-list.tsx
│   │   ├── practice-session.tsx session-detail.tsx
│   │   └── weak-spot-drill.tsx
│   ├── assets/              # fonts (MonaSans 5 weights), sounds (intro.wav, success.wav), images
│   ├── components/          # ⚠ MIXED — live + dead + superseded
│   │   ├── button-showcase/ # DEAD — 12 Set*.tsx experiments, zero imports
│   │   ├── lab/             # MIXED — FrequencyStrip live; FrequencySwitcher + mockModes dead
│   │   ├── patterns/        # DEAD — entire subtree, zero external imports
│   │   ├── practice/        # live (WeakSpotsMode, FillerWordsMode, PatternsMode, etc.)
│   │   ├── session-variants/# RENAME needed — only VariantC is used, naming is a pivot artifact
│   │   ├── ui/              # live primitives (GlassCard, ScreenHeader, etc.)
│   │   └── <30 top-level>   # MIX of live + 5 superseded session-results cards
│   ├── hooks/               # 21 hooks — 3 voice-session siblings share 70% skeleton
│   ├── lib/                 # api, config, formatters, correctionNature, wordDiff, etc.
│   ├── stores/              # Zustand: agent, auth, onboarding, session
│   ├── theme/               # "Vibrant Glass" tokens (index.ts)
│   └── types/               # practice, session
├── server/
│   ├── audio/               # persisted session audio (Ogg Opus); per-user subdirs
│   ├── drizzle/             # migrations 0001–0023 + meta
│   ├── scripts/             # extract-intro-timestamps, heal-pattern, seed-test-sessions
│   └── src/
│       ├── analysis/        # analyzers/ + runner + stream-parser + utils + types
│       ├── db/              # schema (11 tables) + client
│       ├── jobs/            # patterns.ts (cross-session pattern analysis)
│       ├── plugins/         # fastify auth plugin
│       ├── routes/          # 13 route files — /patterns is DEAD, /sessions POST is DEAD
│       ├── services/        # 17 services (all live, some internally duplicative)
│       ├── utils/           # audio.ts (PCM→WAV)
│       ├── voice/           # deepgram, tts, session-manager (1441 LOC), prompts/, handlers/
│       └── index.ts         # Fastify bootstrap, registers all routes
└── tasks/                   # PRESERVE (gitignored, local-only)
    ├── lessons.md
    ├── logo-brief.md
    └── todo.md
```

---

## 3. Findings by severity

### 3.1 Critical (behavior or schema risks — none are blocking but should be understood first)

**None.** The audit surfaced no runtime bugs or security issues. Everything below is hygiene.

### 3.2 Should-fix (clearly dead or misleading code, trivial risk to remove)

| # | Location | Evidence | Risk |
|---|----------|----------|------|
| S1 | `mobile/components/button-showcase/` (entire tree, 12 files, ~2,200 LOC) | Grep for `Set11GlassIconPill`, `Set1NeonGlow`, etc. across `mobile/app` → **0 matches**. Barrel `index.ts` unreferenced. | None — pure design scratchpad. |
| S2 | `mobile/components/patterns/` (entire tree: CategoryCard, FeaturedPatternCard, HeatMapTimeline, InsightCard, MiniScoreRing, mockData) | Grep `from ['\"].*components/patterns['\"]` → **0 matches** anywhere. Barrel exports 5 components, none are imported. | None — stillborn pattern redesign. |
| S3 | `mobile/components/SessionSummaryCard.tsx`, `SessionInsightCard.tsx`, `SessionInsightsCard.tsx`, `SummaryBar.tsx`, `StickySessionBar.tsx` | Each is defined and exported, but grep shows **only the definition line** — no imports anywhere. Superseded by `SessionVerdict` + `SessionFullReport` per the Session Results Redesign phase 1. | None — strict dead exports. |
| S4 | `mobile/components/FillerWordsSummary.tsx` | Only self-reference. Superseded by `FillerWordsMode` in the practice pager. | None. |
| S5 | `mobile/components/SessionRow.tsx` | Shadowed by `session-variants/VariantC.tsx`'s `SessionRowVariantC` which is imported aliased as `SessionRow` in `(tabs)/index.tsx` and `all-sessions.tsx`. The old `SessionRow.tsx` has no imports. `filler-coach-sessions.tsx` defines its own local `SessionRow` inline. | None. |
| S6 | `mobile/components/lab/FrequencySwitcher.tsx` + `mockModes.ts` (+ associated barrel exports) | `FrequencyStrip` is the only thing imported from `components/lab`; `FrequencySwitcher` and `MOCK_MODES` have no consumers. | None. |
| S7 | `server/src/routes/patterns.ts` (and its registration in `index.ts`) | Mobile only uses `/practice/pattern-tasks` (see `usePatternTasks.ts`). No grep hit for `/patterns` as a fetch URL. | Near-none — double-check by removing from register and running typecheck. |
| S8 | `server/src/routes/sessions.ts` — `POST /sessions` handler + `computeClarityScore()` + `transcribe()` + `stripSilence()` in `server/src/services/transcription.ts` | Mobile never POSTs to `/sessions` (only `POST /sessions/:id/raw-audio` on `session-audio.ts`). Both `transcribe()` and `stripSilence()` are only called by this dead handler. `transcribeRawPCM` (the real path) is in the same file and stays. | Low — verify with grep for any external tool or script first (none found). |
| S9 | `server/src/analysis/runner.ts` — `runAnalysisStreaming` export (+ re-export in `analysis/index.ts`) | Imported by `conversation-handler.ts` but **not called** (line 11 imports it; search for `runAnalysisStreaming(` yields only the definition). Middle child between `runAnalysis` and `runAnalysisPhased`. | None. |
| S10 | `ios/` at project root (`ios/Pods/Target Support Files`) | Orphan from an older CocoaPods build. Root `.gitignore` only covers `ios/` at mobile scope, so this folder is committed. | Very low — confirm no xcworkspace reference to this path. |
| S11 | `mobile/dist/` | Empty/stale Expo web bundle, already gitignored but tracked locally. | None. |
| S12 | `mobile/.design-extract/` (9 frame JPGs) | Local design reference, committed. Not imported anywhere. Keep or move to `.planning/design/` based on whether they're reference material. | None. |
| S13 | `server/src/voice/handlers/types.ts` — `score?: number \| null` field (marked `@deprecated`) + the legacy alias in `session-manager.ts` lines 931, 970-971 | Already marked as "one release" legacy alias. Mobile client consumes `deliveryScore` / `languageScore` directly now. Verify by grepping mobile for `\.score\b` on session payloads. | Low — must verify mobile reads the new fields before removing. |

### 3.3 Nice-to-have (structural / ergonomic — bigger payoff, bigger care)

| # | Location | Observation | Proposal |
|---|----------|-------------|----------|
| N1 | `mobile/hooks/useVoiceSession.ts` (539 LOC) / `useOnboardingVoiceSession.ts` (290 LOC) / `useAgentCreatorVoiceSession.ts` (287 LOC) | Three hooks share ~70% structural skeleton: `ws`/`subscription`/`isStopping`/`done`/`isRecording`/`timer`/`appState` refs, `cleanup()`, `startMicAndTimer()`, WS message dispatcher, PCM byte bookkeeping, app-state-change handler. They differ in (a) completion callback signature, (b) a small number of incoming message types, (c) the form payload sent at open. | Extract a `useVoiceSessionCore` base hook that owns mic + WS + PCM plumbing and exposes a typed message bus. Each specialized hook becomes 80-120 LOC of business logic. Net ~700 LOC saved + a single place to fix any mic/WS bug. |
| N2 | `mobile/hooks/usePracticeRecording.ts` (282) + `usePatternPracticeRecording.ts` (223) + `useDrillRecording.ts` (215) | Three near-identical PCM-upload hooks (start mic → collect chunks → POST to evaluator endpoint). Diff is the endpoint + returned shape. | Extract a `useRecordAndSubmit({ endpoint, formFields, parseResponse })` hook. Net ~350 LOC saved. |
| N3 | `server/src/voice/handlers/conversation-handler.ts` — `onSessionEnd` (150 LOC) + `onSessionEndStreaming` (200 LOC) | Two parallel code paths: one uses `runAnalysis`, the other uses `runAnalysisPhased`. The streaming path is always preferred at runtime (`session-manager.ts:916`); the non-streaming path only runs as an exception fallback. The duplicate DB-write / title-gen / weak-spots-absorb / pattern-analysis-trigger logic is copy-pasted. | Either (a) delete the non-streaming `onSessionEnd` and let the session-manager fall through to re-raising on error, OR (b) extract shared "persist session + side effects" helper and call from both paths. Option (b) is safer. |
| N4 | `server/src/voice/session-manager.ts` at 1,441 LOC | One class orchestrates WS in/out, Deepgram streaming, Cartesia TTS, PCM capture + fades + trim-time maps, pitch accumulation, RMS metering, silence/max-duration timers, greeting selection, system-prompt composition, analysis dispatch, audio persistence, and client-event forwarding. Single Responsibility is firmly violated. Multiple "ghosts of features past" (PCM write-stream logic coexisting with hi-fi client upload). | Not urgent. Eventually split into: `VoiceSessionOrchestrator` (state machine + WS), `SpeechCapture` (Deepgram + PCM + pitch/RMS), `TTSPlayer` (Cartesia pipe), `SessionPersister` (DB writes + audio encode). This is a larger refactor — flag for later. |
| N5 | `mobile/components/` flat file layout with **48 files** | Currently topology is "all in /components + a few subfolders". At this scale, feature grouping would help. Session-results primitives (`ScoreRing`, `PitchRibbon`, `PitchRibbonCaption`, `DeliverySignalStrip`, `ConversationRhythmStrip`, `SessionTranscript`, `SessionPatterns`, `SessionStrengthsFocus`, `SessionVerdict`, `SessionFullReport`, `AnalyzingBanner`, `CorrectionCard`, `CorrectionFilterChips`, `CorrectionsPreview`) cluster naturally into a `components/session/` folder. Practice-unrelated orbs (`MicBloomOrb`, `PracticeRecordOrb`, `AISpeakingOrb`) into `components/orbs/`. Voice-session overlay + agent bits (`VoiceSessionOverlay`, `AgentAvatar`, `AgentSelector`, `AgentCreationSheet`, `VoicePicker`) into `components/voice/` and `components/agent/`. | Low-priority but high-readability win. Can be done as a final "cosmetic" phase once dead code is out. |
| N6 | `mobile/components/lab/FrequencyStrip.tsx` is live on Practice tab | Promoted-from-lab infrastructure artifact. Its true home is alongside its caller in `components/practice/` (or at the top level). The `components/lab/` directory should stay for *active* experiments only. | Move `FrequencyStrip.tsx` to `components/practice/` once S6 removes the rest of `components/lab`. |
| N7 | `mobile/components/session-variants/VariantC.tsx` exporting `SessionRowVariantC` | Naming is a pivot artifact. Consumers alias it back to `SessionRow` at import time. After S5 deletes the old `SessionRow.tsx`, rename the export to `SessionRow` and move the file to top-level or `components/session/`. Delete the `session-variants/` folder. | Pure rename — safe. |
| N8 | `server/src/voice/handlers/types.ts` — `SessionEndResult.type` union (`'analysis' \| 'onboarding' \| 'agent-created' \| 'filler-practice'`) vs handler-specific optional fields (`agent?`, `displayName?`, `farewellMessage?`, etc.) all colocated on one fat type | A discriminated union per handler result type would prevent "field works only when type=X" runtime footguns. | Not urgent — behavior-neutral refactor. |
| N9 | `server/src/analysis/types.ts` — `PhasedInsightsPayload.score` (@deprecated) + `SessionEndResult.score` (@deprecated) | Two legacy aliases already labeled. Mobile's `types/session.ts` should be audited to confirm consumers read the new fields. | Verify, then remove. |
| N10 | `mobile/components/SessionSummaryCard.tsx` et al. duplication vs `SessionVerdict` + `SessionFullReport` | Already dead (S3), but worth noting that these dead variants still import `CorrectionFilterChips` → which keeps `StickySessionBar.tsx` alive in grep hits despite it also being dead. Cascading dead imports. | Remove top-down: dead screens/variants first, then their dead dependencies. |
| N11 | `mobile/components/lab/` barrel re-exports `MOCK_MODES`, `MockMode`, `FrequencySwitcher` | These three leave via the `index.ts` barrel but have no consumers. Barrel should only export what's live. | Tighten barrel to only `FrequencyStrip` / `StripMode` until the file moves out of `lab/`. |
| N12 | `.planning/phases/weak-spot-generated-exercises/` exists but is a directory (not a file like the others) | Convention drift — other phase plans are flat `phase-N-name.md`. | Normalize or verify it's intentional (contains subfiles). |

### 3.4 Informational (not worth fixing, but good to know)

- `RoleplayHandler` extends `ConversationHandler` — real code path, verified `agentMode === 'roleplay'` is reachable via `agent-config-extractor.ts` logic. Keep.
- `POST /jobs/run-pattern-analysis` (cron) + `POST /jobs/run-pattern-analysis/me` (manual) — both live.
- `GET /filler-summary` lives on `sessions.ts` (not `filler-coach.ts`) — minor organizational wart, not worth moving.
- `mobile/lib/introTimestamps.ts` at 595 LOC is hand-curated timing data bundled with `intro.wav`. Heavy but functional. Generated via `server/scripts/extract-intro-timestamps.ts`.
- `mobile/patches/@mykin-ai+expo-audio-stream+0.3.5.patch` exists — intentional postinstall patch-package hook, keep.

---

## 4. File-level dead code inventory (with confidence)

**Confidence legend**: `H` = zero external references anywhere, safe to delete. `M` = zero runtime references but exported/registered, verify typecheck passes. `L` = likely dead but used transitively or via runtime string; confirm manually.

### Mobile — delete

| Path | Confidence | Why |
|------|-----------|-----|
| `mobile/components/button-showcase/` (entire dir including `archive/` and `index.ts` and `Set11GlassIconPill.tsx`) | **H** | 12 Set*.tsx files, zero external imports, zero route references. |
| `mobile/components/patterns/` (entire dir: `CategoryCard.tsx`, `FeaturedPatternCard.tsx`, `HeatMapTimeline.tsx`, `InsightCard.tsx`, `MiniScoreRing.tsx`, `mockData.ts`, `index.ts`) | **H** | No file outside the dir imports anything from it. |
| `mobile/components/SessionSummaryCard.tsx` | **H** | Only self-references. |
| `mobile/components/SessionInsightCard.tsx` | **H** | Only self-references. |
| `mobile/components/SessionInsightsCard.tsx` | **H** | Only self-references. |
| `mobile/components/SummaryBar.tsx` | **H** | Only self-references. |
| `mobile/components/StickySessionBar.tsx` | **H** | Only self-references. (Imports `CorrectionFilterChips` which stays — used in `corrections-list.tsx`.) |
| `mobile/components/FillerWordsSummary.tsx` | **H** | Only self-references. |
| `mobile/components/SessionRow.tsx` | **H** | Superseded by `SessionRowVariantC`; no imports. |
| `mobile/components/lab/FrequencySwitcher.tsx` | **H** | No imports. |
| `mobile/components/lab/mockModes.ts` | **H** | Only referenced from `FrequencySwitcher` (also going away). |
| `/ios/` (the project-ROOT dir, not `mobile/ios/`) | **L** | Legacy `Pods/Target Support Files` directory at the monorepo root. Verify it's not part of any xcworkspace. |
| `mobile/dist/` (contents) | **H** | Gitignored but checked-out locally; Expo output. |

### Mobile — rename / move

| From | To | Why |
|------|----|-----|
| `mobile/components/session-variants/VariantC.tsx` → export `SessionRowVariantC` | `mobile/components/session/SessionRow.tsx` → export `SessionRow` | Naming artifact; single remaining variant; barrel re-exports drop. |
| `mobile/components/lab/FrequencyStrip.tsx` | `mobile/components/practice/FrequencyStrip.tsx` | It's live in Practice tab; `lab/` should be for dormant experiments. |

### Mobile — consolidate (no deletion of behavior)

| Group | Target | Why |
|-------|--------|-----|
| `useVoiceSession` + `useOnboardingVoiceSession` + `useAgentCreatorVoiceSession` | Shared `useVoiceSessionCore` in `mobile/hooks/voice/` with 3 thin wrappers | 70% shared skeleton, bug fixes won't drift across siblings. |
| `usePracticeRecording` + `usePatternPracticeRecording` + `useDrillRecording` | Shared `useRecordAndSubmit` in `mobile/hooks/recording/` with 3 thin callers | Same pattern, different endpoint. |

### Server — delete

| Path | Confidence | Why |
|------|-----------|-----|
| `server/src/routes/patterns.ts` (+ `patternRoutes` import/registration in `index.ts`) | **H** | `GET /patterns` never called from mobile; mobile uses `/practice/pattern-tasks`. |
| `server/src/routes/sessions.ts` — `POST /sessions` handler block (~100 LOC) + local `computeClarityScore()` helper (used only there) | **H** | Mobile never POSTs audio to `/sessions`. |
| `server/src/services/transcription.ts` — `transcribe()` and `stripSilence()` (keep `transcribeRawPCM`) | **H** | `transcribe()` only used by the dead `POST /sessions`; `stripSilence()` only used by `transcribe()`. |
| `server/src/analysis/runner.ts` — `runAnalysisStreaming()` export (+ re-export in `analysis/index.ts`) | **H** | Imported but never called. |

### Server — consolidate

| Group | Target | Why |
|-------|--------|-----|
| `ConversationHandler.onSessionEnd` vs `onSessionEndStreaming` | Extract shared `persistSessionAndSideEffects()` helper; keep both entry points but share the DB + greeting + pattern-analysis + weak-spots logic | Streaming path is always preferred; non-streaming is fallback — they should share the tail. |

---

## 5. Proposed folder structure (before → after)

### Mobile `components/` (illustrative; optional last-phase cosmetic)

**Before** (48 top-level files + 5 subfolders, mixed signals)
```
components/
├── button-showcase/        ← dead
├── lab/                    ← 1 live + 2 dead
├── patterns/               ← dead
├── practice/               ← live
├── session-variants/       ← 1 live, artifact name
├── ui/                     ← live primitives
└── <30 top-level .tsx>     ← live + 8 dead session cards
```

**After** (cleaner, feature-grouped; dead removed)
```
components/
├── agent/
│   ├── AgentAvatar.tsx
│   ├── AgentCreationSheet.tsx
│   ├── AgentSelector.tsx
│   └── VoicePicker.tsx
├── correction/
│   ├── CorrectionCard.tsx
│   ├── CorrectionFilterChips.tsx
│   └── CorrectionsPreview.tsx
├── orbs/
│   ├── AISpeakingOrb.tsx
│   ├── MicBloomOrb.tsx
│   └── PracticeRecordOrb.tsx
├── practice/               ← unchanged (already feature-grouped)
│   ├── ErrorReasonHeader.tsx
│   ├── FrequencyStrip.tsx  ← moved in from lab/
│   └── ...
├── pattern/
│   ├── PatternTaskCard.tsx
│   └── QueuedPatternCard.tsx
├── session/
│   ├── AnalyzingBanner.tsx
│   ├── ConversationRhythmStrip.tsx
│   ├── DeliverySignalStrip.tsx
│   ├── PitchRibbon.tsx
│   ├── PitchRibbonCaption.tsx
│   ├── ScoreRing.tsx
│   ├── SessionFullReport.tsx
│   ├── SessionPatterns.tsx
│   ├── SessionRow.tsx      ← from session-variants/VariantC.tsx
│   ├── SessionStrengthsFocus.tsx
│   ├── SessionTranscript.tsx
│   └── SessionVerdict.tsx
├── ui/                     ← unchanged (GlassCard, ScreenHeader, etc.)
├── voice/
│   └── VoiceSessionOverlay.tsx
├── GradientText.tsx        ← very generic, keep top-level
├── PracticeFeedbackPanel.tsx
├── StyleChips.tsx
└── SuccessCelebration.tsx
```

### Mobile `hooks/` (subgrouping)

**Before**: 21 flat hooks, 3 voice-session siblings with 70% overlap.

**After**:
```
hooks/
├── voice/
│   ├── useVoiceSessionCore.ts       ← extracted shared base
│   ├── useVoiceSession.ts           ← thin wrapper, business logic only
│   ├── useOnboardingVoiceSession.ts ← thin wrapper
│   └── useAgentCreatorVoiceSession.ts ← thin wrapper
├── recording/
│   ├── useRecordAndSubmit.ts        ← extracted shared base
│   ├── usePracticeRecording.ts      ← thin wrapper
│   ├── usePatternPracticeRecording.ts ← thin wrapper
│   └── useDrillRecording.ts         ← thin wrapper
├── data/                            ← pure react-query hooks
│   ├── useAgents.ts
│   ├── useFillerCoachSessions.ts
│   ├── useFillerCoachStats.ts
│   ├── useFillerSummary.ts
│   ├── usePatternTasks.ts
│   ├── usePracticeTasks.ts
│   ├── useSession.ts
│   ├── useSessions.ts
│   ├── useVoicePreview.ts
│   ├── useVoices.ts
│   └── useWeakSpots.ts
├── useAppWarmup.ts
├── useAudioPlayback.ts
├── useIntroAudio.ts
└── usePracticeModes.ts
```

### Server — small tweaks, no large restructure

```
server/src/
├── analysis/                ← unchanged; delete runAnalysisStreaming export
├── db/                      ← unchanged
├── jobs/                    ← unchanged
├── plugins/                 ← unchanged
├── routes/                  ← delete patterns.ts; slim sessions.ts (drop POST handler)
├── services/                ← slim transcription.ts (drop transcribe/stripSilence)
├── utils/                   ← unchanged
└── voice/                   ← unchanged in layout; optional future SRP split on session-manager.ts
```

---

## 6. Cleanup & restructuring plan (sequenced, risk-minimizing)

Each phase is independently shippable and independently verifiable. Run `npm run typecheck` (mobile: `npx tsc --noEmit -p mobile`; server: `cd server && npx tsc --noEmit`) and exercise key flows between phases. Manual smoke tests listed per phase.

### Phase A — Safe dead-file removal (pure deletion, no refactor)
*Target: ~3,500 LOC removed from mobile + ~700 LOC removed from server. Zero behavior change.*

Steps (each is a separate commit for easy rollback):
1. **A1** — Delete `mobile/components/button-showcase/` entirely.
2. **A2** — Delete `mobile/components/patterns/` entirely.
3. **A3** — Delete the 5 dead session-results cards: `SessionSummaryCard.tsx`, `SessionInsightCard.tsx`, `SessionInsightsCard.tsx`, `SummaryBar.tsx`, `StickySessionBar.tsx`.
4. **A4** — Delete `FillerWordsSummary.tsx`, `SessionRow.tsx` (top-level; `session-variants/VariantC.tsx` still lives).
5. **A5** — Slim `mobile/components/lab/`: delete `FrequencySwitcher.tsx` + `mockModes.ts`; update `index.ts` to only export `FrequencyStrip` / `StripMode`.
6. **A6** — Delete `server/src/routes/patterns.ts` and remove its `import` + `app.register(patternRoutes)` from `server/src/index.ts`.
7. **A7** — In `server/src/routes/sessions.ts`, delete the `POST /sessions` handler block (lines 25–127 in the current file) and the local `computeClarityScore` helper. Leave `GET /sessions`, `GET /sessions/:id`, `GET /filler-summary`.
8. **A8** — In `server/src/services/transcription.ts`, delete `transcribe()` and `stripSilence()`. Keep `transcribeRawPCM()` and the internal `callDeepgram()`. Update the file header comment.
9. **A9** — Delete `runAnalysisStreaming` from `server/src/analysis/runner.ts` and remove it from the re-export in `server/src/analysis/index.ts`. Remove the unused import in `server/src/voice/handlers/conversation-handler.ts`.
10. **A10** — Verify the project-root `ios/` directory is not referenced by any workspace; if confirmed orphan, delete. Add a `/ios` entry at the ROOT `.gitignore` if the root should never hold iOS files.

**Verification after Phase A**:
- `cd mobile && npx tsc --noEmit` — clean.
- `cd server && npx tsc --noEmit` — clean.
- Metro/Expo starts; no "cannot resolve" warnings.
- Manual smoke: sign in → voice session → session detail opens with verdict + pitch ribbon + corrections. Practice tab → weak spots, fillers mode, patterns mode. Profile → settings.

### Phase B — Legacy alias removal (strict dependency on Phase A)
*Target: remove the "one release" deprecation warts documented in code.*

1. **B1** — Audit mobile `types/session.ts` consumers: confirm `deliveryScore` / `languageScore` are read everywhere; no references to the deprecated `.score` alias on session payloads.
2. **B2** — Remove `score` field from `PhasedInsightsPayload` (server `analysis/types.ts`) and `SessionEndResult` (server `voice/handlers/types.ts`) and the two call sites that populate it in `session-manager.ts` (`score: payload.score` and `score: result.score`).
3. **B3** — Typecheck both sides. If mobile still references `.score`, replace with `.deliveryScore ?? .languageScore` before merging B2.

**Verification**: Same smoke as Phase A plus "session results page shows scores correctly for a fresh session".

### Phase C — Rename + move (surgical)
*Target: `session-variants/VariantC.tsx` → `session/SessionRow.tsx`; `lab/FrequencyStrip.tsx` → `practice/FrequencyStrip.tsx`.*

1. **C1** — Rename `SessionRowVariantC` to `SessionRow` inside `VariantC.tsx`; update the two importers (`all-sessions.tsx`, `(tabs)/index.tsx`) to remove the `as SessionRow` alias.
2. **C2** — Move the file: `mobile/components/session-variants/VariantC.tsx` → `mobile/components/SessionRow.tsx` (top-level for now; will land in `components/session/` in Phase E). Delete `session-variants/index.ts` + the folder.
3. **C3** — Move `mobile/components/lab/FrequencyStrip.tsx` → `mobile/components/practice/FrequencyStrip.tsx`. Update the import on `(tabs)/practice.tsx`. Delete `mobile/components/lab/index.ts` and the now-empty `mobile/components/lab/` folder.
4. **C4** — Typecheck.

**Verification**: Home tab's session list renders. All-sessions page renders. Practice tab's FrequencyStrip still visible.

### Phase D — Hook consolidation (more care)
*Target: dedupe 3 voice-session hooks and 3 recording hooks. ~700-900 LOC saved.*

1. **D1** — Design + review: write `useVoiceSessionCore` signature (exposes `open(wsPath, onMessage)`, `close()`, typed events, PCM byte tracker, app-state hook, keep-awake, mic subscription). Confirm with the user before coding.
2. **D2** — Build `useVoiceSessionCore.ts` in `mobile/hooks/voice/`.
3. **D3** — Migrate `useVoiceSession` to use the core; verify behavior (home tab voice session → analysis complete).
4. **D4** — Migrate `useOnboardingVoiceSession` (onboarding voice screen).
5. **D5** — Migrate `useAgentCreatorVoiceSession` (agent-create screen).
6. **D6** — Same exercise for `useRecordAndSubmit` → `usePracticeRecording`, `usePatternPracticeRecording`, `useDrillRecording`.

**Verification** per migration: the specific flow works end-to-end. Keep a "known good" baseline commit before each step so rollback is one command.

### Phase E — Server handler dedup (medium)
*Target: share the DB-persist / greeting-regen / pattern-analysis-trigger / weak-spots-absorb logic between `ConversationHandler.onSessionEnd` and `onSessionEndStreaming`.*

1. **E1** — Extract `persistConversationSession({ userId, agentConfig, analysisResult, metadata, clarityScore, durationSeconds, fullTranscription, conversationHistory, speechTimeline, contextNotes })` that returns `{ sessionId, correctionIds }` and fires the side effects.
2. **E2** — Rewrite `onSessionEnd` to call it after `runAnalysis`.
3. **E3** — Rewrite `onSessionEndStreaming` to call it after `runAnalysisPhased`.
4. **E4** — Run a full analysis flow to verify both paths return identical DB rows / client payloads.

**Verification**: Voice session completes; session row appears; corrections written; weak spots absorbed; next-session greeting regenerates.

### Phase F — Cosmetic component reorganization (optional; last)
*Target: `mobile/components/` feature-grouped folders (see §5 tree).*

Only do this once Phases A–E are green. Purely moves, no logic changes.

1. **F1** — Create new folders (`agent/`, `correction/`, `orbs/`, `pattern/`, `session/`, `voice/`).
2. **F2** — Move files according to the tree. Use an import codemod or IDE rename so references update atomically.
3. **F3** — Typecheck + smoke test every major screen.

---

## 7. Migration sequence to minimize breakage risk

```
A1 → A2 → A3 → A4 → A5    (mobile pure deletion, independent)
         ↓
A6 → A7 → A8 → A9 → A10   (server pure deletion, independent)
         ↓
B1 → B2 → B3              (legacy alias removal; B1 is read-only verification)
         ↓
C1 → C2 → C3 → C4         (renames/moves; independent)
         ↓
D1 → review → D2          (hook extraction design; STOP for approval before D2)
         ↓
D3 → D4 → D5 (voice hooks, one at a time; rollback between each if smoke fails)
         ↓
D6 (recording hooks; same cadence)
         ↓
E1 → E2 → E3 → E4         (server handler dedup; full analysis flow must work after each)
         ↓
F1 → F2 → F3              (cosmetic reshuffle; requires import codemod)
```

**Golden rule**: a phase is done when `npx tsc --noEmit` passes on both sides AND the key smoke path is manually confirmed. If anything fails, revert to the previous commit and re-plan.

---

## 8. Verification steps (attach to each PR / phase)

### Typecheck
- `cd mobile && npx tsc --noEmit` → must be clean.
- `cd server && npx tsc --noEmit` → must be clean.

### Build
- `cd mobile && npx expo prebuild --clean --platform ios` (only after Phase F to confirm no hidden native refs).

### Manual smoke matrix (run after each phase)
1. Sign up → onboarding voice session → land on Home tab.
2. Home tab → open a session row → session detail renders verdict + pitch ribbon + corrections preview.
3. Practice tab → switch between Corrections / Weak Spots / Fillers / Patterns modes.
4. Practice tab → start a weak-spot drill → pass/fail flow returns to list.
5. Practice tab → start a pattern exercise → complete and auto-promote next.
6. Voice session (Home) → "end" → session row appears within ~15s.
7. Filler Coach → session completes → results screen → session row in `filler-coach-sessions`.
8. Profile → open agent → create agent (voice flow).

### Log sanity
- No `[grammar-analyzer] Failed` or `[voice-session] Deepgram error` during smoke.
- No "Cannot find module" warnings in Metro.
- Server logs show expected `[conversation-handler]`, `[patterns-job]`, `[weak-spot-manager]` phases.

---

## 9. Risky items that need explicit user confirmation before acting

1. **Project-root `/ios/Pods/Target Support Files`** (Finding S10) — confirm it's orphan before deletion. Check any xcworkspace outside `mobile/ios/` that might reference it.
2. **`mobile/.design-extract/` frames** (Finding S12) — keep where it is, move to `.planning/design/`, or delete? User preference.
3. **Phase F (cosmetic reshuffle)** — big git-diff, no behavior change. Should only run with user sign-off because it's pure churn for reviewers.
4. **Legacy `score` alias removal (Phase B2)** — one release window hasn't necessarily elapsed since the alias was added (see `@deprecated` comments). Confirm no older app versions still in the wild read `.score`.
5. **Session-manager.ts SRP split (Finding N4)** — NOT in this plan; flagged as "eventually." Do not undertake without a separate approved design.

---

## 10. Non-goals of this audit

- No changes to the voice pipeline tuning (`utterance_end_ms=1000`, `endpointing=300`, debounce=150ms, echo grace=500ms — all recorded in MEMORY.md as carefully tuned).
- No changes to the Vibrant Glass theme tokens or the design system.
- No schema migrations. Migrations 0001–0023 stay in chronological order; squashing is explicitly out of scope.
- No dependency bumps. `package.json` audits for unused deps can happen separately if desired (nothing jumped out as definitively unused — all listed deps have grep hits).
- No changes to prompts / LLM wiring (grammar, filler, patterns, session insights, greetings, title, profile).

---

## 11. Estimated effort (rough)

| Phase | Expected PRs | Expected engineering time |
|-------|--------------|---------------------------|
| A (dead-file deletion) | 1 | 1–2 hours |
| B (alias removal) | 1 | 30 min |
| C (renames + moves) | 1 | 30 min |
| D (hook consolidation) | 3–4 | 1–2 days |
| E (server handler dedup) | 1 | 2–4 hours |
| F (cosmetic reshuffle) | 1 | 1 hour |

Total: ~3 engineering days to land all phases cleanly with smoke tests.

---

## 12. Open questions for the user

1. Approve Phase A as-is and start? (Biggest win, lowest risk.)
2. Keep `mobile/.design-extract/` where it is, move it, or delete?
3. Confirm nothing external references the project-root `/ios/Pods/` directory (Xcode workspace, CI script, etc.).
4. Phase D hook consolidation: want me to draft the shared-core hook signature first for review, or proceed straight to implementation?
5. Phase F cosmetic reshuffle: yes (cleaner long-term) or skip (avoid review churn)?

---

*Audit produced by the codebase-architect-auditor agent, 2026-04-20.*
