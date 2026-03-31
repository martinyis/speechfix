import { FastifyInstance } from 'fastify';
import { db } from '../db/index.js';
import { speechPatterns } from '../db/schema.js';
import { eq } from 'drizzle-orm';

export async function patternRoutes(fastify: FastifyInstance) {
  fastify.get('/patterns', async (request) => {
    const rows = await db
      .select()
      .from(speechPatterns)
      .where(eq(speechPatterns.userId, request.user.userId));

    return {
      patterns: rows.map((row) => ({
        id: row.id,
        type: row.type,
        identifier: row.identifier,
        ...(row.data as Record<string, unknown>),
        sessionsAnalyzed: (row.sessionsAnalyzed as number[]).length,
        updatedAt: row.updatedAt,
      })),
    };
  });
}
