import Groq from 'groq-sdk';
import { db } from '../../db/index.js';
import {
  corrections,
  weakSpots,
  weakSpotCorrections,
  weakSpotExercises,
  weakSpotDrillAttempts,
  sessions,
} from '../../db/schema.js';
import { eq, and, inArray, ne, isNull, sql, asc, desc } from 'drizzle-orm';

const groq = new Groq();
const MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct';

const THRESHOLDS = { error: 2, improvement: 3, polish: 4 } as const;
const MAX_ACTIVE = 3;
const SRS_INTERVALS = [0, 3, 7, 14]; // days for stages 0-3, stage 4+ = resolved
const EXERCISES_PER_SPOT = { min: 2, max: 4 };
const REOPEN_THRESHOLD = 3;

/**
 * Grabs sentence before + current + after, joins with space.
 */
export function computeFullContext(sentenceIndex: number, sentences: string[]): string {
  const start = Math.max(0, sentenceIndex - 1);
  const end = Math.min(sentences.length - 1, sentenceIndex + 1);
  const parts: string[] = [];
  for (let i = start; i <= end; i++) {
    parts.push(sentences[i]);
  }
  return parts.join(' ');
}

/**
 * Core algorithm: absorb new corrections into the weak spots system.
 */
export async function absorbCorrections(
  userId: number,
  correctionIds: number[],
  sentences: string[],
): Promise<void> {
  if (correctionIds.length === 0) return;

  // 1. Fetch the new corrections
  const newCorrections = await db
    .select()
    .from(corrections)
    .where(inArray(corrections.id, correctionIds));

  if (newCorrections.length === 0) return;

  // 2. Compute and store fullContext for each
  await Promise.all(
    newCorrections.map((c) => {
      const ctx = computeFullContext(c.sentenceIndex, sentences);
      return db
        .update(corrections)
        .set({ fullContext: ctx })
        .where(eq(corrections.id, c.id));
    }),
  );

  // 3. Group by correctionType
  const byType = new Map<string, typeof newCorrections>();
  for (const c of newCorrections) {
    const group = byType.get(c.correctionType) ?? [];
    group.push(c);
    byType.set(c.correctionType, group);
  }

  // 4. Process each type
  for (const [correctionType, typeCorrections] of byType) {
    // Find existing weak spot for this user + type (not dismissed)
    const existing = await db
      .select()
      .from(weakSpots)
      .where(
        and(
          eq(weakSpots.userId, userId),
          eq(weakSpots.correctionType, correctionType),
          ne(weakSpots.status, 'dismissed'),
        ),
      )
      .limit(1);

    const spot = existing[0];

    if (spot) {
      if (spot.status === 'active' || spot.status === 'backlog') {
        // Link new corrections to existing spot
        await linkCorrections(spot.id, typeCorrections.map((c) => c.id));
      } else if (spot.status === 'resolved') {
        // Count new corrections of this type
        if (typeCorrections.length >= REOPEN_THRESHOLD) {
          // Reopen
          await db
            .update(weakSpots)
            .set({
              status: 'active',
              isRecurring: true,
              srsStage: 0,
              nextReviewAt: null,
              updatedAt: new Date(),
            })
            .where(eq(weakSpots.id, spot.id));
          await linkCorrections(spot.id, typeCorrections.map((c) => c.id));
          await promoteFromBacklog(userId);
        }
        // If < threshold, do nothing — corrections remain as quick fixes
      }
    } else {
      // No weak spot exists — count ALL unlinked corrections of this type for user
      const unlinkedResult = await db
        .select({ id: corrections.id, severity: corrections.severity })
        .from(corrections)
        .innerJoin(sessions, eq(corrections.sessionId, sessions.id))
        .leftJoin(weakSpotCorrections, eq(corrections.id, weakSpotCorrections.correctionId))
        .where(
          and(
            eq(sessions.userId, userId),
            eq(corrections.correctionType, correctionType),
            isNull(weakSpotCorrections.id),
            sql`${corrections.dismissed} IS NOT TRUE`,
          ),
        );

      const count = unlinkedResult.length;
      if (count === 0) continue;

      // Get most common severity
      const severityCounts = new Map<string, number>();
      for (const row of unlinkedResult) {
        severityCounts.set(row.severity, (severityCounts.get(row.severity) ?? 0) + 1);
      }
      let mostCommonSeverity = 'error';
      let maxCount = 0;
      for (const [sev, cnt] of severityCounts) {
        if (cnt > maxCount) {
          mostCommonSeverity = sev;
          maxCount = cnt;
        }
      }

      const threshold = THRESHOLDS[mostCommonSeverity as keyof typeof THRESHOLDS] ?? 2;

      if (count >= threshold) {
        // Create weak spot
        try {
          const [newSpot] = await db
            .insert(weakSpots)
            .values({
              userId,
              correctionType,
              status: 'backlog',
              severity: mostCommonSeverity as 'error' | 'improvement' | 'polish',
            })
            .returning();

          // Link all unlinked corrections
          await linkCorrections(newSpot.id, unlinkedResult.map((r) => r.id));

          // Generate exercises
          const correctionData = await db
            .select({
              originalText: corrections.originalText,
              correctedText: corrections.correctedText,
              explanation: corrections.explanation,
              correctionType: corrections.correctionType,
            })
            .from(corrections)
            .where(inArray(corrections.id, unlinkedResult.map((r) => r.id)))
            .limit(5);

          await generateWeakSpotExercises(newSpot.id, userId, correctionData);
          await promoteFromBacklog(userId);
        } catch (err: any) {
          // Unique constraint violation = race condition, another process created it
          if (err?.code === '23505') {
            console.log(`[weak-spots] Race condition for ${correctionType}, skipping`);
          } else {
            throw err;
          }
        }
      }
      // Else: corrections remain as quick fixes
    }
  }
}

/**
 * Generate 2-4 practice sentences for a weak spot using Groq LLM.
 */
export async function generateWeakSpotExercises(
  weakSpotId: number,
  userId: number,
  correctionData: { originalText: string; correctedText: string; explanation: string | null; correctionType: string }[],
): Promise<void> {
  // Skip if exercises already exist
  const existingExercises = await db
    .select({ id: weakSpotExercises.id })
    .from(weakSpotExercises)
    .where(eq(weakSpotExercises.weakSpotId, weakSpotId))
    .limit(1);

  if (existingExercises.length > 0) return;

  const correctionType = correctionData[0]?.correctionType ?? 'grammar';
  const examples = correctionData
    .map(
      (c, i) =>
        `${i + 1}. Wrong: "${c.originalText}" → Right: "${c.correctedText}"${
          c.explanation ? ` — ${c.explanation}` : ''
        }`,
    )
    .join('\n');

  const systemPrompt = `You generate practice sentences for non-native English speakers to drill a specific recurring error.

OUTPUT FORMAT — return ONLY valid JSON:
{"exercises": [{"originalText": "...", "correctedText": "...", "explanation": "..."}]}

CRITICAL RULES:
1. Every "originalText" must contain the SAME SPECIFIC grammatical error as the user's real examples. Not a related error. Not a different error of the same broad category. The same micro-pattern (e.g. if the user kept dropping "to" before an infinitive, every originalText must drop "to" before an infinitive).
2. "correctedText" must be byte-identical to "originalText" except for the minimal edit that fixes the error. No rephrasing, no synonyms, no restructure. Just the fix.
3. "explanation" must be concrete and point at the exact word/phrase. Max 15 words. Good: "missing 'to' before 'understand'". Good: "past tense should be 'went', not 'go'". Good: "subject-verb disagreement — 'people are' not 'people is'". Bad: "grammar error", "verb tense issue", "incorrect usage".
4. Generate ${EXERCISES_PER_SPOT.min}-${EXERCISES_PER_SPOT.max} exercises. 10-20 words each. Everyday conversational topics. Vary the surface vocabulary — do NOT reuse the user's example sentences.
5. The error must be natural-sounding for a non-native speaker — plausible, not contrived.`;

  const userPrompt = `The user keeps making "${correctionType}" errors. Here are their real corrections (wrong → right):

${examples}

Study the SHARED micro-pattern across these examples. Then generate fresh sentences that reproduce the exact same micro-pattern on different topics. Each exercise must let the user feel the same fix they needed in their own speech.`;

  try {
    const response = await groq.chat.completions.create({
      model: MODEL,
      max_tokens: 1536,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    });

    const text = response.choices[0]?.message?.content?.trim();
    if (!text) {
      console.error('[weak-spots] No text in exercise generation response');
      return;
    }

    const parsed = JSON.parse(text);
    const exercises: { originalText?: string; correctedText?: string; explanation?: string }[] =
      parsed.exercises ?? [];

    const valid = exercises.filter(
      (ex) =>
        typeof ex.originalText === 'string' &&
        ex.originalText.trim().length > 0 &&
        typeof ex.correctedText === 'string' &&
        ex.correctedText.trim().length > 0,
    );

    if (valid.length === 0) {
      console.error('[weak-spots] LLM returned no valid exercises');
      return;
    }

    const toInsert = valid.slice(0, EXERCISES_PER_SPOT.max);

    await db.insert(weakSpotExercises).values(
      toInsert.map((ex, i) => ({
        weakSpotId,
        userId,
        originalText: ex.originalText!.trim(),
        correctedText: ex.correctedText!.trim(),
        explanation: ex.explanation?.trim() || null,
        orderIndex: i,
      })),
    );

    console.log(`[weak-spots] Generated ${toInsert.length} exercises for weak spot ${weakSpotId}`);
  } catch (err) {
    console.error('[weak-spots] Failed to generate exercises:', err);
  }
}

/**
 * Promote from backlog to active if there's room.
 */
export async function promoteFromBacklog(userId: number): Promise<void> {
  const activeCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(weakSpots)
    .where(and(eq(weakSpots.userId, userId), eq(weakSpots.status, 'active')));

  const currentActive = Number(activeCount[0]?.count ?? 0);
  if (currentActive >= MAX_ACTIVE) return;

  const slotsAvailable = MAX_ACTIVE - currentActive;

  // Recurring first, then oldest
  const candidates = await db
    .select()
    .from(weakSpots)
    .where(and(eq(weakSpots.userId, userId), eq(weakSpots.status, 'backlog')))
    .orderBy(desc(weakSpots.isRecurring), asc(weakSpots.createdAt))
    .limit(slotsAvailable);

  for (const spot of candidates) {
    await db
      .update(weakSpots)
      .set({ status: 'active', nextReviewAt: null, updatedAt: new Date() })
      .where(eq(weakSpots.id, spot.id));
  }
}

/**
 * Advance or reset the SRS stage for a weak spot after a drill.
 */
export async function advanceSRS(
  weakSpotId: number,
  allPassed: boolean,
): Promise<{ resolved: boolean; nextReviewAt: Date | null; srsStage: number }> {
  const [spot] = await db
    .select()
    .from(weakSpots)
    .where(eq(weakSpots.id, weakSpotId));

  if (!spot) throw new Error(`Weak spot ${weakSpotId} not found`);

  const now = new Date();

  if (allPassed) {
    const newStage = spot.srsStage + 1;

    if (newStage > 3) {
      // Resolved
      await db
        .update(weakSpots)
        .set({ status: 'resolved', srsStage: newStage, lastDrillAt: now, updatedAt: now })
        .where(eq(weakSpots.id, weakSpotId));
      await promoteFromBacklog(spot.userId);
      return { resolved: true, nextReviewAt: null, srsStage: newStage };
    }

    const intervalDays = SRS_INTERVALS[newStage] ?? 14;
    const nextReview = new Date(now.getTime() + intervalDays * 24 * 60 * 60 * 1000);

    await db
      .update(weakSpots)
      .set({ srsStage: newStage, nextReviewAt: nextReview, lastDrillAt: now, updatedAt: now })
      .where(eq(weakSpots.id, weakSpotId));

    return { resolved: false, nextReviewAt: nextReview, srsStage: newStage };
  } else {
    // Failed — reset
    await db
      .update(weakSpots)
      .set({ srsStage: 0, nextReviewAt: null, lastDrillAt: now, updatedAt: now })
      .where(eq(weakSpots.id, weakSpotId));

    return { resolved: false, nextReviewAt: null, srsStage: 0 };
  }
}

/**
 * Dismiss a weak spot.
 */
export async function dismissWeakSpot(weakSpotId: number, userId: number): Promise<void> {
  const [spot] = await db
    .select()
    .from(weakSpots)
    .where(and(eq(weakSpots.id, weakSpotId), eq(weakSpots.userId, userId)));

  if (!spot) throw new Error('Weak spot not found');

  await db
    .update(weakSpots)
    .set({ status: 'dismissed', updatedAt: new Date() })
    .where(eq(weakSpots.id, weakSpotId));

  await promoteFromBacklog(userId);
}

/**
 * Dismiss a quick fix correction.
 */
export async function dismissQuickFix(correctionId: number, userId: number): Promise<void> {
  // Verify ownership via session join
  const result = await db
    .select({ id: corrections.id })
    .from(corrections)
    .innerJoin(sessions, eq(corrections.sessionId, sessions.id))
    .where(and(eq(corrections.id, correctionId), eq(sessions.userId, userId)))
    .limit(1);

  if (result.length === 0) throw new Error('Correction not found');

  await db
    .update(corrections)
    .set({ dismissed: true })
    .where(eq(corrections.id, correctionId));
}

/**
 * Backfill: scan ALL unlinked corrections for a user, group by type,
 * and create weak spots for any type meeting the threshold.
 * Idempotent — skips types that already have a non-dismissed weak spot.
 */
export async function backfillWeakSpots(userId: number): Promise<void> {
  // Get all unlinked, non-dismissed corrections grouped by type
  const unlinked = await db
    .select({
      id: corrections.id,
      correctionType: corrections.correctionType,
      severity: corrections.severity,
    })
    .from(corrections)
    .innerJoin(sessions, eq(corrections.sessionId, sessions.id))
    .leftJoin(weakSpotCorrections, eq(corrections.id, weakSpotCorrections.correctionId))
    .where(
      and(
        eq(sessions.userId, userId),
        isNull(weakSpotCorrections.id),
        sql`${corrections.dismissed} IS NOT TRUE`,
      ),
    );

  if (unlinked.length === 0) return;

  // Group by correctionType
  const byType = new Map<string, typeof unlinked>();
  for (const c of unlinked) {
    const group = byType.get(c.correctionType) ?? [];
    group.push(c);
    byType.set(c.correctionType, group);
  }

  for (const [correctionType, typeCorrections] of byType) {
    // Skip if a non-dismissed weak spot already exists for this type
    const existing = await db
      .select({ id: weakSpots.id })
      .from(weakSpots)
      .where(
        and(
          eq(weakSpots.userId, userId),
          eq(weakSpots.correctionType, correctionType),
          ne(weakSpots.status, 'dismissed'),
        ),
      )
      .limit(1);

    if (existing.length > 0) continue;

    // Determine most common severity
    const severityCounts = new Map<string, number>();
    for (const row of typeCorrections) {
      severityCounts.set(row.severity, (severityCounts.get(row.severity) ?? 0) + 1);
    }
    let mostCommonSeverity = 'error';
    let maxCount = 0;
    for (const [sev, cnt] of severityCounts) {
      if (cnt > maxCount) {
        mostCommonSeverity = sev;
        maxCount = cnt;
      }
    }

    const threshold = THRESHOLDS[mostCommonSeverity as keyof typeof THRESHOLDS] ?? 2;
    if (typeCorrections.length < threshold) continue;

    try {
      const [newSpot] = await db
        .insert(weakSpots)
        .values({
          userId,
          correctionType,
          status: 'backlog',
          severity: mostCommonSeverity as 'error' | 'improvement' | 'polish',
        })
        .returning();

      await linkCorrections(newSpot.id, typeCorrections.map((r) => r.id));

      const correctionData = await db
        .select({
          originalText: corrections.originalText,
          correctedText: corrections.correctedText,
          explanation: corrections.explanation,
          correctionType: corrections.correctionType,
        })
        .from(corrections)
        .where(inArray(corrections.id, typeCorrections.map((r) => r.id)))
        .limit(5);

      await generateWeakSpotExercises(newSpot.id, userId, correctionData);
      await promoteFromBacklog(userId);
    } catch (err: any) {
      if (err?.code === '23505') {
        console.log(`[weak-spots] Backfill race condition for ${correctionType}, skipping`);
      } else {
        throw err;
      }
    }
  }

  console.log(`[weak-spots] Backfill complete for user ${userId}`);
}

// Helper: link corrections to a weak spot, ignoring duplicates
async function linkCorrections(weakSpotId: number, correctionIds: number[]): Promise<void> {
  for (const correctionId of correctionIds) {
    try {
      await db.insert(weakSpotCorrections).values({ weakSpotId, correctionId });
    } catch (err: any) {
      // Ignore unique constraint violations
      if (err?.code !== '23505') throw err;
    }
  }
}
