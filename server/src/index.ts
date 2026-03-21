import 'dotenv/config';
import Fastify from 'fastify';
import fastifyCors from '@fastify/cors';
import fastifyMultipart from '@fastify/multipart';
import fastifyWebsocket from '@fastify/websocket';
import { db } from './db/index.js';
import { sql } from 'drizzle-orm';
import { sessionRoutes } from './routes/sessions.js';
import { voiceSessionRoute } from './routes/voice-session-ws.js';
import { initGreetingCache } from './voice/greeting-cache.js';

const app = Fastify({ logger: true });

await app.register(fastifyCors, { origin: true });
await app.register(fastifyMultipart, { limits: { fileSize: 25 * 1024 * 1024 } });
await app.register(fastifyWebsocket);

app.get('/health', async () => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

await app.register(sessionRoutes);
await app.register(voiceSessionRoute);

async function start() {
  try {
    await app.listen({ port: Number(process.env.PORT) || 3005, host: '0.0.0.0' });
    await db.execute(sql`SELECT 1`);
    app.log.info('Database connected');

    // Pre-generate greeting audio in the background (non-blocking)
    initGreetingCache().catch((err) => {
      app.log.error('Greeting cache init failed (non-fatal):', err);
    });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
