import 'dotenv/config';
import Fastify from 'fastify';
import fastifyCors from '@fastify/cors';
import fastifyMultipart from '@fastify/multipart';
import { db } from './db/index.js';
import { sql } from 'drizzle-orm';

const app = Fastify({ logger: true });

await app.register(fastifyCors, { origin: true });
await app.register(fastifyMultipart, { limits: { fileSize: 25 * 1024 * 1024 } });

app.get('/health', async () => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

async function start() {
  try {
    await app.listen({ port: Number(process.env.PORT) || 3000, host: '0.0.0.0' });
    await db.execute(sql`SELECT 1`);
    app.log.info('Database connected');
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
