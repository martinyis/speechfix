import 'dotenv/config';
import Fastify from 'fastify';
import fastifyCors from '@fastify/cors';
import fastifyMultipart from '@fastify/multipart';
import fastifyWebsocket from '@fastify/websocket';
import { db } from './db/index.js';
import { sql, and, isNotNull, ne, or, isNull } from 'drizzle-orm';
import { sessions as sessionsTable } from './db/schema.js';
import { sessionRoutes } from './modules/sessions/routes.js';
import { sessionAudioRoutes, encodeAndPersistHifi } from './modules/sessions/audio-routes.js';
import { voiceSessionRoute } from './routes/voice-session-ws.js';
import { authRoutes } from './modules/auth/routes.js';
import { onboardingRoutes } from './modules/onboarding/routes.js';
import { agentRoutes } from './routes/agents.js';
import { introAudioRoute } from './routes/intro-audio.js';
import { practiceRoutes } from './modules/practice/routes.js';
import { jobRoutes } from './modules/patterns/job-routes.js';
import { greetingRoutes } from './routes/greetings.js';
import { fillerCoachRoutes } from './modules/filler-coach/routes.js';
import { weakSpotRoutes } from './modules/weak-spots/routes.js';
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
await app.register(sessionAudioRoutes);
await app.register(voiceSessionRoute);
await app.register(agentRoutes);
await app.register(introAudioRoute);
await app.register(practiceRoutes, { prefix: '/practice' });
await app.register(jobRoutes);
await app.register(greetingRoutes);
await app.register(fillerCoachRoutes);
await app.register(weakSpotRoutes, { prefix: '/practice' });

async function recoverPendingHifiEncodes() {
  // Any row with a raw upload on disk but not yet marked 'hifi' means either
  // the encode never ran (server crashed) or it ran for the PCM path. Re-run.
  try {
    const pending = await db.select({ id: sessionsTable.id })
      .from(sessionsTable)
      .where(and(
        isNotNull(sessionsTable.audioRawPath),
        or(isNull(sessionsTable.audioSource), ne(sessionsTable.audioSource, 'hifi')),
      ));
    if (pending.length === 0) return;
    app.log.info(`[boot-recovery] Re-encoding ${pending.length} hi-fi audio(s) from disk`);
    for (const { id } of pending) {
      encodeAndPersistHifi(id).catch((err) => app.log.error({ err, id }, 'boot-recovery encode failed'));
    }
  } catch (err) {
    app.log.error({ err }, 'boot-recovery scan failed');
  }
}

async function start() {
  try {
    await app.listen({ port: Number(process.env.PORT) || 3005, host: '0.0.0.0' });
    await db.execute(sql`SELECT 1`);
    app.log.info('Database connected');
    // Fire-and-forget — do not block server readiness on recovery work.
    recoverPendingHifiEncodes();
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
