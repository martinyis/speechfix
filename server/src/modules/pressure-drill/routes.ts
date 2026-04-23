import { FastifyInstance } from 'fastify';
import { db } from '../../db/index.js';
import { pressureDrillSessions } from '../../db/schema.js';
import { eq, desc, and, gte } from 'drizzle-orm';

const MIN_SESSION_DURATION = 30; // ignore sessions shorter than 30s

export async function pressureDrillRoutes(fastify: FastifyInstance) {
  // GET /pressure-drill/sessions — list drill sessions (newest first, ≥30s only)
  fastify.get('/pressure-drill/sessions', async (request) => {
    const rows = await db
      .select()
      .from(pressureDrillSessions)
      .where(and(
        eq(pressureDrillSessions.userId, request.user.userId),
        gte(pressureDrillSessions.durationSeconds, MIN_SESSION_DURATION),
      ))
      .orderBy(desc(pressureDrillSessions.createdAt))
      .limit(50);

    return { sessions: rows };
  });

  // GET /pressure-drill/sessions/:id — single session by id
  fastify.get<{ Params: { id: string } }>('/pressure-drill/sessions/:id', async (request, reply) => {
    const id = Number(request.params.id);
    const [row] = await db
      .select()
      .from(pressureDrillSessions)
      .where(eq(pressureDrillSessions.id, id))
      .limit(1);

    if (!row || row.userId !== request.user.userId) {
      return reply.code(404).send({ error: 'Not found' });
    }

    return row;
  });

  // GET /pressure-drill/stats — aggregate stats
  fastify.get('/pressure-drill/stats', async (request) => {
    const userId = request.user.userId;

    const rows = await db
      .select()
      .from(pressureDrillSessions)
      .where(and(
        eq(pressureDrillSessions.userId, userId),
        gte(pressureDrillSessions.durationSeconds, MIN_SESSION_DURATION),
      ))
      .orderBy(desc(pressureDrillSessions.createdAt));

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

    // Top fillers across all drill sessions
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
