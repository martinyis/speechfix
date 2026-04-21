import { db } from '../src/db/index.js';
import { speechPatterns } from '../src/db/schema.js';
import { eq, and, sql } from 'drizzle-orm';
import { generateAndStorePatternExercises } from '../src/modules/patterns/exercise-generator.js';

const userId = Number(process.argv[2]);
const patternId = Number(process.argv[3]);

if (!userId || !patternId) {
  console.error('Usage: tsx scripts/heal-pattern.ts <userId> <patternId>');
  process.exit(1);
}

async function main() {
  console.log(`[heal] Finalizing pattern ${patternId} for user ${userId}`);

  const [pattern] = await db
    .select({ id: speechPatterns.id, status: speechPatterns.status })
    .from(speechPatterns)
    .where(eq(speechPatterns.id, patternId));

  if (!pattern) {
    console.error(`Pattern ${patternId} not found`);
    process.exit(1);
  }
  console.log(`[heal] Current status: ${pattern.status}`);

  await db
    .update(speechPatterns)
    .set({ status: 'practiced', completedAt: new Date() })
    .where(eq(speechPatterns.id, patternId));
  console.log(`[heal] Marked pattern ${patternId} as practiced`);

  const [next] = await db
    .select({ id: speechPatterns.id })
    .from(speechPatterns)
    .where(and(eq(speechPatterns.userId, userId), eq(speechPatterns.status, 'queued')))
    .orderBy(sql`${speechPatterns.queuePosition} NULLS LAST, ${speechPatterns.id}`)
    .limit(1);

  if (!next) {
    console.log('[heal] No queued pattern to promote — done.');
    process.exit(0);
  }

  await db
    .update(speechPatterns)
    .set({ status: 'active', queuePosition: null })
    .where(eq(speechPatterns.id, next.id));
  console.log(`[heal] Promoted pattern ${next.id} to active`);

  console.log(`[heal] Generating L1 exercises for pattern ${next.id}...`);
  await generateAndStorePatternExercises([next.id], userId);
  console.log(`[heal] Done.`);
  process.exit(0);
}

main().catch((err) => {
  console.error('[heal] Failed:', err);
  process.exit(1);
});
