import { FastifyInstance } from 'fastify';
import { db } from '../../db/index.js';
import { corrections, sessions, practiceAttempts, patternExercises, patternPracticeAttempts, speechPatterns } from '../../db/schema.js';
import { eq, sql, and, desc, inArray } from 'drizzle-orm';
import { runPatternAnalysisForUser, countPatternInSentences } from '../patterns/job.js';
import type { PatternType } from '../../analysis/types.js';
import { generateAndStorePatternExercises } from '../patterns/exercise-generator.js';
import { transcribeRawPCM } from '../../shared/transcription/index.js';
import {
  evaluateSayItRight,
  evaluatePatternExercise,
  evaluateReframeExercise,
  type CorrectionContext,
  type PatternExerciseContext,
  type ReframeExerciseContext,
} from './evaluator.js';
import { writeFile, unlink } from 'fs/promises';
import { randomUUID } from 'crypto';
import path from 'path';

/**
 * Mark the given active pattern as entered-watching after a completed L1+L2
 * drill. The pattern stays around; the behavior-driven graduation job is
 * what eventually flips it to `mastered` (see `processWatchingGraduation`).
 *
 * We DO NOT auto-promote the next queued pattern anymore — users pick the
 * next active manually via `POST /patterns/:id/activate` (swap). If there
 * is no active pattern after this call, the list endpoint will naturally
 * show an empty active slot and the swap UI surfaces the queue.
 *
 * Baseline frequency is captured into `data.baselineFrequency` at this
 * moment — it's what "clean" is measured against going forward.
 *
 * Called from two places:
 *  - POST /pattern-evaluate when the final L2 exercise passes (auto-finalize), so
 *    the DB never sits in an orphan state where all exercises are practiced but
 *    the pattern is still `active`.
 *  - POST /pattern-complete as a no-op-safe fallback for clients that still
 *    invoke the explicit completion endpoint.
 */
async function finalizeActivePattern(userId: number, patternId: number) {
  // Capture the detection-time frequency as baseline for "clean" sessions.
  const [current] = await db
    .select({
      data: speechPatterns.data,
      lastRegressedAt: speechPatterns.lastRegressedAt,
      completedAt: speechPatterns.completedAt,
      enteredWatchingAt: speechPatterns.enteredWatchingAt,
      masteredAt: speechPatterns.masteredAt,
      cleanSessionCount: speechPatterns.cleanSessionCount,
    })
    .from(speechPatterns)
    .where(eq(speechPatterns.id, patternId));

  // ------------------------------------------------------------------------
  // Compute drill-completion context flags for the SuccessScreen copy.
  //
  // `isFirstEverDrill` — true only if the user has never completed a drill
  // on ANY pattern before this one. We detect "completed a drill before"
  // by checking for any other pattern owned by this user whose lifecycle
  // has moved past `queued`/`active` (i.e. has completedAt, enteredWatchingAt,
  // or masteredAt set).
  //
  // `isRedrill` — true if THIS pattern was drilled before: lastRegressedAt
  // is set (came back after mastery), or any of its exercises has
  // practiceCount > 1 (re-run via /drill-again).
  // ------------------------------------------------------------------------
  const [priorCompletionsRow] = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(speechPatterns)
    .where(
      and(
        eq(speechPatterns.userId, userId),
        sql`${speechPatterns.id} <> ${patternId}`,
        sql`(${speechPatterns.completedAt} IS NOT NULL
             OR ${speechPatterns.enteredWatchingAt} IS NOT NULL
             OR ${speechPatterns.masteredAt} IS NOT NULL)`,
      ),
    );
  const isFirstEverDrill = (priorCompletionsRow?.count ?? 0) === 0;

  const [maxPracticeRow] = await db
    .select({ max: sql<number>`COALESCE(MAX(${patternExercises.practiceCount}), 0)::int` })
    .from(patternExercises)
    .where(
      and(
        eq(patternExercises.patternId, patternId),
        eq(patternExercises.userId, userId),
      ),
    );
  const isRedrill =
    current?.lastRegressedAt != null || (maxPracticeRow?.max ?? 0) > 1;

  const now = new Date();
  const currentData = (current?.data ?? {}) as Record<string, any>;
  const baselineFrequency = typeof currentData.baselineFrequency === 'number'
    ? currentData.baselineFrequency
    : (typeof currentData.frequency === 'number' ? currentData.frequency : 0);

  // ------------------------------------------------------------------------
  // Re-drill restoration path.
  //
  // /drill-again temporarily promotes a `watching` or `mastered` pattern to
  // `active` (storing the prior status under `data.preDrillStatus`) so the
  // normal drill loop can run. When finalize fires we detect that sentinel
  // and restore the ORIGINAL status + timestamps, leaving cleanSessionCount,
  // completedAt, enteredWatchingAt, and masteredAt untouched. This preserves
  // "watching progress" (e.g. 2/3 clean sessions) and mastery history across
  // voluntary re-drills.
  // ------------------------------------------------------------------------
  const preDrillStatus =
    typeof currentData.preDrillStatus === 'string' ? currentData.preDrillStatus : null;

  if (preDrillStatus === 'watching' || preDrillStatus === 'mastered') {
    const { preDrillStatus: _discard, ...dataWithoutSentinel } = currentData;
    await db
      .update(speechPatterns)
      .set({
        status: preDrillStatus,
        data: { ...dataWithoutSentinel, baselineFrequency } as any,
        updatedAt: now,
      })
      .where(eq(speechPatterns.id, patternId));

    return {
      active: null as { patternId: number } | null,
      promoted: false,
      isFirstEverDrill,
      isRedrill: true,
    };
  }

  const nextData = { ...currentData, baselineFrequency };

  await db
    .update(speechPatterns)
    .set({
      status: 'watching',
      completedAt: now,
      enteredWatchingAt: now,
      cleanSessionCount: 0,
      data: nextData as any,
      updatedAt: now,
    })
    .where(eq(speechPatterns.id, patternId));

  return {
    active: null as { patternId: number } | null,
    promoted: false,
    isFirstEverDrill,
    isRedrill,
  };
}

export async function practiceRoutes(fastify: FastifyInstance) {
  // GET /tasks — List all practice tasks for user
  fastify.get('/tasks', async (request, reply) => {
    const userId = request.user.userId;

    const rows = await db.execute(sql`
      SELECT
        c.id AS correction_id,
        c.session_id,
        c.original_text,
        c.corrected_text,
        c.explanation,
        c.short_reason,
        c.correction_type,
        c.severity,
        c.context_snippet,
        c.full_context,
        c.scenario,
        c.created_at,
        s.created_at AS session_date,
        BOOL_OR(pa.passed) AS practiced,
        MAX(pa.created_at) AS last_practiced_at,
        COUNT(pa.id)::int AS practice_count
      FROM corrections c
      JOIN sessions s ON s.id = c.session_id
      LEFT JOIN practice_attempts pa ON pa.correction_id = c.id
      WHERE s.user_id = ${userId}
      GROUP BY c.id, s.created_at
      ORDER BY c.created_at DESC
    `);

    const tasks = Array.from(rows).map((row: any) => ({
      correctionId: row.correction_id,
      sessionId: row.session_id,
      sessionDate: row.session_date,
      originalText: row.original_text,
      correctedText: row.corrected_text,
      explanation: row.explanation,
      shortReason: row.short_reason,
      correctionType: row.correction_type,
      severity: row.severity,
      contextSnippet: row.context_snippet || row.full_context,
      scenario: row.scenario ?? null,
      practiced: row.practiced ?? false,
      lastPracticedAt: row.last_practiced_at ?? null,
      practiceCount: row.practice_count ?? 0,
    }));

    return { tasks };
  });

  // POST /evaluate — Evaluate a practice attempt
  fastify.post('/evaluate', async (request, reply) => {
    const userId = request.user.userId;
    console.log('[Practice/evaluate] Request received from user:', userId);
    const data = await request.file();

    if (!data) {
      console.warn('[Practice/evaluate] No audio file in request');
      return reply.code(400).send({ error: 'No audio file provided' });
    }
    console.log('[Practice/evaluate] File received — fieldname:', data.fieldname, 'mimetype:', data.mimetype, 'fields:', Object.keys(data.fields || {}));

    // Extract form fields
    const correctionIdField = data.fields?.correctionId;
    const modeField = data.fields?.mode;

    const correctionId = Number(
      correctionIdField && 'value' in correctionIdField ? correctionIdField.value : null
    );
    const mode = String(
      modeField && 'value' in modeField ? modeField.value : ''
    );

    console.log('[Practice/evaluate] Parsed fields — correctionId:', correctionId, 'mode:', mode);

    if (!correctionId || mode !== 'say_it_right') {
      console.warn('[Practice/evaluate] Invalid fields — aborting');
      return reply.code(400).send({ error: 'correctionId and mode (say_it_right) are required' });
    }

    const tempPath = path.join('/tmp', `${randomUUID()}.pcm`);
    const buffer = await data.toBuffer();
    console.log(`[Practice/evaluate] Audio buffer size: ${buffer.length} bytes, writing to ${tempPath}`);
    await writeFile(tempPath, buffer);

    try {
      // Run correction lookup and transcription in parallel
      const [correctionRow, transcription] = await Promise.all([
        db
          .select({
            id: corrections.id,
            originalText: corrections.originalText,
            correctedText: corrections.correctedText,
            explanation: corrections.explanation,
            correctionType: corrections.correctionType,
          })
          .from(corrections)
          .innerJoin(sessions, eq(corrections.sessionId, sessions.id))
          .where(and(eq(corrections.id, correctionId), eq(sessions.userId, userId)))
          .then(rows => rows[0] ?? null),
        transcribeRawPCM(tempPath).then(result => {
          console.log('[Practice/evaluate] Transcription result:', JSON.stringify(result));
          return result;
        }),
      ]);

      const correction = correctionRow;
      if (!correction) {
        return reply.code(404).send({ error: 'Correction not found' });
      }

      if (!transcription.text) {
        console.warn('[Practice/evaluate] No speech detected');
        return reply.code(200).send({
          passed: false,
          transcript: '',
          feedback: 'No speech detected. Try again.',
          attemptId: null,
        });
      }

      const correctionCtx: CorrectionContext = {
        originalText: correction.originalText,
        correctedText: correction.correctedText,
        explanation: correction.explanation,
        correctionType: correction.correctionType,
      };

      // Evaluate
      const result = await evaluateSayItRight(correctionCtx, transcription.text);

      // Save practice attempt
      const [attempt] = await db
        .insert(practiceAttempts)
        .values({
          userId,
          correctionId,
          mode,
          passed: result.passed,
          transcript: transcription.text,
          feedback: result.feedback,
        })
        .returning({ id: practiceAttempts.id });

      return {
        passed: result.passed,
        transcript: transcription.text,
        feedback: result.feedback,
        attemptId: attempt.id,
      };
    } finally {
      await unlink(tempPath).catch(() => {});
    }
  });

  // POST /generate-patterns — Trigger pattern analysis + exercise generation
  fastify.post('/generate-patterns', async (request, reply) => {
    const userId = request.user.userId;
    console.log('[Practice/generate-patterns] Triggered for user:', userId);

    try {
      const { patternsFound, patternIds } = await runPatternAnalysisForUser(userId, {
        awaitExercises: true,
      });

      return { patternsFound, exercisesGenerated: patternIds.length > 0 };
    } catch (err) {
      console.error('[Practice/generate-patterns] Failed:', err);
      return reply.code(500).send({ error: 'Pattern generation failed' });
    }
  });

  // GET /pattern-tasks — Full patterns payload for the list screen.
  //
  // Design note: we embed the `sessionsHistory` (last 3 sessions per
  // watching row) inline here rather than exposing a separate
  // `/patterns/:id/watching-detail` endpoint. The list is bounded (at most
  // a handful of watching rows × 3 sessions each), fits easily in one
  // response, and avoids a second round-trip when the detail sheet opens.
  // If the list ever grows unbounded we can split it out; today, inline wins.
  fastify.get('/pattern-tasks', async (request, reply) => {
    const userId = request.user.userId;

    // Fetch active pattern with exercises
    const activeRows = await db.execute(sql`
      SELECT
        sp.id AS pattern_id,
        sp.type,
        sp.data->>'identifier' AS identifier,
        sp.data->>'severity' AS severity,
        sp.data->>'description' AS description,
        sp.is_returning,
        pe.id AS exercise_id,
        pe.original_sentence,
        pe.full_context,
        pe.target_word,
        pe.pattern_type,
        pe.alternatives,
        pe.highlight_phrases,
        pe.suggested_reframe,
        pe.practiced,
        pe.practice_count,
        pe.level,
        pe.order_index
      FROM speech_patterns sp
      LEFT JOIN pattern_exercises pe ON pe.pattern_id = sp.id AND pe.user_id = ${userId}
      WHERE sp.user_id = ${userId}
        AND sp.status = 'active'
      ORDER BY pe.level, pe.order_index
    `);

    let active: any = null;
    const activeRowsArr = Array.from(activeRows) as any[];
    if (activeRowsArr.length > 0) {
      const first = activeRowsArr[0];
      const exercises = activeRowsArr
        .filter((r: any) => r.exercise_id != null)
        .map((r: any) => ({
          id: r.exercise_id,
          originalSentence: r.original_sentence,
          fullContext: r.full_context ?? null,
          targetWord: r.target_word ?? null,
          patternType: r.pattern_type,
          alternatives: r.alternatives ?? [],
          highlightPhrases: r.highlight_phrases ?? null,
          suggestedReframe: r.suggested_reframe ?? null,
          practiced: r.practiced,
          practiceCount: r.practice_count,
          level: r.level ?? 1,
          orderIndex: r.order_index ?? 0,
        }));

      // Determine current level
      const l1Exercises = exercises.filter((e: any) => e.level === 1);
      const l1AllDone = l1Exercises.length > 0 && l1Exercises.every((e: any) => e.practiced);
      const currentLevel = l1AllDone ? 2 : 1;

      // Filter to current level only
      const currentExercises = exercises.filter((e: any) => e.level === currentLevel);
      const completed = currentExercises.filter((e: any) => e.practiced).length;

      active = {
        patternId: first.pattern_id,
        type: first.type,
        identifier: first.identifier,
        severity: first.severity,
        description: first.description,
        currentLevel,
        levelProgress: { completed, total: currentExercises.length },
        exercises: currentExercises,
        isReturning: first.is_returning ?? false,
      };
    }

    // Fetch watching patterns + their exercise-progress chip data.
    const watchingRowsRaw = await db.execute(sql`
      SELECT
        sp.id AS pattern_id,
        sp.type,
        sp.data->>'identifier' AS identifier,
        sp.data->>'severity' AS severity,
        sp.data->>'description' AS description,
        (sp.data->>'baselineFrequency')::int AS baseline_frequency,
        sp.is_returning,
        sp.clean_session_count,
        sp.entered_watching_at,
        sp.sessions_analyzed
      FROM speech_patterns sp
      WHERE sp.user_id = ${userId}
        AND sp.status = 'watching'
      ORDER BY sp.entered_watching_at DESC NULLS LAST, sp.id DESC
    `);
    const watchingRowsArr = Array.from(watchingRowsRaw) as any[];

    // Build sessionsHistory for each watching pattern. We walk sessions that
    // were created AFTER the pattern entered watching, up to the most
    // recent 3, and compute per-session occurrence counts locally (same
    // heuristic used by the graduation job).
    const watching: any[] = [];
    for (const row of watchingRowsArr) {
      const enteredAt: Date | null = row.entered_watching_at ?? null;
      let sessionsHistory: Array<{ sessionId: number; sessionDate: string; appearedCount: number; wasClean: boolean }> = [];

      if (enteredAt) {
        const recentSessions = await db
          .select({ id: sessions.id, createdAt: sessions.createdAt, analysis: sessions.analysis })
          .from(sessions)
          .where(
            and(
              eq(sessions.userId, userId),
              sql`${sessions.createdAt} >= ${enteredAt}`,
            ),
          )
          .orderBy(desc(sessions.createdAt))
          .limit(3);

        const baseline = row.baseline_frequency ?? 0;
        const cleanThreshold = Math.max(1, Math.floor(baseline * 0.5));

        sessionsHistory = recentSessions.map((s) => {
          const analysis = s.analysis as { sentences?: string[] } | null;
          const sents = Array.isArray(analysis?.sentences) ? analysis.sentences : [];
          const appearedCount = countPatternInSentences(row.type as PatternType, row.identifier, sents);
          const wasClean = baseline === 0 ? appearedCount === 0 : appearedCount < cleanThreshold;
          return {
            sessionId: s.id,
            sessionDate: s.createdAt.toISOString(),
            appearedCount,
            wasClean,
          };
        });
      }

      watching.push({
        patternId: row.pattern_id,
        type: row.type,
        identifier: row.identifier,
        severity: row.severity,
        description: row.description,
        isReturning: row.is_returning ?? false,
        cleanSessionCount: row.clean_session_count ?? 0,
        cleanSessionTarget: 3,
        baselineFrequency: row.baseline_frequency ?? 0,
        enteredWatchingAt: row.entered_watching_at?.toISOString?.() ?? null,
        sessionsHistory,
      });
    }

    // Fetch queued patterns (no exercises, just preview data). Sort returning
    // patterns first (queuePosition=-1), then by queue position.
    const queuedRows = await db.execute(sql`
      SELECT
        sp.id AS pattern_id,
        sp.type,
        sp.data->>'identifier' AS identifier,
        sp.data->>'severity' AS severity,
        sp.data->>'description' AS description,
        (sp.data->>'frequency')::int AS frequency,
        sp.data->'examples' AS example_sentences,
        sp.queue_position,
        sp.is_returning,
        sp.last_regressed_at
      FROM speech_patterns sp
      WHERE sp.user_id = ${userId}
        AND sp.status = 'queued'
      ORDER BY sp.queue_position NULLS LAST, sp.id
    `);

    const queuedAll = Array.from(queuedRows).map((row: any) => ({
      patternId: row.pattern_id,
      type: row.type,
      identifier: row.identifier,
      severity: row.severity,
      description: row.description,
      frequency: row.frequency ?? 0,
      exampleSentences: row.example_sentences ?? [],
      queuePosition: row.queue_position ?? 0,
      isReturning: row.is_returning ?? false,
      lastRegressedAt: row.last_regressed_at?.toISOString?.() ?? null,
      levelProgress: { completed: 0, total: 0 },
    }));

    // Augment each queued row with a levelProgress chip so the UI can show
    // "2/6" on patterns that were previously active (swap-friendly).
    if (queuedAll.length > 0) {
      const queuedIds = queuedAll.map((q) => q.patternId);
      const exerciseCounts = await db
        .select({
          patternId: patternExercises.patternId,
          level: patternExercises.level,
          practiced: patternExercises.practiced,
        })
        .from(patternExercises)
        .where(
          and(
            inArray(patternExercises.patternId, queuedIds),
            eq(patternExercises.userId, userId),
          ),
        );

      const byPattern = new Map<number, { l1Total: number; l1Done: number; l2Total: number; l2Done: number }>();
      for (const ex of exerciseCounts) {
        const entry = byPattern.get(ex.patternId) ?? { l1Total: 0, l1Done: 0, l2Total: 0, l2Done: 0 };
        if (ex.level === 1) {
          entry.l1Total++;
          if (ex.practiced) entry.l1Done++;
        } else {
          entry.l2Total++;
          if (ex.practiced) entry.l2Done++;
        }
        byPattern.set(ex.patternId, entry);
      }

      for (const q of queuedAll) {
        const e = byPattern.get(q.patternId);
        if (!e || (e.l1Total === 0 && e.l2Total === 0)) continue;
        // Show the chip for whichever level the user is actively working
        // (L1 if incomplete, else L2). If everything is done the pattern
        // should have been finalized long ago — harmless fallback to L2.
        if (e.l1Total > 0 && e.l1Done < e.l1Total) {
          q.levelProgress = { completed: e.l1Done, total: e.l1Total };
        } else if (e.l2Total > 0) {
          q.levelProgress = { completed: e.l2Done, total: e.l2Total };
        }
      }
    }

    const [masteredCountRow] = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(speechPatterns)
      .where(and(eq(speechPatterns.userId, userId), eq(speechPatterns.status, 'mastered')));
    const masteredCount = masteredCountRow?.count ?? 0;

    const returning = queuedAll.some((q) => q.isReturning);

    return {
      active,
      watching,
      queued: queuedAll,
      returning,
      masteredCount,
      queuedCount: queuedAll.length,
      watchingCount: watching.length,
    };
  });

  // POST /patterns/:id/activate — Swap the active pattern. If another
  // pattern is currently active, demote it to `queued` (preserving its
  // exercise progress, so the chip stays accurate).
  fastify.post<{ Params: { id: string } }>('/patterns/:id/activate', async (request, reply) => {
    const userId = request.user.userId;
    const targetId = Number(request.params.id);
    if (!Number.isFinite(targetId)) {
      return reply.code(400).send({ error: 'Invalid pattern id' });
    }

    // Ownership + status check
    const [target] = await db
      .select({
        id: speechPatterns.id,
        status: speechPatterns.status,
      })
      .from(speechPatterns)
      .where(and(eq(speechPatterns.id, targetId), eq(speechPatterns.userId, userId)));

    if (!target) return reply.code(404).send({ error: 'Pattern not found' });
    if (target.status === 'active') {
      return { active: { patternId: targetId }, demoted: null };
    }
    if (target.status !== 'queued') {
      // Activating is swap-only. Re-drilling a watching/mastered pattern
      // uses `/patterns/:id/drill-again` (status unchanged).
      return reply.code(400).send({
        error: `Cannot activate a pattern with status=${target.status}`,
      });
    }

    const now = new Date();

    // Demote any existing active pattern to queued, preserving everything
    // else (currentLevel + exercise.practiced remain untouched — the chip
    // just reads from them). Returning flag unchanged.
    //
    // Re-drill abandonment cleanup: if the currently-active pattern has a
    // `data.preDrillStatus` sentinel, the user started a re-drill and never
    // finished it. Instead of flipping it to `queued`, restore it to its
    // original pre-drill status (watching/mastered) and strip the sentinel.
    const [currentlyActive] = await db
      .select({ id: speechPatterns.id, data: speechPatterns.data })
      .from(speechPatterns)
      .where(and(eq(speechPatterns.userId, userId), eq(speechPatterns.status, 'active')));

    let demoted: { patternId: number } | null = null;
    if (currentlyActive) {
      const activeData = (currentlyActive.data ?? {}) as Record<string, any>;
      const preDrillStatus =
        typeof activeData.preDrillStatus === 'string' ? activeData.preDrillStatus : null;

      if (preDrillStatus === 'watching' || preDrillStatus === 'mastered') {
        const { preDrillStatus: _discard, ...dataWithoutSentinel } = activeData;
        await db
          .update(speechPatterns)
          .set({
            status: preDrillStatus,
            queuePosition: null,
            data: dataWithoutSentinel as any,
            updatedAt: now,
          })
          .where(eq(speechPatterns.id, currentlyActive.id));
        demoted = { patternId: currentlyActive.id };
      } else {
        // Put the demoted pattern at the head of the queue (queuePosition=0)
        // so the user can swap it back with one tap.
        await db
          .update(speechPatterns)
          .set({ status: 'queued', queuePosition: 0, updatedAt: now })
          .where(eq(speechPatterns.id, currentlyActive.id));
        demoted = { patternId: currentlyActive.id };
      }
    }

    await db
      .update(speechPatterns)
      .set({
        status: 'active',
        queuePosition: null,
        updatedAt: now,
      })
      .where(eq(speechPatterns.id, targetId));

    // Ensure the now-active pattern has L1 exercises. `generateAndStorePatternExercises`
    // is idempotent (it dedupes by originalSentence per level) so this is safe
    // whether the pattern is freshly queued, a swap-back, or a mastered re-drill.
    await generateAndStorePatternExercises([targetId], userId);

    return {
      active: { patternId: targetId },
      demoted,
    };
  });

  // POST /patterns/:id/dismiss — User long-pressed a queued pattern and said
  // "not actually a pattern". Hides from pattern-tasks going forward.
  fastify.post<{ Params: { id: string }; Body?: { reason?: string } }>(
    '/patterns/:id/dismiss',
    async (request, reply) => {
      const userId = request.user.userId;
      const patternId = Number(request.params.id);
      if (!Number.isFinite(patternId)) {
        return reply.code(400).send({ error: 'Invalid pattern id' });
      }

      const [row] = await db
        .select({ id: speechPatterns.id, data: speechPatterns.data })
        .from(speechPatterns)
        .where(and(eq(speechPatterns.id, patternId), eq(speechPatterns.userId, userId)));

      if (!row) return reply.code(404).send({ error: 'Pattern not found' });

      const now = new Date();
      const body = (request.body ?? {}) as { reason?: string };
      const reason = typeof body.reason === 'string' ? body.reason.slice(0, 200) : null;

      // Persist the optional reason into the data blob for future analytics
      // — not exposed in v1 UI.
      const currentData = (row.data ?? {}) as Record<string, any>;
      const nextData = reason ? { ...currentData, dismissReason: reason } : currentData;

      await db
        .update(speechPatterns)
        .set({
          status: 'dismissed',
          dismissedAt: now,
          queuePosition: null,
          data: nextData as any,
          updatedAt: now,
        })
        .where(eq(speechPatterns.id, patternId));

      return { ok: true, patternId };
    },
  );

  // POST /patterns/:id/drill-again — Let the user re-drill a `watching` or
  // `mastered` pattern. Ensures exercises exist, then TEMPORARILY promotes
  // the pattern to `active` so the standard drill loop (poll `/pattern-tasks`,
  // read `active.exercises`) works unchanged. The original status is stashed
  // in `data.preDrillStatus`; `finalizeActivePattern` reads that sentinel on
  // completion and restores the pattern to its pre-drill status (preserving
  // `completedAt`, `enteredWatchingAt`, `masteredAt`, and `cleanSessionCount`).
  //
  // Any already-active pattern is demoted to `queued` (same as `/activate`).
  // Abandonment cleanup: if the user never completes the re-drill, the row
  // just sits as `active` with `preDrillStatus` set. The next `/activate`
  // call (user picks a different pattern) demotes it — but instead of flipping
  // to `queued`, we restore it to its `preDrillStatus`. See `/activate` below.
  fastify.post<{ Params: { id: string } }>('/patterns/:id/drill-again', async (request, reply) => {
    const userId = request.user.userId;
    const patternId = Number(request.params.id);
    if (!Number.isFinite(patternId)) {
      return reply.code(400).send({ error: 'Invalid pattern id' });
    }

    const [pattern] = await db
      .select({
        id: speechPatterns.id,
        status: speechPatterns.status,
        data: speechPatterns.data,
      })
      .from(speechPatterns)
      .where(and(eq(speechPatterns.id, patternId), eq(speechPatterns.userId, userId)));

    if (!pattern) return reply.code(404).send({ error: 'Pattern not found' });
    if (
      pattern.status !== 'watching' &&
      pattern.status !== 'mastered' &&
      pattern.status !== 'active'
    ) {
      return reply
        .code(400)
        .send({ error: 'Drill-again only supported for watching, mastered, or already-active patterns' });
    }

    // Grab every exercise for the pattern. If there are any un-practiced
    // ones we surface those first. Otherwise reset the whole L1+L2 pool
    // back to `practiced=false` so the user can run it again; only if
    // the pattern has zero exercises at all do we generate fresh.
    const allExercises = await db
      .select({
        id: patternExercises.id,
        level: patternExercises.level,
        practiced: patternExercises.practiced,
      })
      .from(patternExercises)
      .where(
        and(
          eq(patternExercises.patternId, patternId),
          eq(patternExercises.userId, userId),
        ),
      );

    let regenerated = false;
    let reused = false;

    if (allExercises.length === 0) {
      await generateAndStorePatternExercises([patternId], userId, 1);
      regenerated = true;
    } else {
      const unused = allExercises.filter((e) => !e.practiced);
      if (unused.length > 0) {
        reused = true;
      } else {
        // Every exercise is practiced — reuse the pool by resetting practiced.
        await db
          .update(patternExercises)
          .set({ practiced: false, practiceCount: 0 })
          .where(
            and(
              eq(patternExercises.patternId, patternId),
              eq(patternExercises.userId, userId),
            ),
          );
        reused = true;
      }
    }

    // Promote to active (only if not already active). Demote any other
    // active pattern to queued the same way `/activate` does.
    let demoted: { patternId: number } | null = null;
    if (pattern.status !== 'active') {
      const now = new Date();
      const [currentlyActive] = await db
        .select({ id: speechPatterns.id })
        .from(speechPatterns)
        .where(
          and(
            eq(speechPatterns.userId, userId),
            eq(speechPatterns.status, 'active'),
            sql`${speechPatterns.id} <> ${patternId}`,
          ),
        );

      if (currentlyActive) {
        await db
          .update(speechPatterns)
          .set({ status: 'queued', queuePosition: 0, updatedAt: now })
          .where(eq(speechPatterns.id, currentlyActive.id));
        demoted = { patternId: currentlyActive.id };
      }

      const existingData = (pattern.data ?? {}) as Record<string, any>;
      const nextData = { ...existingData, preDrillStatus: pattern.status };

      await db
        .update(speechPatterns)
        .set({
          status: 'active',
          queuePosition: null,
          data: nextData as any,
          updatedAt: now,
        })
        .where(eq(speechPatterns.id, patternId));
    }

    return {
      patternId,
      regenerated,
      reused,
      active: { patternId },
      demoted,
    };
  });

  // GET /patterns/mastered — dedicated list for the Mastered Patterns screen.
  fastify.get('/patterns/mastered', async (request) => {
    const userId = request.user.userId;

    const rows = await db
      .select({
        id: speechPatterns.id,
        type: speechPatterns.type,
        identifier: speechPatterns.identifier,
        data: speechPatterns.data,
        masteredAt: speechPatterns.masteredAt,
        isReturning: speechPatterns.isReturning,
        lastRegressedAt: speechPatterns.lastRegressedAt,
        createdAt: speechPatterns.createdAt,
        completedAt: speechPatterns.completedAt,
        enteredWatchingAt: speechPatterns.enteredWatchingAt,
      })
      .from(speechPatterns)
      .where(and(eq(speechPatterns.userId, userId), eq(speechPatterns.status, 'mastered')))
      .orderBy(desc(speechPatterns.masteredAt));

    const patterns = rows.map((r) => {
      const data = (r.data ?? {}) as Record<string, any>;
      const priorMasterings = Array.isArray(data.priorMasterings) ? data.priorMasterings : [];
      // Note: we don't currently store a separate "original" description —
      // `data.description` is the only source. Both fields resolve to the
      // same value today; kept split in the response so the client can
      // evolve without another migration when analyzer emits an original
      // form later.
      const description = typeof data.description === 'string' ? data.description : null;
      return {
        patternId: r.id,
        type: r.type,
        identifier: r.identifier,
        description,
        originalDescription: description,
        masteredAt: r.masteredAt?.toISOString?.() ?? null,
        wasReturning: priorMasterings.length > 0 || r.isReturning === true,
        lastRegressedAt: r.lastRegressedAt?.toISOString?.() ?? null,
        createdAt: r.createdAt?.toISOString?.() ?? null,
        completedAt: r.completedAt?.toISOString?.() ?? null,
        enteredWatchingAt: r.enteredWatchingAt?.toISOString?.() ?? null,
        priorMasteringsCount: priorMasterings.length,
      };
    });

    return { patterns };
  });

  // POST /pattern-complete — Idempotent fallback. Normally auto-finalize in
  // /pattern-evaluate has already promoted the next pattern, so this endpoint
  // will either find no active pattern or find the newly-promoted one (with
  // fresh unpracticed exercises) and return a no-op.
  fastify.post('/pattern-complete', async (request, reply) => {
    const userId = request.user.userId;

    const [activePattern] = await db
      .select({ id: speechPatterns.id })
      .from(speechPatterns)
      .where(and(eq(speechPatterns.userId, userId), eq(speechPatterns.status, 'active')));

    if (!activePattern) {
      return { active: null, promoted: false, isFirstEverDrill: false, isRedrill: false };
    }

    // Guard: only finalize if the active pattern truly has every exercise practiced.
    // Prevents accidentally finalizing a freshly-promoted pattern whose L1 exercises
    // haven't been touched yet.
    const exercises = await db
      .select({ practiced: patternExercises.practiced })
      .from(patternExercises)
      .where(
        and(
          eq(patternExercises.patternId, activePattern.id),
          eq(patternExercises.userId, userId),
        ),
      );

    if (exercises.length === 0 || !exercises.every((e) => e.practiced)) {
      return {
        active: { patternId: activePattern.id },
        promoted: false,
        isFirstEverDrill: false,
        isRedrill: false,
      };
    }

    return finalizeActivePattern(userId, activePattern.id);
  });

  // POST /pattern-evaluate — Evaluate a pattern practice attempt
  fastify.post('/pattern-evaluate', async (request, reply) => {
    const userId = request.user.userId;
    console.log('[Practice/pattern-evaluate] Request received from user:', userId);
    const data = await request.file();

    if (!data) {
      return reply.code(400).send({ error: 'No audio file provided' });
    }

    const exerciseIdField = data.fields?.exerciseId;
    const exerciseId = Number(
      exerciseIdField && 'value' in exerciseIdField ? exerciseIdField.value : null
    );

    if (!exerciseId) {
      return reply.code(400).send({ error: 'exerciseId is required' });
    }

    const tempPath = path.join('/tmp', `${randomUUID()}.pcm`);
    const buffer = await data.toBuffer();
    await writeFile(tempPath, buffer);

    try {
      // Run exercise lookup and transcription in parallel
      const [exerciseRow, transcription] = await Promise.all([
        db
          .select({
            id: patternExercises.id,
            originalSentence: patternExercises.originalSentence,
            targetWord: patternExercises.targetWord,
            patternType: patternExercises.patternType,
            alternatives: patternExercises.alternatives,
            highlightPhrases: patternExercises.highlightPhrases,
            practiceCount: patternExercises.practiceCount,
          })
          .from(patternExercises)
          .where(and(eq(patternExercises.id, exerciseId), eq(patternExercises.userId, userId)))
          .then(rows => rows[0] ?? null),
        transcribeRawPCM(tempPath).then(result => {
          console.log('[Practice/pattern-evaluate] Transcription result:', JSON.stringify(result));
          return result;
        }),
      ]);

      if (!exerciseRow) {
        return reply.code(404).send({ error: 'Exercise not found' });
      }

      if (!transcription.text) {
        return reply.code(200).send({
          passed: false,
          transcript: '',
          feedback: 'No speech detected. Try again.',
          attemptId: null,
        });
      }

      const REFRAME_TYPES = ['hedging', 'negative_framing'];
      const isReframe = REFRAME_TYPES.includes(exerciseRow.patternType);

      let result;
      if (isReframe) {
        const reframeCtx: ReframeExerciseContext = {
          originalSentence: exerciseRow.originalSentence,
          patternType: exerciseRow.patternType,
          highlightPhrases: (exerciseRow.highlightPhrases as string[]) ?? [],
        };
        result = await evaluateReframeExercise(reframeCtx, transcription.text);
      } else {
        const exerciseCtx: PatternExerciseContext = {
          originalSentence: exerciseRow.originalSentence,
          targetWord: exerciseRow.targetWord!,
          patternType: exerciseRow.patternType,
          alternatives: exerciseRow.alternatives as string[],
        };
        result = await evaluatePatternExercise(exerciseCtx, transcription.text);
      }

      // Save attempt
      const [attempt] = await db
        .insert(patternPracticeAttempts)
        .values({
          userId,
          exerciseId,
          passed: result.passed,
          transcript: transcription.text,
          feedback: result.feedback,
        })
        .returning({ id: patternPracticeAttempts.id });

      // Update exercise
      const newPracticeCount = exerciseRow.practiceCount + 1;
      const updateData: Record<string, any> = {
        practiceCount: newPracticeCount,
        lastPracticedAt: new Date(),
      };

      if (result.passed) {
        updateData.practiced = true;
      }

      await db
        .update(patternExercises)
        .set(updateData)
        .where(eq(patternExercises.id, exerciseId));

      // Check if all exercises at the current level are now practiced
      const responseExtra: Record<string, any> = {};
      if (result.passed) {
        // Get the exercise's level and pattern
        const [exerciseMeta] = await db
          .select({ level: patternExercises.level, patternId: patternExercises.patternId })
          .from(patternExercises)
          .where(eq(patternExercises.id, exerciseId));

        if (exerciseMeta) {
          const levelExercises = await db
            .select({ practiced: patternExercises.practiced })
            .from(patternExercises)
            .where(
              and(
                eq(patternExercises.patternId, exerciseMeta.patternId),
                eq(patternExercises.userId, userId),
                eq(patternExercises.level, exerciseMeta.level),
              ),
            );

          const allDone = levelExercises.every((e) => e.practiced);
          if (allDone) {
            if (exerciseMeta.level === 1) {
              // Generate Level 2 exercises
              await generateAndStorePatternExercises([exerciseMeta.patternId], userId, 2);
              responseExtra.levelCompleted = 1;
            } else {
              // L2 all done — auto-finalize so the DB never sits in an orphan state
              // (pattern still `active` with every exercise `practiced`). This is
              // what leaves the Practice tab stuck on a 4/4 pattern whose
              // "Continue Practicing" button hangs on an empty queue.
              try {
                const finalized = await finalizeActivePattern(
                  userId,
                  exerciseMeta.patternId,
                );
                responseExtra.isFirstEverDrill = finalized.isFirstEverDrill;
                responseExtra.isRedrill = finalized.isRedrill;
              } catch (err) {
                console.error('[Practice/pattern-evaluate] Auto-finalize failed:', err);
              }
              responseExtra.patternCompleted = true;
            }
          }
        }
      }

      return {
        passed: result.passed,
        transcript: transcription.text,
        feedback: result.feedback,
        attemptId: attempt.id,
        ...responseExtra,
      };
    } finally {
      await unlink(tempPath).catch(() => {});
    }
  });
}
