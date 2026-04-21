import { FastifyInstance } from 'fastify';
import { ensureGreetingsExist } from './greeting-generator.js';

export async function greetingRoutes(fastify: FastifyInstance) {
  // POST /greetings/warmup — ensures all greetings exist for authenticated user
  fastify.post('/greetings/warmup', async (request, reply) => {
    await ensureGreetingsExist(request.user.userId);
    reply.send({ ok: true });
  });
}
