import 'dotenv/config';
import Fastify from 'fastify';
import fastifyCors from '@fastify/cors';
import fastifyMultipart from '@fastify/multipart';
import fastifyWebsocket from '@fastify/websocket';
import { db } from './db/index.js';
import { sql } from 'drizzle-orm';
import { sessionRoutes } from './routes/sessions.js';
import { voiceSessionRoute } from './routes/voice-session-ws.js';
import { authRoutes } from './routes/auth.js';
import { onboardingRoutes } from './routes/onboarding.js';
import { agentRoutes } from './routes/agents.js';
import authPlugin from './plugins/auth.js';

const app = Fastify({ logger: true });

await app.register(fastifyCors, { origin: true });
await app.register(fastifyMultipart, { limits: { fileSize: 25 * 1024 * 1024 } });
await app.register(fastifyWebsocket);
await app.register(authPlugin);

app.get('/health', async () => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

await app.register(authRoutes);
await app.register(onboardingRoutes);
await app.register(sessionRoutes);
await app.register(voiceSessionRoute);
await app.register(agentRoutes);

async function start() {
  try {
    await app.listen({ port: Number(process.env.PORT) || 3005, host: '0.0.0.0' });
    await db.execute(sql`SELECT 1`);
    app.log.info('Database connected');

  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
