import { FastifyInstance } from 'fastify';
import { db } from '../db/index.js';
import { corrections, sessions, practiceAttempts, patternExercises, patternPracticeAttempts, speechPatterns } from '../db/schema.js';
import { eq, sql, and } from 'drizzle-orm';
import { runPatternAnalysisForUser, checkReanalysisNeeded } from '../jobs/patterns.js';
import { generateAndStorePatternExercises } from '../services/pattern-exercise-generator.js';
import { transcribeRawPCM } from '../services/transcription.js';
import {
  evaluateSayItRight,
  evaluatePatternExercise,
  evaluateReframeExercise,
  type CorrectionContext,
  type PatternExerciseContext,
  type ReframeExerciseContext,
} from '../services/practice-evaluator.js';
import { writeFile, unlink } from 'fs/promises';
import { randomUUID } from 'crypto';
import path from 'path';

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
        c.correction_type,
        c.severity,
        c.context_snippet,
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
      correctionType: row.correction_type,
      severity: row.severity,
      contextSnippet: row.context_snippet,
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

  // GET /pattern-tasks — List active + queued patterns for user
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

    // Fetch queued patterns (no exercises, just preview data)
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
        sp.is_returning
      FROM speech_patterns sp
      WHERE sp.user_id = ${userId}
        AND sp.status = 'queued'
      ORDER BY sp.queue_position NULLS LAST, sp.id
    `);

    const queued = Array.from(queuedRows).map((row: any) => ({
      patternId: row.pattern_id,
      type: row.type,
      identifier: row.identifier,
      severity: row.severity,
      description: row.description,
      frequency: row.frequency ?? 0,
      exampleSentences: row.example_sentences ?? [],
      queuePosition: row.queue_position ?? 0,
      isReturning: row.is_returning ?? false,
    }));

    return { active, queued };
  });

  // POST /pattern-complete — Mark active pattern as practiced, promote next
  fastify.post('/pattern-complete', async (request, reply) => {
    const userId = request.user.userId;

    // Find active pattern
    const [activePattern] = await db
      .select({ id: speechPatterns.id })
      .from(speechPatterns)
      .where(and(eq(speechPatterns.userId, userId), eq(speechPatterns.status, 'active')));

    if (!activePattern) {
      return reply.code(404).send({ error: 'No active pattern found' });
    }

    // Mark as practiced
    await db
      .update(speechPatterns)
      .set({ status: 'practiced', completedAt: new Date() })
      .where(eq(speechPatterns.id, activePattern.id));

    // Promote next queued pattern (lowest queue_position)
    const [nextPattern] = await db
      .select({ id: speechPatterns.id })
      .from(speechPatterns)
      .where(and(eq(speechPatterns.userId, userId), eq(speechPatterns.status, 'queued')))
      .orderBy(sql`${speechPatterns.queuePosition} NULLS LAST, ${speechPatterns.id}`)
      .limit(1);

    if (!nextPattern) {
      // Queue empty — check if re-analysis is needed
      const needsReanalysis = await checkReanalysisNeeded(userId);
      if (needsReanalysis) {
        runPatternAnalysisForUser(userId).catch(err =>
          console.error('[pattern-complete] Re-analysis failed:', err)
        );
      }
      return { active: null, promoted: false };
    }

    // Promote to active
    await db
      .update(speechPatterns)
      .set({ status: 'active', queuePosition: null })
      .where(eq(speechPatterns.id, nextPattern.id));

    // Generate Level 1 exercises for the newly active pattern
    await generateAndStorePatternExercises([nextPattern.id], userId);

    return { active: { patternId: nextPattern.id }, promoted: true };
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
