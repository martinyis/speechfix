import { FastifyInstance } from 'fastify';
import { runPatternAnalysisAll, runPatternAnalysisForUser } from '../jobs/patterns.js';

export async function jobRoutes(fastify: FastifyInstance) {
  // Cron endpoint — protected by JOB_SECRET, not by auth (public path)
  fastify.post('/jobs/run-pattern-analysis', async (request, reply) => {
    const secret = process.env.JOB_SECRET;
    if (!secret) {
      return reply.code(500).send({ error: 'JOB_SECRET not configured' });
    }

    const provided = request.headers['x-job-secret'];
    if (provided !== secret) {
      return reply.code(401).send({ error: 'Invalid job secret' });
    }

    const result = await runPatternAnalysisAll();
    return result;
  });

  // Authenticated endpoint — runs for the current user only
  fastify.post('/jobs/run-pattern-analysis/me', async (request) => {
    const result = await runPatternAnalysisForUser(request.user.userId);
    return { patternsFound: result.patternsFound };
  });
}
