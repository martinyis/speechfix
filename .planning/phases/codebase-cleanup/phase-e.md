# Phase E — Server Handler Dedup (ConversationHandler onSessionEnd paths)

**Source audit**: `.planning/audits/codebase-audit-2026-04-20.md` (§3.3 N3 + §6 Phase E + §7 sequence)
**Depends on**: Phases A + B + C + D merged (all are — see `README.md`).
**Branch to create**: `cleanup/phase-e-handler-dedup`
**Expected impact**: 2 files touched in server (`voice/handlers/conversation-handler.ts` slimmed + 1 new helper file). ~120–160 LOC net removed. Zero behavior change.
**Expected effort**: 2–3 hours of focused coding after E1 approval.
**Review gate**: **E1 MUST be approved by user before E2 begins.** The audit's original proposal (one mega-`persistConversationSession` helper returning `{sessionId, correctionIds}`) does not cleanly fit both paths — the streaming path creates the DB session mid-analysis, before corrections are known. This plan proposes a **smaller set of focused helpers** instead. User must confirm the finer-grained shape before we write code.

---

## One-paragraph briefing (read this first if you have no prior context)

`ConversationHandler` in `server/src/voice/handlers/conversation-handler.ts` (438 LOC total) has two parallel session-end code paths: `onSessionEnd` (lines 74–221, ~148 LOC) and `onSessionEndStreaming` (lines 223–416, ~194 LOC). The session-manager prefers streaming (`session-manager.ts:916`); non-streaming runs only as an exception fallback (`session-manager.ts:982`). Both paths share the same tail: compute clarity score from corrections, insert corrections batch + get IDs back, insert filler words batch, fire `absorbCorrections` + `regenerateAllGreetings` + `runPatternAnalysisForUser` as background tasks, and append context notes to the user. The shared tail is **copy-pasted between the two methods** — when a bug is fixed in one, the other silently drifts. Phase E extracts that shared tail into focused helpers in a new `server/src/voice/handlers/session-persist.ts` module, then rewrites both methods to call them. No behavior change — the full analysis flow must return byte-identical DB rows and WebSocket payloads before and after. Only `ConversationHandler` is touched; `FillerCoachHandler`, `AgentCreatorHandler`, `OnboardingHandler`, `RoleplayHandler` are out of scope for this phase (RoleplayHandler inherits from ConversationHandler, so it benefits automatically).

---

## Preconditions (verify before starting)

Run these checks. If any fails, STOP and re-plan.

1. `git status` → clean working tree.
2. `git rev-parse --abbrev-ref HEAD` → should be `main`.
3. `git log --oneline -8 | grep "mark phase D shipped"` → should match (confirms Phase D is merged).
4. **Current-state verification**:
   - `wc -l server/src/voice/handlers/conversation-handler.ts` → **438** (±3 LOC ok — baseline is post-Phase-B with `score` alias removed).
   - `ls server/src/voice/handlers/session-persist.ts 2>/dev/null` → **must not exist** (E2 creates it).
   - `grep -n "onSessionEnd\b" server/src/voice/handlers/conversation-handler.ts` → line **74** (non-streaming entry).
   - `grep -n "onSessionEndStreaming\b" server/src/voice/handlers/conversation-handler.ts` → line **223** (streaming entry).
   - `grep -n "appendContextNotes" server/src/voice/handlers/conversation-handler.ts` → exported helper at line **423**, called from both session-end paths (to be left in place; E re-homes the call, not the export).
5. **Handler ownership confirmation** (confirms scope):
   - `grep -n "onSessionEndStreaming" server/src/voice/handlers/*.ts` → **only** `conversation-handler.ts` defines it. (FillerCoach, Onboarding, AgentCreator implement only the non-streaming signature.)
   - `grep -n "extends ConversationHandler" server/src/voice/handlers/*.ts` → `roleplay-handler.ts` inherits. Does **not** override `onSessionEnd*` methods. So it inherits any refactor automatically — **roleplay smoke MUST be in the test matrix**.
6. **Typecheck baseline**:
   - `cd mobile && npx tsc --noEmit 2>&1 | grep -c "error TS"` → **1** (post-Phase-D; untouched by Phase E).
   - `cd server && npx tsc --noEmit 2>&1 | grep -c "error TS"` → **1** (baseline pre-existing issue in `transcription.ts`; unrelated).

> If any of #4–#5 returns unexpected results, the file has drifted since planning. STOP and re-verify assumptions before continuing.

---

## Scope

**In scope:**
1. Create `server/src/voice/handlers/session-persist.ts` (new file, ~150 LOC) with 5 focused helpers for shared DB writes + side effects.
2. Refactor `ConversationHandler.onSessionEnd` in place to call the helpers (shrinks ~148 → ~60 LOC).
3. Refactor `ConversationHandler.onSessionEndStreaming` in place to call the helpers (shrinks ~194 → ~100 LOC).
4. Keep `appendContextNotes` export in `conversation-handler.ts` (used as an internal building block by one helper; the export itself is re-used intra-file).

**Out of scope** (DO NOT touch in this phase):
- **`FillerCoachHandler.onSessionEnd`.** It also calls `regenerateAllGreetings` + `runPatternAnalysisForUser`, but with a completely different DB table (`fillerCoachSessions`, not `sessions` + `corrections` + `fillerWords`), no clarity score, no weak-spot absorption, no context notes. Pulling it into the same helpers would produce worse abstractions than leaving it alone. Flagged for a later phase if we discover more overlap.
- **`OnboardingHandler.onSessionEnd` / `AgentCreatorHandler.onSessionEnd`.** They don't persist a session row, don't emit corrections, don't run pattern analysis — almost entirely different mechanics.
- **Deleting `onSessionEnd` in favor of always-streaming.** Audit offered this as option (a); this plan picks option (b) as the audit itself recommends ("Option (b) is safer"). Both entry points stay.
- **Moving `appendContextNotes` out of `conversation-handler.ts`.** It's a standalone exported helper already, and moving it into `session-persist.ts` mixes responsibilities (context notes live on `users`, not `sessions`). Leave where it is.
- **Changing the WebSocket emission order** or payload shapes. `session-manager.ts` still sees the same `SessionEndResult` on both paths.
- **Changing streaming-specific order-of-operations.** In particular, the streaming path creates the DB session *inside* the phased-insights callback (before corrections land). That timing is load-bearing for the `insights_ready` → "navigate to session detail" client UX. It must be preserved — the helper for DB-session insert is called from **inside** the streaming callback, not after.
- **Refactoring `runAnalysisPhased` or `runAnalysis`.** Those are analysis-layer APIs.
- **Adding retry/idempotency wrappers.** Behavior-neutral only.
- **session-manager.ts SRP split (N4).** Explicitly deferred per master plan.

---

## E1 — Design (THIS SECTION IS E1 — USER REVIEWS BEFORE E2 BEGINS)

### E1.1 — Why not the audit's `persistConversationSession(...)` shape

The audit proposed:
```ts
persistConversationSession({ userId, agentConfig, analysisResult, metadata, ... })
  → { sessionId, correctionIds }
```
This shape assumes **both** paths reach a point where they have `analysisResult` + `metadata` in hand, then insert the session + corrections + fillers together, then fire side effects. That's true for `onSessionEnd`. It is **not true** for `onSessionEndStreaming`:

- Streaming creates the DB session inside the phased-insights callback (line 273), using `deliveryScore ?? 100` as a provisional `clarityScore`, **before corrections are known**.
- The client is notified (`insights_ready`) with `dbSessionId` so the UI can navigate to the session-detail screen.
- Corrections then stream in via `onCorrection` callback.
- After `runAnalysisPhased` resolves, corrections are inserted in bulk, clarityScore is recomputed, and the analysis JSON + `clarityScore` column is updated.

A monolithic helper forces the streaming path to either (a) delay session creation (breaking the UX) or (b) call the helper twice with different payloads (awkward). Better: extract the five things the two paths *actually* share, leave the orchestration in the handler methods where the different sequencing stays legible.

### E1.2 — Proposed helper set (all exported from `session-persist.ts`)

```ts
// server/src/voice/handlers/session-persist.ts

import type { SpeechTimeline } from '../speech-types.js';
import type { ConversationMessage } from '../response-generator.js';
import type { AgentConfig } from './types.js';
import { db } from '../../db/index.js';
import { sessions, corrections as correctionsTable, fillerWords as fillerWordsTable } from '../../db/schema.js';
import { eq } from 'drizzle-orm';
import { regenerateAllGreetings } from '../../services/greeting-generator.js';
import { runPatternAnalysisForUser } from '../../jobs/patterns.js';
import { absorbCorrections } from '../../services/weak-spot-manager.js';
import { appendContextNotes } from './conversation-handler.js';

// --- H1 ---------------------------------------------------------------

/**
 * Early-exit for empty-transcript sessions.
 * Fires background greeting regen, returns a type-only SessionEndResult.
 * Caller decides the `type` field (conversation returns 'analysis',
 * filler-coach would return 'filler-practice' — currently only used by conversation).
 */
export function handleEmptyTranscript(userId: number): void {
  regenerateAllGreetings(userId).catch(err =>
    console.error('[greeting] Regeneration failed (empty transcript):', err)
  );
}

// --- H2 ---------------------------------------------------------------

/**
 * Compute clarity score = percentage of sentences with no corrections.
 * Pure function — no I/O.
 */
export function computeCorrectionClarityScore(
  correctionSentenceIndexes: number[],
  totalSentences: number,
): number {
  if (totalSentences === 0) return 100;
  const sentencesWithCorrections = new Set(correctionSentenceIndexes).size;
  return Math.round(
    (Math.max(0, totalSentences - sentencesWithCorrections) / totalSentences) * 100,
  );
}

// --- H3 ---------------------------------------------------------------

/**
 * Bulk-insert corrections, return DB IDs in insert order.
 * Returns [] if input is empty (no DB call).
 */
export async function insertCorrectionsBatch(
  sessionId: number,
  correctionsList: Array<{
    originalText: string;
    correctedText: string;
    explanation?: string | null;
    shortReason?: string | null;
    correctionType?: string | null;
    sentenceIndex: number;
    severity: number;
    contextSnippet?: string | null;
  }>,
): Promise<number[]> {
  if (correctionsList.length === 0) return [];
  const inserted = await db.insert(correctionsTable).values(
    correctionsList.map(c => ({
      sessionId,
      originalText: c.originalText,
      correctedText: c.correctedText,
      explanation: c.explanation || null,
      shortReason: c.shortReason || null,
      correctionType: c.correctionType || 'other',
      sentenceIndex: c.sentenceIndex,
      severity: c.severity,
      contextSnippet: c.contextSnippet || null,
    }))
  ).returning();
  return inserted.map(r => r.id);
}

// --- H4 ---------------------------------------------------------------

/**
 * Bulk-insert filler words. No return (IDs not needed downstream).
 * No-op if input is empty.
 */
export async function insertFillerWordsBatch(
  sessionId: number,
  fillerWordsList: Array<{ word: string; count: number }>,
): Promise<void> {
  if (fillerWordsList.length === 0) return;
  await db.insert(fillerWordsTable).values(
    fillerWordsList.map(f => ({
      sessionId,
      word: f.word,
      count: f.count,
    }))
  );
}

// --- H5 ---------------------------------------------------------------

/**
 * Post-analysis side effects, all fire-and-forget except context notes
 * (which awaits because it mutates the user row the rest of the request
 * will not touch again). Invocation is intentionally sequential for
 * context notes, parallel for the rest.
 *
 *  - Append context notes to the user row (awaits).
 *  - absorbCorrections into weak-spots (fire-and-forget, logs on failure).
 *  - regenerateAllGreetings (fire-and-forget).
 *  - runPatternAnalysisForUser (fire-and-forget).
 */
export async function runPostAnalysisSideEffects(params: {
  userId: number;
  agentConfig: AgentConfig | null;
  correctionIds: number[];
  userUtterances: string[];
  contextNotes: string[];
}): Promise<void> {
  const { userId, agentConfig, correctionIds, userUtterances, contextNotes } = params;

  if (contextNotes.length > 0) {
    await appendContextNotes(userId, contextNotes, agentConfig?.id ?? null);
  }

  if (correctionIds.length > 0) {
    absorbCorrections(userId, correctionIds, userUtterances).catch(err =>
      console.error('[conversation-handler] Failed to absorb corrections:', err)
    );
  }

  regenerateAllGreetings(userId).catch(err =>
    console.error('[greeting] Regeneration failed:', err)
  );
  runPatternAnalysisForUser(userId).catch(err =>
    console.error('[conversation-handler] Auto pattern analysis failed:', err)
  );
}
```

### E1.3 — Post-refactor shape of `onSessionEnd` (preview, for review)

```ts
async onSessionEnd(userId, agentConfig, transcriptBuffer, conversationHistory, durationSeconds, _formContext, speechTimeline) {
  const fullTranscription = transcriptBuffer.join(' ');
  if (!fullTranscription.trim()) {
    handleEmptyTranscript(userId);
    return { type: 'analysis' };
  }

  const userUtterances = transcriptBuffer;

  const [analysisResult, metadata, contextNotes] = await Promise.all([
    runAnalysis(userId, { sentences: userUtterances, mode: 'conversation', conversationHistory, speechTimeline }),
    generateSessionMetadata(fullTranscription, conversationHistory),
    extractConversationNotes(conversationHistory),
  ]);

  const clarityScore = computeCorrectionClarityScore(
    analysisResult.corrections.map(c => c.sentenceIndex),
    userUtterances.length,
  );

  const briefInsightsPromise = generateSessionBriefInsights({
    sentences: userUtterances,
    corrections: analysisResult.corrections,
    fillerWords: analysisResult.fillerWords,
    durationSeconds,
    existingInsights: analysisResult.sessionInsights,
  }).catch(err => {
    console.error('[conversation-handler] Brief insights failed:', err);
    return [];
  });

  const [session] = await db.insert(sessions).values({
    userId,
    agentId: agentConfig?.id ?? null,
    type: 'voice',
    status: 'completed',
    transcription: fullTranscription,
    durationSeconds,
    conversationTranscript: conversationHistory,
    title: metadata.title,
    description: metadata.description,
    topicCategory: metadata.topicCategory,
    clarityScore,
  }).returning();

  const briefInsights = await briefInsightsPromise;
  const allInsights = [...analysisResult.sessionInsights, ...briefInsights];

  await db.update(sessions).set({
    analysis: {
      sentences: userUtterances,
      fillerPositions: analysisResult.fillerPositions,
      sessionInsights: allInsights,
      conversationContext: conversationHistory,
      speechTimeline: speechTimeline ?? undefined,
    },
  }).where(eq(sessions.id, session.id));

  const correctionIds = await insertCorrectionsBatch(session.id, analysisResult.corrections);
  await insertFillerWordsBatch(session.id, analysisResult.fillerWords);

  console.log(`[conversation-handler] Session stored: ${session.id} — ${analysisResult.corrections.length} corrections, ${analysisResult.fillerWords.length} filler types`);

  await runPostAnalysisSideEffects({
    userId, agentConfig, correctionIds, userUtterances, contextNotes,
  });

  return {
    type: 'analysis',
    dbSessionId: session.id,
    clarityScore,
    analysisResults: {
      sentences: userUtterances,
      corrections: analysisResult.corrections,
      fillerWords: analysisResult.fillerWords,
      fillerPositions: analysisResult.fillerPositions,
      sessionInsights: allInsights,
    },
  };
}
```

### E1.4 — Post-refactor shape of `onSessionEndStreaming` (preview)

```ts
async onSessionEndStreaming(userId, agentConfig, transcriptBuffer, conversationHistory, durationSeconds, onCorrection, _formContext, onInsightsReady, speechTimeline) {
  const fullTranscription = transcriptBuffer.join(' ');
  if (!fullTranscription.trim()) {
    handleEmptyTranscript(userId);
    return { type: 'analysis' };
  }

  const userUtterances = transcriptBuffer;

  const metadataPromise = generateSessionMetadata(fullTranscription, conversationHistory);
  const contextNotesPromise = extractConversationNotes(conversationHistory);

  let dbSessionId = 0;
  let deliveryScore: number | null = null;
  let languageScore: number | null = null;
  let allInsights: any[] = [];
  let fillersPerMinute = 0;
  let totalWords = 0;

  const analysisResult = await runAnalysisPhased(
    userId,
    { sentences: userUtterances, mode: 'conversation', conversationHistory, speechTimeline },
    durationSeconds,
    async (phasedPayload) => {
      deliveryScore = phasedPayload.deliveryScore;
      allInsights = phasedPayload.insights;
      fillersPerMinute = phasedPayload.metrics.fillersPerMinute;
      totalWords = userUtterances.join(' ').split(/\s+/).filter(Boolean).length;

      const metadata = await metadataPromise;

      const [session] = await db.insert(sessions).values({
        userId,
        agentId: agentConfig?.id ?? null,
        type: 'voice',
        status: 'completed',
        transcription: fullTranscription,
        durationSeconds,
        conversationTranscript: conversationHistory,
        title: metadata.title,
        description: metadata.description,
        topicCategory: metadata.topicCategory,
        clarityScore: deliveryScore ?? 100,
      }).returning();
      dbSessionId = session.id;

      await insertFillerWordsBatch(dbSessionId, phasedPayload.fillerWords);

      await db.update(sessions).set({
        analysis: {
          sentences: userUtterances,
          fillerPositions: phasedPayload.fillerPositions,
          sessionInsights: allInsights,
          conversationContext: conversationHistory,
          speechTimeline: speechTimeline ?? undefined,
        },
      }).where(eq(sessions.id, dbSessionId));

      onInsightsReady?.(phasedPayload, dbSessionId);
    },
    onCorrection,
  );

  const clarityScore = computeCorrectionClarityScore(
    analysisResult.corrections.map(c => c.sentenceIndex),
    userUtterances.length,
  );

  let correctionIds: number[] = [];
  if (dbSessionId > 0) {
    correctionIds = await insertCorrectionsBatch(dbSessionId, analysisResult.corrections);
  }

  allInsights.push({ type: 'metric', description: 'Issues found', value: analysisResult.corrections.length });

  languageScore = computeLanguageScore(
    analysisResult.corrections, fillersPerMinute, undefined, durationSeconds, totalWords,
  );
  if (languageScore !== null) {
    allInsights.push({ type: 'language_score', description: 'Language score', value: languageScore });
  }

  if (dbSessionId > 0) {
    await db.update(sessions).set({
      analysis: {
        sentences: userUtterances,
        fillerPositions: analysisResult.fillerPositions,
        sessionInsights: allInsights,
        conversationContext: conversationHistory,
        speechTimeline: speechTimeline ?? undefined,
      },
      clarityScore,
    }).where(eq(sessions.id, dbSessionId));
  }

  console.log(`[conversation-handler] Phased: ${analysisResult.corrections.length} corrections, ${analysisResult.fillerWords.length} filler types`);

  const contextNotes = await contextNotesPromise;
  await runPostAnalysisSideEffects({
    userId, agentConfig, correctionIds, userUtterances, contextNotes,
  });

  return {
    type: 'analysis',
    dbSessionId,
    clarityScore,
    deliveryScore,
    languageScore,
    correctionIds,
    analysisResults: {
      sentences: userUtterances,
      corrections: analysisResult.corrections,
      fillerWords: analysisResult.fillerWords,
      fillerPositions: analysisResult.fillerPositions,
      sessionInsights: allInsights,
    },
  };
}
```

### E1.5 — Risks & gotchas

1. **Circular import between `session-persist.ts` and `conversation-handler.ts`.** `session-persist.ts` imports `appendContextNotes` from `conversation-handler.ts`; `conversation-handler.ts` imports helpers from `session-persist.ts`. TypeScript handles circular imports of non-hoisted functions fine, but **values initialized at module top-level** can be `undefined` on first access. `appendContextNotes` is a plain `async function` declaration (hoisted), so this is safe — but it's worth noting. If the circular import causes a runtime issue, the fallback is to move `appendContextNotes` into `session-persist.ts` itself (small follow-up edit, no semantics change).
2. **Log-message drift.** The original `onSessionEnd` path logs `[conversation-handler] Session stored in DB: <id>` then later `[conversation-handler] Analysis complete: N corrections, M fillers`. The refactor collapses these into one log line after DB insert. Reason: the two original lines existed because of the interleaved await on brief-insights. Post-refactor, both pieces of info are known at the same point, and a single line is clearer. **If the user wants the two-line log preserved for grep-ability, say so in E1 review — it's trivial to keep two lines**. Streaming path keeps its single `Phased: ...` log.
3. **`absorbCorrections` now runs from helper, not inline.** Same `.catch(err => console.error(...))` — identical fire-and-forget semantics. The only observable difference: stack traces on failure will bottom out in `session-persist.ts` instead of `conversation-handler.ts`. Acceptable.
4. **Order of side effects in H5.** Original code ran regen + pattern-analysis concurrently (both fire-and-forget); context notes awaited before them. Helper preserves that ordering. **Do not parallelize context notes with the fire-and-forget pair** — the user row mutation must commit before the fire-and-forget jobs read from it (`regenerateAllGreetings` reads `users.contextNotes` for personalization).
5. **RoleplayHandler inheritance.** Since `RoleplayHandler extends ConversationHandler` without overriding `onSessionEnd*`, the refactor flows through automatically. Roleplay smoke is mandatory in the post-phase matrix.
6. **`onInsightsReady` timing is load-bearing.** Client UX relies on `insights_ready` WS message arriving *before* the corrections stream in. The helper `insertFillerWordsBatch` + DB update inside the phased callback must complete before `onInsightsReady?.(...)` fires. The preview in E1.4 preserves this exact order — do not reorder.
7. **Helper parameter naming vs. call-site names.** Inside `onSessionEnd`, the local variable is `analysisResult.corrections` — a list of correction **objects**, each with `sentenceIndex`. The helper `computeCorrectionClarityScore` takes an array of **indexes** (to stay pure). Callers pass `analysisResult.corrections.map(c => c.sentenceIndex)`. This tiny bit of call-site noise is the price of keeping the helper schema-free. Confirmed acceptable.
8. **TypeScript `any` in streaming path.** The current code uses `any` for `phasedPayload`, `onCorrection(correction: any)`, and `allInsights: any[]`. The refactor does NOT tighten these types (out of scope — the audit flags this under N8 as a separate future refactor). Preserve the `any`s; don't drift.

### E1.6 — Known unknowns

- Whether any other caller (test, script, internal tool) imports `ConversationHandler` directly and uses internal state that we might be altering. Quick grep: `rg "from ['\"].*conversation-handler" server/` during E2 to confirm only `handlers/index.ts` + `roleplay-handler.ts` import from it.
- Whether the circular import actually resolves cleanly. If `tsc` complains or runtime throws `Cannot access 'appendContextNotes' before initialization`, fallback is to move `appendContextNotes` into `session-persist.ts`. Handle during E2 build if it happens.
- Whether `FillerCoachHandler` smoke regresses. It shouldn't — we don't touch it. But the fire-and-forget `regenerateAllGreetings` + `runPatternAnalysisForUser` calls inside `filler-coach-handler.ts` use the same `.catch(err => console.error(...))` pattern; a future follow-up could route them through H5 too. Not this phase.

**→ REVIEW GATE: user reads this section, asks questions, approves. Only then proceed to E2.**

---

## Execution (step-by-step, one commit each)

All sub-steps commit to `cleanup/phase-e-handler-dedup`. After E3 and E4 migrations, the author stops and asks the user to device-smoke the full voice-session → analysis-complete flow. **Do not proceed to the next sub-step until smoke confirms green.**

### E2 — Build `session-persist.ts` helpers (new file, no migrations yet)

Create `server/src/voice/handlers/session-persist.ts` matching the E1.2 signatures. Preserve exact SQL shapes / null coalescing / error handlers verbatim from `conversation-handler.ts`. Do not yet touch `conversation-handler.ts`.

**Verify**:
- `cd server && npx tsc --noEmit 2>&1 | grep -c "error TS"` → **1** (baseline — the new file must be strict-typed).
- `rg "from ['\"].*session-persist" server/` → shows only the new file referencing itself (no callers yet — that's E3/E4).
- `rg "from ['\"].*conversation-handler" server/src/voice/` → currently 1 hit in `roleplay-handler.ts` + 1 in `handlers/index.ts` (unchanged).

**Commit**: `chore(cleanup): E2 — add session-persist helpers for conversation handler`

### E3 — Migrate `onSessionEnd` to helpers

Rewrite the method body in `server/src/voice/handlers/conversation-handler.ts` to match the E1.3 preview exactly. Remove now-unused imports at the top of the file (`sessions`, `corrections`, `fillerWords`, `absorbCorrections`, `regenerateAllGreetings`, `runPatternAnalysisForUser` — verify each is still needed after both E3+E4, but since `onSessionEndStreaming` still inlines them pending E4, keep them for now and prune in E4 or a final E5 cleanup commit).

**Verify**:
- `cd server && npx tsc --noEmit 2>&1 | grep -c "error TS"` → **1**.
- `wc -l server/src/voice/handlers/conversation-handler.ts` → ~350 LOC (down from 438).
- **Device smoke** — the non-streaming path is used only as exception fallback, so normal voice sessions stay on streaming. To exercise the non-streaming path specifically:
  - Option 1 (preferred): temporarily throw inside `onSessionEndStreaming` in a scratch debug branch and run a voice session — observe fallback path picks up, session row appears, corrections render. Discard the debug change.
  - Option 2 (acceptable fallback): if inducing the exception is impractical on device, rely on typecheck + careful diff review + the full streaming smoke in E4 (which also confirms the helpers work), and note in the PR that the non-streaming path is covered by unit-level reasoning only.
- Either way, a normal streaming session must still work post-E3 (streaming code is unchanged until E4).

**Commit**: `chore(cleanup): E3 — migrate onSessionEnd to session-persist helpers`

### E4 — Migrate `onSessionEndStreaming` to helpers

Rewrite the method body in `server/src/voice/handlers/conversation-handler.ts` to match E1.4 exactly. After this edit, the only handler-local helpers left inline are `computeLanguageScore` (external, stays), `generateSessionMetadata` / `extractConversationNotes` / `generateSessionBriefInsights` (external, stays), and `runAnalysis` / `runAnalysisPhased` (external, stays).

Prune now-unused imports at the top of `conversation-handler.ts`: `corrections`, `fillerWords` (schema), `absorbCorrections`, `runPatternAnalysisForUser`. Keep `sessions` (still used for the DB insert inside the phased callback), `regenerateAllGreetings` (still used by handler — wait, is it? grep to confirm — H1 is the only consumer of regen-on-empty; regen-in-helper-H5 handles the populated case. So `conversation-handler.ts` no longer imports `regenerateAllGreetings` after E4. Prune it).

**Verify**:
- `cd server && npx tsc --noEmit 2>&1 | grep -c "error TS"` → **1**.
- `wc -l server/src/voice/handlers/conversation-handler.ts` → ~270 LOC (down from 438).
- `grep -c "regenerateAllGreetings\|absorbCorrections\|runPatternAnalysisForUser" server/src/voice/handlers/conversation-handler.ts` → **0** (all now reached via helpers).
- `grep -c "appendContextNotes" server/src/voice/handlers/conversation-handler.ts` → **≥1** (still exported from this file).
- **Device smoke** — full streaming path (all 3 roleplay / conversation variants):
  1. Home tab → normal Reflexa voice session → speak 3 sentences → end → session detail renders with verdict + corrections + pitch ribbon. Server logs show `[conversation-handler] Phased: N corrections, M filler types`.
  2. Home tab → custom agent (conversation mode) voice session → end → same expectations.
  3. Home tab → custom agent (roleplay mode) voice session → end → session row appears; session detail renders. **This proves RoleplayHandler's inherited path works**.
  4. Filler Coach → complete → results screen → session row. **Must be unchanged** (we didn't touch FillerCoachHandler; this is a regression guard).
  5. Open a past session → verdict renders. (Reads DB; unaffected.)
- Server log check: `[greeting] Regeneration`, `[weak-spot-manager]`, `[patterns-job]` logs still appear after session end (fire-and-forget still firing).
- Grep guard: `rg "Failed to absorb corrections|Regeneration failed|Auto pattern analysis failed" server/logs/` (if logs to disk) — no new error spikes vs pre-phase.

**Commit**: `chore(cleanup): E4 — migrate onSessionEndStreaming to session-persist helpers`

---

## Post-phase verification

### Typecheck parity
- `cd mobile && npx tsc --noEmit 2>&1 | grep -c "error TS"` → **1** (baseline, untouched).
- `cd server && npx tsc --noEmit 2>&1 | grep -c "error TS"` → **1** (baseline, unrelated to Phase E).

### LOC sanity
- `wc -l server/src/voice/handlers/conversation-handler.ts` → ~270 LOC (down from 438, delta ~−168).
- `wc -l server/src/voice/handlers/session-persist.ts` → ~150 LOC (new).
- **Net**: ~18 LOC removed (168 inline duplication gone, 150 consolidated). The win is de-duplication, not raw LOC — look at the diff: both handler methods lost their shared tail.

### Structural sanity
- `ls server/src/voice/handlers/session-persist.ts` → exists.
- `grep -c "export" server/src/voice/handlers/session-persist.ts` → **5** (H1–H5).
- No new files outside `server/src/voice/handlers/`.
- `rg "from ['\"].*conversation-handler['\"]" server/` → unchanged importers (`handlers/index.ts`, `roleplay-handler.ts`, `session-persist.ts`).

### Full smoke matrix (required before merge — run on device)

All flows from audit §8 + the two E-specific guards:

1. Sign up → onboarding voice session → land on Home tab. (Onboarding handler untouched.)
2. Home tab → **Reflexa voice session** → speak → end → analysis screen renders verdict + pitch ribbon + corrections preview. (**E3/E4 primary**)
3. Home tab → **custom agent (conversation)** voice session → end → same expectations. (**E3/E4 primary**)
4. Home tab → **custom agent (roleplay)** voice session → end → same expectations. (**E4 inheritance guard**)
5. Home tab → tap a session row → session detail renders. (Read path, unaffected.)
6. Practice tab → switch Corrections / Weak Spots / Fillers / Patterns modes.
7. Practice tab → start a weak-spot drill → pass/fail flow returns to list.
8. Practice tab → start a correction practice → record → result screen.
9. Practice tab → start a pattern exercise → complete → auto-promote next.
10. **Filler Coach → session completes → results screen → session row**. (**Regression guard — we didn't touch FillerCoachHandler**.)
11. Profile → open agent → create agent (voice flow). (AgentCreator handler untouched.)

### Log sanity
- Server logs show `[conversation-handler] Phased: ...` (or the non-streaming log if E3 fallback was exercised).
- `[greeting] Regeneration failed` should NOT appear under normal smoke.
- `[conversation-handler] Failed to absorb corrections` should NOT appear.
- `[conversation-handler] Auto pattern analysis failed` should NOT appear.
- Mobile Metro: no `Cannot find module`, no red box on session end.

### DB spot-check (optional but fast)
After smoke, inspect one freshly-landed session row in `psql`:
```sql
SELECT id, user_id, type, status, clarity_score,
       jsonb_array_length(analysis->'sessionInsights') AS n_insights,
       (SELECT count(*) FROM corrections WHERE session_id = s.id) AS n_corrections,
       (SELECT count(*) FROM filler_words WHERE session_id = s.id) AS n_fillers
FROM sessions s
ORDER BY id DESC LIMIT 1;
```
Compare to a session row from before Phase E (pre-E commit). Columns + counts must match pattern-for-pattern.

---

## Merge procedure

Same structure as Phases B + C + D:
1. All sub-step commits on `cleanup/phase-e-handler-dedup`.
2. Full smoke matrix passes on device.
3. `git checkout main && git merge --ff-only cleanup/phase-e-handler-dedup`.
4. Delete local branch: `git branch -d cleanup/phase-e-handler-dedup`.
5. DO NOT push to origin unless the user explicitly asks.
6. Update `.planning/phases/codebase-cleanup/README.md`: flip Phase E row to SHIPPED + date + summary; mark Phase F as "next".
7. Commit the README update to main: `chore(cleanup): mark phase E shipped in master plan`.

---

## Rollback policy

- Each sub-step is its own commit. After E3 or E4, if device smoke fails, `git reset --hard HEAD~1` back to the previous clean state.
- Partial rollback is fine. E.g., E2 (helpers) + E3 (onSessionEnd migrated) can land without E4 if E4 smoke fails — `onSessionEndStreaming` stays inlined until the next iteration.
- If the circular import between `session-persist.ts` and `conversation-handler.ts` misbehaves at runtime, move `appendContextNotes` from `conversation-handler.ts` into `session-persist.ts` (same file as H1–H5), and update the re-export in `conversation-handler.ts` if any external caller imports `appendContextNotes` (quick grep: `rg "appendContextNotes" server/` before deciding).
- If any smoke flow breaks post-E4 and the cause is not obvious within 10 minutes, revert to main and re-plan — do not patch forward blindly.

---

## Out-of-scope reminders

- **Do NOT** touch `FillerCoachHandler`, `OnboardingHandler`, `AgentCreatorHandler`, or `RoleplayHandler` (roleplay inherits; do not override).
- **Do NOT** change the order of `onInsightsReady` vs filler-words insert vs DB session update inside the phased callback. Client UX depends on it.
- **Do NOT** tighten `any` types in the streaming callback signatures — audit N8 is a separate future refactor.
- **Do NOT** collapse `onSessionEnd` into the streaming path (audit option (a)). This plan is deliberately option (b).
- **Do NOT** add retry or idempotency wrappers to the fire-and-forget side effects.
- **Do NOT** split `session-manager.ts` (N4) — explicitly deferred.
- **Do NOT** push to origin without asking the user.
- **Do NOT** co-author commit messages ("Co-Authored-By" is banned per global CLAUDE.md).
- **Do NOT** start Phase F after finishing E. Phase F has its own plan file written when starting.
- **Do NOT** bypass the E1 review gate. The helper shape diverges from the audit's proposal for good reason; the user needs to confirm.

---

## What to hand back to the user when done

```
Phase E complete.
- Branch: cleanup/phase-e-handler-dedup (merged to main, deleted)
- Commits: E2, E3, E4 + README update (4 total)
- Files touched: 2 (conversation-handler.ts slimmed, session-persist.ts new)
- Net LOC: ~-18 on disk (but ~168 LOC of duplicated logic de-duped — the real win)
- Typecheck: mobile 1 / server 1 (both baseline)
- Smoke matrix: PASSED on device (user ran 11 flows — full coverage incl. roleplay + filler-coach regression guard)
- Ready for Phase F (cosmetic component reorganization).
```
