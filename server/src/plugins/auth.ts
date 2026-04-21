import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { verifyToken, type JwtPayload } from '../modules/auth/service.js';

declare module 'fastify' {
  interface FastifyRequest {
    user: JwtPayload;
  }
}

async function authPlugin(fastify: FastifyInstance) {
  fastify.decorateRequest('user', null as unknown as JwtPayload);

  fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    const publicPrefixes = ['/health', '/auth/register', '/auth/login', '/intro-audio', '/voices'];
    const publicExact = ['/jobs/run-pattern-analysis'];
    const urlPath = request.url.split('?')[0];
    if (publicPrefixes.some(p => request.url.startsWith(p)) || publicExact.includes(urlPath)) {
      return;
    }

    const isWs = request.url.startsWith('/voice-session');
    let token: string | undefined;

    if (isWs) {
      const url = new URL(request.url, `http://${request.headers.host}`);
      token = url.searchParams.get('token') ?? undefined;
    } else {
      const authHeader = request.headers.authorization;
      if (authHeader?.startsWith('Bearer ')) {
        token = authHeader.slice(7);
      }
    }

    if (!token) {
      return reply.code(401).send({ error: 'Authentication required' });
    }

    try {
      request.user = verifyToken(token);
    } catch {
      return reply.code(401).send({ error: 'Invalid or expired token' });
    }
  });
}

export default fp(authPlugin);
