import { FastifyInstance } from 'fastify';
import { db } from '../db/index.js';
import { fillerCoachSessions } from '../db/schema.js';
import { eq, desc, sql, and, gte } from 'drizzle-orm';

const MIN_SESSION_DURATION = 30; // ignore sessions shorter than 30s

export async function fillerCoachRoutes(fastify: FastifyInstance) {
  // GET /filler-coach/sessions — list coach sessions (newest first, ≥30s only)
  fastify.get('/filler-coach/sessions', async (request) => {
    const rows = await db
      .select()
      .from(fillerCoachSessions)
      .where(and(
        eq(fillerCoachSessions.userId, request.user.userId),
        gte(fillerCoachSessions.durationSeconds, MIN_SESSION_DURATION),
      ))
      .orderBy(desc(fillerCoachSessions.createdAt))
      .limit(50);

    return { sessions: rows };
  });

  // GET /filler-coach/sessions/:id — single session by id
  fastify.get<{ Params: { id: string } }>('/filler-coach/sessions/:id', async (request, reply) => {
    const id = Number(request.params.id);
    const [row] = await db
      .select()
      .from(fillerCoachSessions)
      .where(eq(fillerCoachSessions.id, id))
      .limit(1);

    if (!row || row.userId !== request.user.userId) {
      return reply.code(404).send({ error: 'Not found' });
    }

    return row;
  });

  // GET /filler-coach/stats — aggregate stats
  fastify.get('/filler-coach/stats', async (request) => {
    const userId = request.user.userId;

    const rows = await db
      .select()
      .from(fillerCoachSessions)
      .where(and(
        eq(fillerCoachSessions.userId, userId),
        gte(fillerCoachSessions.durationSeconds, MIN_SESSION_DURATION),
      ))
      .orderBy(desc(fillerCoachSessions.createdAt));

    if (rows.length === 0) {
      return { totalSessions: 0, avgFillersPerMin: 0, bestFillersPerMin: 0, topFillers: [] };
    }

    // Compute fillers/min for each session
    const rates = rows.map((r) => {
      const mins = Math.max(r.durationSeconds / 60, 0.5); // floor at 30s
      return r.totalFillerCount / mins;
    });

    const avgFillersPerMin = Number((rates.reduce((a, b) => a + b, 0) / rates.length).toFixed(1));
    const bestFillersPerMin = Number(Math.min(...rates).toFixed(1));

    // Top fillers across all coach sessions
    const fillerMap = new Map<string, number>();
    for (const row of rows) {
      const data = row.fillerData as { fillerWords?: Array<{ word: string; count: number }> } | null;
      if (data?.fillerWords) {
        for (const fw of data.fillerWords) {
          fillerMap.set(fw.word, (fillerMap.get(fw.word) ?? 0) + fw.count);
        }
      }
    }

    const topFillers = [...fillerMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([word, count]) => ({ word, count }));

    const totalPracticeSeconds = rows.reduce((sum, r) => sum + r.durationSeconds, 0);

    return {
      totalSessions: rows.length,
      avgFillersPerMin,
      bestFillersPerMin,
      totalPracticeSeconds,
      topFillers,
    };
  });
}
