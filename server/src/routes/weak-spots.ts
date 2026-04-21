import { FastifyInstance } from 'fastify';
import { db } from '../db/index.js';
import {
  corrections,
  sessions,
  weakSpots,
  weakSpotCorrections,
  weakSpotExercises,
  weakSpotDrillAttempts,
  practiceAttempts,
} from '../db/schema.js';
import { eq, and, sql, isNull } from 'drizzle-orm';
import { transcribeRawPCM } from '../shared/transcription/index.js';
import {
  evaluateSayItRight,
  evaluateWeakSpotExercise,
  type CorrectionContext,
  type WeakSpotExerciseContext,
} from '../services/practice-evaluator.js';
import {
  advanceSRS,
  dismissWeakSpot,
  dismissQuickFix,
  backfillWeakSpots,
} from '../services/weak-spot-manager.js';
import { writeFile, unlink } from 'fs/promises';
import { randomUUID } from 'crypto';
import path from 'path';

export async function weakSpotRoutes(fastify: FastifyInstance) {
  // GET /practice/weak-spots — Returns active spots, backlog, and quick fixes
  fastify.get('/weak-spots', async (request, reply) => {
    const userId = request.user.userId;

    // Backfill: if user has zero weak spots (any status), run one-time backfill
    const [existingCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(weakSpots)
      .where(eq(weakSpots.userId, userId));

    if (Number(existingCount.count) === 0) {
      await backfillWeakSpots(userId);
    }

    // 1. Active weak spots with corrections and exercises
    const activeRows = await db
      .select()
      .from(weakSpots)
      .where(and(eq(weakSpots.userId, userId), eq(weakSpots.status, 'active')));

    const activeSpots = await Promise.all(
      activeRows.map(async (spot) => {
        const [spotCorrections, exerciseRows, passedAttempts] = await Promise.all([
          db
            .select({
              id: corrections.id,
              originalText: corrections.originalText,
              correctedText: corrections.correctedText,
              explanation: corrections.explanation,
              shortReason: corrections.shortReason,
              correctionType: corrections.correctionType,
              severity: corrections.severity,
              fullContext: sql<string>`COALESCE(${corrections.contextSnippet}, ${corrections.fullContext})`.as('full_context'),
              sentenceIndex: corrections.sentenceIndex,
              sessionId: corrections.sessionId,
              createdAt: corrections.createdAt,
              practiced: sql<boolean>`EXISTS (
                SELECT 1 FROM weak_spot_drill_attempts wda
                WHERE wda.correction_id = ${corrections.id}
                  AND wda.weak_spot_id = ${spot.id}
                  AND wda.passed = true
              )`.as('practiced'),
            })
            .from(weakSpotCorrections)
            .innerJoin(corrections, eq(weakSpotCorrections.correctionId, corrections.id))
            .where(eq(weakSpotCorrections.weakSpotId, spot.id)),
          db
            .select({
              id: weakSpotExercises.id,
              originalText: weakSpotExercises.originalText,
              correctedText: weakSpotExercises.correctedText,
              explanation: weakSpotExercises.explanation,
              orderIndex: weakSpotExercises.orderIndex,
            })
            .from(weakSpotExercises)
            .where(eq(weakSpotExercises.weakSpotId, spot.id))
            .orderBy(weakSpotExercises.orderIndex),
          // Fetch IDs of exercises with at least one passed attempt
          db
            .select({ exerciseId: weakSpotDrillAttempts.exerciseId })
            .from(weakSpotDrillAttempts)
            .where(
              and(
                eq(weakSpotDrillAttempts.weakSpotId, spot.id),
                eq(weakSpotDrillAttempts.passed, true),
                sql`${weakSpotDrillAttempts.exerciseId} IS NOT NULL`,
              ),
            ),
        ]);

        const passedExerciseIds = new Set(passedAttempts.map((a) => a.exerciseId));
        const exercises = exerciseRows.map((e) => ({
          ...e,
          correctionType: spot.correctionType,
          severity: spot.severity,
          practiced: passedExerciseIds.has(e.id),
        }));

        const now = new Date();
        const isDue = spot.nextReviewAt === null || spot.nextReviewAt <= now;

        return {
          ...spot,
          corrections: spotCorrections,
          exercises,
          isDue,
        };
      }),
    );

    // 2. Backlog summary
    const backlogRows = await db
      .select({
        id: weakSpots.id,
        correctionType: weakSpots.correctionType,
        severity: weakSpots.severity,
        isRecurring: weakSpots.isRecurring,
        createdAt: weakSpots.createdAt,
      })
      .from(weakSpots)
      .where(and(eq(weakSpots.userId, userId), eq(weakSpots.status, 'backlog')));

    const backlog = await Promise.all(
      backlogRows.map(async (spot) => {
        const [countResult] = await db
          .select({ count: sql<number>`count(*)` })
          .from(weakSpotCorrections)
          .where(eq(weakSpotCorrections.weakSpotId, spot.id));

        return {
          ...spot,
          correctionCount: Number(countResult?.count ?? 0),
        };
      }),
    );

    // 3. Quick fixes: corrections NOT in any weak spot, not dismissed,
    //    and not already passed. Quick fixes are one-shot — once the user
    //    says it right, it drops off the list for good.
    const quickFixRows = await db.execute(sql`
      SELECT
        c.id,
        c.original_text,
        c.corrected_text,
        c.explanation,
        c.short_reason,
        c.correction_type,
        c.severity,
        c.context_snippet,
        c.full_context,
        c.sentence_index,
        c.session_id,
        c.created_at
      FROM corrections c
      JOIN sessions s ON s.id = c.session_id
      LEFT JOIN weak_spot_corrections wsc ON c.id = wsc.correction_id
      WHERE s.user_id = ${userId}
        AND wsc.id IS NULL
        AND (c.dismissed IS NOT TRUE)
        AND NOT EXISTS (
          SELECT 1 FROM practice_attempts pa
          WHERE pa.correction_id = c.id AND pa.passed = true
        )
      ORDER BY c.created_at DESC
    `);

    const quickFixes = Array.from(quickFixRows).map((row: any) => ({
      id: row.id,
      originalText: row.original_text,
      correctedText: row.corrected_text,
      explanation: row.explanation,
      shortReason: row.short_reason,
      correctionType: row.correction_type,
      severity: row.severity,
      fullContext: row.context_snippet || row.full_context,
      sentenceIndex: row.sentence_index,
      sessionId: row.session_id,
      createdAt: row.created_at,
      practiced: false,
    }));

    return { activeSpots, backlog, quickFixes };
  });

  // POST /practice/weak-spot-evaluate — Evaluate a weak spot drill item
  fastify.post('/weak-spot-evaluate', async (request, reply) => {
    const userId = request.user.userId;
    const data = await request.file();

    if (!data) {
      return reply.code(400).send({ error: 'No audio file provided' });
    }

    const weakSpotIdField = data.fields?.weakSpotId;
    const itemTypeField = data.fields?.itemType;
    const itemIdField = data.fields?.itemId;

    const weakSpotId = Number(
      weakSpotIdField && 'value' in weakSpotIdField ? weakSpotIdField.value : null,
    );
    const itemType = String(
      itemTypeField && 'value' in itemTypeField ? itemTypeField.value : '',
    );
    const itemId = Number(
      itemIdField && 'value' in itemIdField ? itemIdField.value : null,
    );

    if (!weakSpotId || !itemType || !itemId || !['correction', 'exercise'].includes(itemType)) {
      return reply.code(400).send({ error: 'weakSpotId, itemType (correction|exercise), and itemId are required' });
    }

    const tempPath = path.join('/tmp', `${randomUUID()}.pcm`);
    const buffer = await data.toBuffer();
    await writeFile(tempPath, buffer);

    try {
      // Transcribe
      const transcription = await transcribeRawPCM(tempPath);

      if (!transcription.text) {
        return reply.code(200).send({
          passed: false,
          transcript: '',
          feedback: 'No speech detected. Try again.',
          attemptId: null,
        });
      }

      let result: { passed: boolean; feedback: string };

      if (itemType === 'correction') {
        // Look up the correction
        const [correction] = await db
          .select({
            originalText: corrections.originalText,
            correctedText: corrections.correctedText,
            explanation: corrections.explanation,
            correctionType: corrections.correctionType,
          })
          .from(corrections)
          .innerJoin(sessions, eq(corrections.sessionId, sessions.id))
          .where(and(eq(corrections.id, itemId), eq(sessions.userId, userId)));

        if (!correction) {
          return reply.code(404).send({ error: 'Correction not found' });
        }

        const ctx: CorrectionContext = {
          originalText: correction.originalText,
          correctedText: correction.correctedText,
          explanation: correction.explanation,
          correctionType: correction.correctionType,
        };
        result = await evaluateSayItRight(ctx, transcription.text);
      } else {
        // Look up the exercise
        const [exercise] = await db
          .select({
            originalText: weakSpotExercises.originalText,
            correctedText: weakSpotExercises.correctedText,
            explanation: weakSpotExercises.explanation,
          })
          .from(weakSpotExercises)
          .where(and(eq(weakSpotExercises.id, itemId), eq(weakSpotExercises.userId, userId)));

        if (!exercise) {
          return reply.code(404).send({ error: 'Exercise not found' });
        }

        // Get correction type from the weak spot
        const [spot] = await db
          .select({ correctionType: weakSpots.correctionType })
          .from(weakSpots)
          .where(eq(weakSpots.id, weakSpotId));

        const ctx: WeakSpotExerciseContext = {
          originalText: exercise.originalText,
          correctedText: exercise.correctedText,
          explanation: exercise.explanation,
          correctionType: spot?.correctionType ?? 'grammar',
        };
        result = await evaluateWeakSpotExercise(ctx, transcription.text);
      }

      // Save attempt
      const [attempt] = await db
        .insert(weakSpotDrillAttempts)
        .values({
          userId,
          weakSpotId,
          correctionId: itemType === 'correction' ? itemId : null,
          exerciseId: itemType === 'exercise' ? itemId : null,
          passed: result.passed,
          transcript: transcription.text,
          feedback: result.feedback,
        })
        .returning({ id: weakSpotDrillAttempts.id });

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

  // POST /practice/weak-spot-drill-complete — Complete a drill session
  fastify.post('/weak-spot-drill-complete', async (request, reply) => {
    const { weakSpotId, allPassed } = request.body as { weakSpotId: number; allPassed: boolean };

    if (!weakSpotId || typeof allPassed !== 'boolean') {
      return reply.code(400).send({ error: 'weakSpotId and allPassed are required' });
    }

    const result = await advanceSRS(weakSpotId, allPassed);
    return result;
  });

  // POST /practice/weak-spot-dismiss — Dismiss a weak spot or quick fix
  fastify.post('/weak-spot-dismiss', async (request, reply) => {
    const userId = request.user.userId;
    const { type, id } = request.body as { type: 'weak_spot' | 'quick_fix'; id: number };

    if (!type || !id || !['weak_spot', 'quick_fix'].includes(type)) {
      return reply.code(400).send({ error: 'type (weak_spot|quick_fix) and id are required' });
    }

    if (type === 'weak_spot') {
      await dismissWeakSpot(id, userId);
    } else {
      await dismissQuickFix(id, userId);
    }

    return { success: true };
  });
}
