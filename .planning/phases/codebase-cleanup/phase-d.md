# Phase D — Hook consolidation (voice + recording)

**Source audit**: `.planning/audits/codebase-audit-2026-04-20.md` (§3.3 N1+N2, §6 Phase D, §7 sequence)
**Depends on**: Phases A + B + C merged (all are — see `README.md`).
**Branch to create**: `cleanup/phase-d-hook-consolidation`
**Expected impact**: 8 hook files touched (6 migrated + 2 new base hooks + 1 new shared util); ~850-1000 LOC net removed after all migrations. Zero behavior change.
**Expected effort**: 3-5 hours of focused coding after D1 approval; budget 2 sessions if needed (split natural breakpoint between voice and recording halves).
**Review gate**: **D1 MUST be approved by user before D2 begins.** This is the only phase with a mandatory user-in-the-loop design review.

---

## One-paragraph briefing (read this first if you have no prior context)

Three voice-session hooks (`useVoiceSession.ts` 539 LOC, `useOnboardingVoiceSession.ts` 290, `useAgentCreatorVoiceSession.ts` 287) share ~70% plumbing: mic subscription, WebSocket lifecycle, session timer, app-state foreground/background handling, keep-awake activation, echo-grace mic gating after AI speech, and cleanup ordering. Three recording hooks (`usePracticeRecording.ts` 282, `usePatternPracticeRecording.ts` 223, `useDrillRecording.ts` 215) share the entire mic→chunks→RMS→timer→POST-evaluator loop, differing only in endpoint URL, form field names, and response shape. Phase D extracts two base hooks (`useVoiceSessionCore` and `useRecordAndSubmit`) plus one shared utility (`lib/rms.ts`). Each of the 6 specialized hooks becomes a thin wrapper holding only its unique business logic (completion callback shape, specific WS message types it cares about, playback timing for the full voice session, etc.). Zero behavior change — every migration ends with a device smoke of the specific flow the hook drives, rollback on failure = `git reset --hard HEAD~1`.

---

## Preconditions (verify before starting)

Run these checks. If any fails, STOP and re-plan.

1. `git status` → clean working tree.
2. `git rev-parse --abbrev-ref HEAD` → should be `main`.
3. `git log --oneline -8 | grep "mark phase C shipped"` → should match (confirms Phase C is merged).
4. **Current-state verification**:
   - `wc -l mobile/hooks/useVoiceSession.ts mobile/hooks/useOnboardingVoiceSession.ts mobile/hooks/useAgentCreatorVoiceSession.ts` → 539 / 290 / 287 (±5 LOC ok).
   - `wc -l mobile/hooks/usePracticeRecording.ts mobile/hooks/usePatternPracticeRecording.ts mobile/hooks/useDrillRecording.ts` → 282 / 223 / 215 (±5 LOC ok).
   - `ls mobile/hooks/voice/ 2>/dev/null` → **must not exist** (D2 creates it).
   - `ls mobile/hooks/recording/ 2>/dev/null` → **must not exist** (D6 creates it).
   - `ls mobile/lib/rms.ts 2>/dev/null` → **must not exist** (D6 creates it).
5. **Importer inventory** (confirms the 6 call sites haven't moved since the research):
   - `rg "from ['\"].*useVoiceSession['\"]" mobile/` → `mobile/app/(tabs)/index.tsx`, `mobile/app/filler-coach.tsx` (2 call sites).
   - `rg "from ['\"].*useOnboardingVoiceSession['\"]" mobile/` → `mobile/app/(onboarding)/voice-session.tsx` (1).
   - `rg "from ['\"].*useAgentCreatorVoiceSession['\"]" mobile/` → `mobile/app/agent-create.tsx` (1).
   - `rg "from ['\"].*usePracticeRecording['\"]" mobile/` → `mobile/app/practice-session.tsx` (1).
   - `rg "from ['\"].*usePatternPracticeRecording['\"]" mobile/` → `mobile/app/pattern-practice-session.tsx` (1).
   - `rg "from ['\"].*useDrillRecording['\"]" mobile/` → `mobile/app/weak-spot-drill.tsx` (1).
6. **Typecheck baseline**:
   - `cd mobile && npx tsc --noEmit 2>&1 | grep -c "error TS"` → **7** (baseline, unchanged across Phases A–C).
   - `cd server && npx tsc --noEmit 2>&1 | grep -c "error TS"` → **1** (baseline; server untouched in Phase D).

> If any of #4–#5 returns unexpected hits or counts, call-site topology has shifted since the research. STOP and re-verify the research report's assumptions.

---

## Scope

**In scope:**
1. Create `mobile/hooks/voice/useVoiceSessionCore.ts` (new file, ~350 LOC).
2. Migrate `useVoiceSession.ts` in place → thin wrapper over core, keeps its current path.
3. Migrate `useOnboardingVoiceSession.ts` in place → thin wrapper.
4. Migrate `useAgentCreatorVoiceSession.ts` in place → thin wrapper.
5. Create `mobile/lib/rms.ts` (new file, ~20 LOC) — shared `computeRMS(base64)` utility.
6. Create `mobile/hooks/recording/useRecordAndSubmit.ts` (new file, ~200 LOC).
7. Migrate `usePracticeRecording.ts` → thin wrapper.
8. Migrate `usePatternPracticeRecording.ts` → thin wrapper.
9. Migrate `useDrillRecording.ts` → thin wrapper.

**Out of scope** (DO NOT touch in this phase):
- **Moving wrappers into subdirs.** The 6 wrapper hooks stay at their current paths (`mobile/hooks/useVoiceSession.ts` etc.) so their 8 call-site imports don't need to change. The audit §5's target tree (wrappers under `hooks/voice/` + `hooks/recording/`) is Phase F cosmetic territory.
- **session-manager.ts SRP split (N4).** Explicitly deferred per master plan.
- **Changing behavior.** Every wrapper must be observably identical to its pre-migration form. No bug fixes, no extra logging, no "while I'm in here" cleanups.
- **Unifying the voice and recording cores.** They share surface-level patterns but have fundamentally different transports (WS vs HTTP POST) and sample rates (48kHz vs 16kHz). Keep them separate.
- **Adding a shared mic adapter hook.** Research flagged this as tempting but premature. Each core inlines its own mic setup; extract later if duplication proves painful.
- **Moving `useVoiceSessionCore` or `useRecordAndSubmit` into the `mobile/hooks/data/` tree.** That's Phase F cosmetic reorg.
- **Adding barrel files** for `hooks/voice/` or `hooks/recording/`. Direct imports match the current style (see Phase C rationale).
- **Any server changes.** Phase E covers server handler dedup separately.

---

## D1 — Design (THIS SECTION IS D1 — USER REVIEWS BEFORE D2 BEGINS)

### D1.1 — `useVoiceSessionCore` API

**Location**: `mobile/hooks/voice/useVoiceSessionCore.ts`

**Responsibilities (owned by core):**
- Request mic permissions, start `ExpoPlayAudioStream` at 48kHz/16-bit/100ms.
- Open WebSocket to a caller-provided URL; send an initial `{ type: 'start', ... }` payload the caller constructs.
- Stream base64 PCM chunks over WS as `{ type: 'audio', data }`.
- Track session elapsed seconds in `useSessionStore` via `incrementElapsedTime()` (1s tick).
- Handle app-state → background: call `cleanup()` and transition state to `idle`.
- Activate `expo-keep-awake` on start; deactivate on cleanup/error.
- Echo-grace: gate mic chunks 500ms after `audio_end` to prevent AI-voice echo feedback.
- Handle `turn_state`, `audio`, `audio_end`, `ready`, `error`, `mute_state`, `session_ending` messages internally (they're identical across all 3 voice hooks).
- Forward ALL other messages to a caller-provided `onMessage(msg)` dispatcher — the caller handles business-specific types (`session_end`, `insights_ready`, `analysis_complete`, `correction`, `agent_created`, `onboarding_complete`).
- Own cleanup ordering (timer → subscription → WS → keep-awake) with idempotency guard.

**API signature (proposed):**
```typescript
export interface VoiceSessionCoreConfig {
  /** Constructed by caller. Core does not interpret — just opens this URL. */
  wsUrl: string;
  /** Body of the initial `{type: "start", ...startPayload}` frame sent on WS open. */
  startPayload: Record<string, unknown>;
  /** Caller-specific message handler. Core pre-consumes generic types (turn_state, audio, etc.); everything else goes here. */
  onMessage: (msg: { type: string; [k: string]: unknown }) => void;
  /** Fatal-error callback (mic perm denied, WS connect failure, PCM error). */
  onError: (message: string) => void;
}

export interface VoiceSessionCoreHandle {
  /** Ask permissions, open WS, start mic, start timer. Idempotent if already started. */
  start: () => Promise<void>;
  /** Stop WS + mic + timer + keep-awake. Idempotent. */
  stop: () => Promise<void>;
  /** Send {type: "toggle_mute"} to server; store updates from server's mute_state reply. */
  toggleMute: () => void;
  /** Alias for stop(); provided for call-site ergonomics (matches current API). */
  cleanup: () => Promise<void>;
  /** For callers that need to send custom messages (e.g., {type: "ping"}). */
  sendMessage: (msg: unknown) => void;
  /** Exposed so `useVoiceSession` wrapper can read it for playback scheduling. */
  wsRef: React.MutableRefObject<WebSocket | null>;
}

export function useVoiceSessionCore(config: VoiceSessionCoreConfig): VoiceSessionCoreHandle;
```

**What stays OUT of core (lives in wrappers):**
- Multi-turn playback timing (`playbackTimerRef`, `firstAudioTimeRef`, `turnAudioBytesRef`, `turnAudioChunksRef`) — only `useVoiceSession` needs this.
- `pendingCompleteRef` / `pendingAgentRef` deferred-completion logic — differs per wrapper (onboarding silently completes on error; agent-creator defers until TTS done).
- The completion callback signature itself: `onSessionEnd(results, dbSessionId)` vs `onComplete(displayName, observation, farewellMessage)` vs `onAgentCreated(agent)`.
- Hi-fi audio upload (`uploadHiFiAudio(dbSessionId)`) — exclusive to `useVoiceSession`.
- Idempotency guards specific to a flow (onboarding's `cleanedUpRef`).

### D1.2 — `useRecordAndSubmit` API

**Location**: `mobile/hooks/recording/useRecordAndSubmit.ts`

**Responsibilities (owned by core):**
- Request mic permissions, start `ExpoPlayAudioStream` at 16kHz/16-bit/100ms.
- Drop the first chunk (mic initialization noise).
- Collect subsequent chunks into an array (base64 PCM).
- Compute RMS on each chunk, update a `Reanimated.SharedValue<number>` for the audio visualizer.
- 1s timer tick for `elapsedSeconds`.
- Enforce 15s max duration (auto-stop).
- Abort "too short" submissions (chunks.length === 0 || elapsed < 1s) — caller decides what to show (idle reset, or error).
- On `stop(params)`: stop mic, concatenate chunks, build multipart form via `formFields(params)` + `sampleRate`/`channels`/`encoding`/`audio`, POST to `endpoint`, parse response via `parseResponse(json)`, store result.
- Cleanup on unmount.

**API signature (proposed):**
```typescript
export interface RecordAndSubmitConfig<TParams, TResult> {
  /** Absolute server path, e.g. '/practice/evaluate' (API_URL prepended inside core). */
  endpoint: string;
  /** Builds the non-audio multipart fields from caller's stop() params. */
  formFields: (params: TParams) => Record<string, string | number>;
  /** Maps raw JSON response to the wrapper's result shape. */
  parseResponse: (json: unknown) => TResult;
  /** Default 15; set lower for constrained flows if ever needed. */
  maxDurationSeconds?: number;
}

export type RecordAndSubmitState = 'idle' | 'recording' | 'evaluating' | 'result';

export interface RecordAndSubmitHandle<TParams, TResult> {
  state: RecordAndSubmitState;
  elapsedSeconds: number;
  result: TResult | null;
  error: string | null;
  audioLevel: Reanimated.SharedValue<number>;
  start: () => Promise<void>;
  stop: (params: TParams) => Promise<void>;
  reset: () => void;
}

export function useRecordAndSubmit<TParams, TResult>(
  config: RecordAndSubmitConfig<TParams, TResult>,
): RecordAndSubmitHandle<TParams, TResult>;
```

### D1.3 — `lib/rms.ts`

**Location**: `mobile/lib/rms.ts`

Pure function, no hooks. Identical across all 3 recording hooks today:

```typescript
/** Decode base64 PCM16LE and return normalized RMS amplitude in [0, 1]. */
export function computeRMS(base64Chunk: string): number {
  // Exact copy of the existing impl from usePracticeRecording.ts lines X-Y.
  // Verified identical across all 3 recording hooks.
}
```

### D1.4 — Risks & gotchas (from research, carried into execution)

These are NOT blockers, but must inform coding:

1. **`useVoiceSession` D3 is the biggest single commit.** 539 → ~120 LOC wrapper. Core absorbs plumbing; playback math stays in wrapper. Expect the diff to look alarming; `git mv`-style similarity detection won't help.
2. **`useVoiceSession` has TWO call sites** — `(tabs)/index.tsx` (home) and `filler-coach.tsx`. D3 smoke MUST cover both. (Research said 1 site; grep confirms 2.)
3. **Onboarding's silent-error-completion pattern** (`cleanedUpRef` + WS error triggers `onComplete(null, null, null)`) is deliberate UX — don't let the core turn this into an `onError` bubble. Wrapper must swallow core errors and convert them to skip-completions.
4. **Agent-creator's TTS-then-callback deferral** depends on `playbackTimerRef` — but playback timing lives in `useVoiceSession`, not agent-creator. Agent-creator's current impl tracks playback via the `audio` / `audio_end` messages it sees in its message dispatcher. The core emits these to `onMessage` — wrapper can count bytes there or defer until it sees `audio_end`. **Design decision**: wrapper counts its own playback, doesn't ask core for it.
5. **Recording hooks use 16kHz, voice hooks use 48kHz.** The mic config is NOT shared between cores. Keep them fully separate — do not attempt to DRY the mic setup across both cores.
6. **The `formFields` builder param in `useRecordAndSubmit`**: all 3 callers pass different param shapes to `stop()`. Using generics (`<TParams>`) keeps type safety. Example wrapper usage:
   ```typescript
   const core = useRecordAndSubmit<
     { correctionId: number; mode: PracticeMode; scenario?: string },
     PracticeResult
   >({
     endpoint: '/practice/evaluate',
     formFields: ({ correctionId, mode, scenario }) => ({
       correctionId, mode, ...(scenario ? { scenario } : {}),
     }),
     parseResponse: (json) => json as PracticeResult,
   });
   ```

### D1.5 — Known unknowns

- The exact number of message types the core needs to internally consume (`turn_state`, `audio`, `audio_end`, `ready`, `error`, `mute_state`, `session_ending`) — research listed these as "identical across all 3 hooks" but I'll confirm while writing D2. If any differs, core's onMessage forwards it instead of consuming it.
- Whether the cleanup ordering subtly matters (e.g., WS close before or after mic stop, timer stop first or last). Research implies all 3 hooks follow `timer → subscription → WS → keep-awake`; I'll match that exactly.
- Whether `useVoiceSession`'s `turnAudioBytesRef` byte-counting needs access to individual `audio` message payloads BEFORE they're forwarded. If yes, core must emit `audio` messages AFTER its own handling (via `onMessage`); if no, core consumes them silently and wrapper uses its own `turn_state`-driven bookkeeping.

**→ REVIEW GATE: user reads this section, asks questions, approves. Only then proceed to D2.**

---

## Execution (step-by-step, one commit each)

All sub-steps commit to `cleanup/phase-d-hook-consolidation`. After each migration (D3/D4/D5/D7/D8/D9), the author stops and asks user to device-smoke the specific flow. **Do not proceed to the next sub-step until smoke confirms green.**

### D2 — Build `useVoiceSessionCore` (new file, no migrations yet)

Create `mobile/hooks/voice/useVoiceSessionCore.ts` matching the D1.1 signature. Study `useOnboardingVoiceSession.ts` as the cleanest template (287 LOC, fewer special cases than `useVoiceSession.ts`), port its plumbing verbatim, generalize the WS URL + start payload + unrecognized-message handling. Delete nothing yet.

**Verify**:
- `cd mobile && npx tsc --noEmit 2>&1 | grep -c "error TS"` → **7** (baseline; the new file must be strict-typed).
- `rg "useVoiceSessionCore" mobile/` → shows only the new file (no wrappers use it yet — that's D3).

**Commit**: `chore(cleanup): D2 — build useVoiceSessionCore base hook`

### D3 — Migrate `useVoiceSession` to wrap core

Rewrite `mobile/hooks/useVoiceSession.ts` as a thin wrapper:
- Accept the same public signature (no breaking changes to call sites).
- Construct `wsUrl` from `agentId` / `mode` / `formContext` params (same as current).
- Build `startPayload` from the same param set.
- Instantiate `useVoiceSessionCore({ wsUrl, startPayload, onMessage: handleBusiness, onError })`.
- `handleBusiness` handles ONLY: `session_end`, `insights_ready`, `analysis_complete`, `correction`, `agent_created`, AND any playback-timing updates driven by `audio` / `audio_end` that the core forwards.
- Keep `turnAudioBytesRef`, `playbackTimerRef`, `firstAudioTimeRef`, `turnAudioChunksRef`, `audioChunkCountRef`, `turnSpeakingStartRef` (multi-turn scheduling refs) in the wrapper.
- Keep `uploadHiFiAudio(dbSessionId)` in the wrapper; expose on return.

**Verify**:
- `cd mobile && npx tsc --noEmit 2>&1 | grep -c "error TS"` → **7**.
- `wc -l mobile/hooks/useVoiceSession.ts` → ~120 LOC (down from 539).
- **Device smoke** — BOTH call sites:
  1. Home tab voice session → start → speak → observe live transcription → end → verify analysis screen renders with score, corrections, pitch ribbon.
  2. Filler Coach → start a filler-practice session → complete → verify filler coach results screen renders.
- Server log check: `[conversation-handler]` emits `analysis_complete`; no `[voice-session]` errors.

**Commit**: `chore(cleanup): D3 — migrate useVoiceSession to core wrapper`

### D4 — Migrate `useOnboardingVoiceSession`

Rewrite as thin wrapper:
- `wsUrl` is `/voice-session&mode=onboarding`.
- `startPayload` is the onboarding context (user ID, language, etc. as today).
- `handleBusiness` handles ONLY `onboarding_complete`.
- Preserve `cleanedUpRef` idempotency; on core's `onError`, call `onComplete(null, null, null)` (silent skip).
- Preserve `pendingCompleteRef` pattern for deferring completion until TTS finishes.

**Verify**:
- Typecheck → 7.
- `wc -l mobile/hooks/useOnboardingVoiceSession.ts` → ~80 LOC (down from 290).
- **Device smoke** — sign up → go through onboarding voice → answer prompts → land on Home tab. If WS errors mid-flow, the user should still land on Home (silent skip).

**Commit**: `chore(cleanup): D4 — migrate useOnboardingVoiceSession to core wrapper`

### D5 — Migrate `useAgentCreatorVoiceSession`

Rewrite as thin wrapper:
- `wsUrl` is `/voice-session&mode=agent-creator&formContext=…`.
- `startPayload` carries the agent form state.
- `handleBusiness` handles ONLY `agent_created`, `session_ending`.
- Preserve `pendingAgentRef` deferral until TTS completes (tracked via `audio_end` message seen in dispatcher).
- Preserve `useAgentStore.getState().addAgent(agent)` side effect before firing `onAgentCreated`.

**Verify**:
- Typecheck → 7.
- `wc -l mobile/hooks/useAgentCreatorVoiceSession.ts` → ~85 LOC (down from 287).
- **Device smoke** — Profile → create new agent → voice flow → agent appears in picker after TTS farewell finishes.

**Commit**: `chore(cleanup): D5 — migrate useAgentCreatorVoiceSession to core wrapper`

### D6 — Build `lib/rms.ts` + `useRecordAndSubmit`

Two new files, one commit:
1. Create `mobile/lib/rms.ts` with `computeRMS(base64)` copied verbatim from `usePracticeRecording.ts` (lines containing the existing impl — find via `rg -n "computeRMS" mobile/hooks/`).
2. Create `mobile/hooks/recording/useRecordAndSubmit.ts` matching D1.2 signature. Use `usePatternPracticeRecording.ts` as template (simplest of the three at 223 LOC). Imports `computeRMS` from `../../lib/rms`.

**Verify**:
- Typecheck → 7.
- `rg "useRecordAndSubmit|from ['\"].*lib/rms['\"]" mobile/` → shows only the new files (no callers yet).

**Commit**: `chore(cleanup): D6 — build useRecordAndSubmit base hook + lib/rms`

### D7 — Migrate `usePracticeRecording`

Rewrite as thin wrapper:
```typescript
const core = useRecordAndSubmit<
  { correctionId: number; mode: PracticeMode; scenario?: string },
  PracticeResult
>({
  endpoint: '/practice/evaluate',
  formFields: ({ correctionId, mode, scenario }) => ({
    correctionId, mode, ...(scenario ? { scenario } : {}),
  }),
  parseResponse: (json) => json as PracticeResult,
});
```
Expose the existing public surface (`start`, `stop(correctionId, mode, scenario?)`, `reset`, `state`, `elapsedSeconds`, `result`, `error`, `audioLevel`). The wrapper's `stop()` just calls `core.stop({ correctionId, mode, scenario })`.

**Verify**:
- Typecheck → 7.
- `wc -l mobile/hooks/usePracticeRecording.ts` → ~60 LOC (down from 282).
- **Device smoke** — Practice tab → Corrections mode → start a correction → record → submit → pass/fail result renders. Run through at least 2 corrections.

**Commit**: `chore(cleanup): D7 — migrate usePracticeRecording to core wrapper`

### D8 — Migrate `usePatternPracticeRecording`

Same shape as D7 but:
```typescript
const core = useRecordAndSubmit<{ exerciseId: number }, PracticeResult>({
  endpoint: '/practice/pattern-evaluate',
  formFields: ({ exerciseId }) => ({ exerciseId }),
  parseResponse: (json) => json as PracticeResult,
});
```

**Verify**:
- Typecheck → 7.
- `wc -l mobile/hooks/usePatternPracticeRecording.ts` → ~40 LOC (down from 223).
- **Device smoke** — Patterns tab → start an exercise → record → pass → auto-promote to next exercise.

**Commit**: `chore(cleanup): D8 — migrate usePatternPracticeRecording to core wrapper`

### D9 — Migrate `useDrillRecording`

Same shape but the stop-param unpacks a `drillItem`:
```typescript
const core = useRecordAndSubmit<{ drillItem: DrillItem; weakSpotId: number }, DrillResult>({
  endpoint: '/practice/weak-spot-evaluate',
  formFields: ({ drillItem, weakSpotId }) => ({
    weakSpotId,
    itemType: drillItem.type,
    itemId: drillItem.data.id,
  }),
  parseResponse: (json) => json as DrillResult,
});
```

**Verify**:
- Typecheck → 7.
- `wc -l mobile/hooks/useDrillRecording.ts` → ~35 LOC (down from 215).
- **Device smoke** — Practice tab → Weak Spots mode → start a drill → record → pass/fail → list updates.

**Commit**: `chore(cleanup): D9 — migrate useDrillRecording to core wrapper`

---

## Post-phase verification

### Typecheck parity
- `cd mobile && npx tsc --noEmit 2>&1 | grep -c "error TS"` → **7** (baseline).
- `cd server && npx tsc --noEmit 2>&1 | grep -c "error TS"` → **1** (baseline; untouched by Phase D).

### LOC sanity (totals matter, individual wrappers may vary ±20 LOC)
- `wc -l mobile/hooks/useVoiceSession.ts mobile/hooks/useOnboardingVoiceSession.ts mobile/hooks/useAgentCreatorVoiceSession.ts` → sum ~285 LOC (down from 1,116).
- `wc -l mobile/hooks/usePracticeRecording.ts mobile/hooks/usePatternPracticeRecording.ts mobile/hooks/useDrillRecording.ts` → sum ~135 LOC (down from 720).
- `wc -l mobile/hooks/voice/useVoiceSessionCore.ts mobile/hooks/recording/useRecordAndSubmit.ts mobile/lib/rms.ts` → sum ~570 LOC of new code.
- Net: **~930 LOC deleted** (1,836 - 285 - 135 - 570 + allowance).

### Structural sanity
- `ls mobile/hooks/voice/useVoiceSessionCore.ts` → exists.
- `ls mobile/hooks/recording/useRecordAndSubmit.ts` → exists.
- `ls mobile/lib/rms.ts` → exists.
- All 6 wrapper hooks still at `mobile/hooks/<name>.ts` (call-site imports unchanged).

### Full smoke matrix (required before merge — run on device)

Phase D is the highest-risk phase so far. The full smoke matrix from audit §8 must pass:

1. Sign up → onboarding voice session → land on Home tab. (**D4**)
2. Home tab → voice session → speak → end → analysis screen renders verdict + pitch ribbon + corrections preview. (**D3**)
3. Home tab → tap a session row → session detail renders.
4. Practice tab → switch Corrections / Weak Spots / Fillers / Patterns modes.
5. Practice tab → start a weak-spot drill → pass/fail flow returns to list. (**D9**)
6. Practice tab → start a correction practice → record → result screen. (**D7**)
7. Practice tab → start a pattern exercise → complete → auto-promote next. (**D8**)
8. Filler Coach → session completes → results screen → session row in filler-coach-sessions. (**D3** alt path)
9. Profile → open agent → create agent (voice flow). (**D5**)

### Log sanity
- No `Cannot find module` in Metro.
- No `[voice-session] Deepgram error`, `[grammar-analyzer] Failed` under normal smoke.
- Server logs: `[conversation-handler]`, `[patterns-job]`, `[weak-spot-manager]` phases unchanged.

---

## Merge procedure

Same structure as Phases B + C:
1. All sub-step commits on `cleanup/phase-d-hook-consolidation`.
2. Full smoke matrix passes on device.
3. `git checkout main && git merge --ff-only cleanup/phase-d-hook-consolidation`.
4. Delete local branch: `git branch -d cleanup/phase-d-hook-consolidation`.
5. DO NOT push to origin unless the user explicitly asks.
6. Update `.planning/phases/codebase-cleanup/README.md`: flip Phase D row to SHIPPED + date + summary; mark Phase E as "next".
7. Commit the README update to main: `chore(cleanup): mark phase D shipped in master plan`.

---

## Rollback policy

- Each sub-step is its own commit. After D3/D4/D5/D7/D8/D9, if device smoke fails for that flow, `git reset --hard HEAD~1` back to the previous clean state.
- Partial rollback is fine. E.g., if D3 lands cleanly but D4 breaks onboarding, revert D4 only — D2/D3 remain.
- If D2 itself typechecks but D3 won't compile against the core, re-plan the core API (likely a missing escape hatch in `onMessage`) and re-commit D2 before proceeding.
- If mid-phase you discover the audit missed something (e.g., a 4th hook consumer), stop and extend the plan explicitly — do not silently expand scope.

---

## Out-of-scope reminders

- **Do NOT** move wrapper hooks into subdirs during Phase D. That's Phase F.
- **Do NOT** split session-manager.ts (N4) — deferred.
- **Do NOT** refactor `ExpoPlayAudioStream` setup into its own hook. Inline in both cores.
- **Do NOT** add barrel files in `hooks/voice/` or `hooks/recording/`.
- **Do NOT** push to origin without asking the user.
- **Do NOT** co-author commit messages ("Co-Authored-By" is banned per global CLAUDE.md).
- **Do NOT** start Phase E after finishing D. Phase E has its own plan file written when starting.
- **Do NOT** batch unrelated edits into the same commit. One step = one commit.
- **Do NOT** bypass the D1 review gate. Even if the design looks obvious, wait for user approval.

---

## What to hand back to the user when done

```
Phase D complete.
- Branch: cleanup/phase-d-hook-consolidation (merged to main, deleted)
- Commits: D2, D3, D4, D5, D6, D7, D8, D9 + README update (9 total)
- Files touched: 9 (6 hooks migrated → thin wrappers; 2 new base hooks + 1 new util)
- Net LOC: ~930 deleted
- Typecheck: mobile 7 / server 1 (both baseline)
- Smoke matrix: PASSED on device (user ran it — all 9 flows covered D3/D4/D5/D7/D8/D9)
- Ready for Phase E (server handler dedup).
```
