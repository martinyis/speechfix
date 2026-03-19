import { FastifyInstance } from 'fastify';
import { transcribe } from '../services/transcription.js';
import { db } from '../db/index.js';
import { sessions } from '../db/schema.js';
import { writeFile, unlink } from 'fs/promises';
import { randomUUID } from 'crypto';
import path from 'path';

export async function sessionRoutes(fastify: FastifyInstance) {
  fastify.post('/sessions', async (request, reply) => {
    const data = await request.file();

    if (!data) {
      return reply.code(400).send({ error: 'No audio file provided' });
    }

    const tempPath = path.join('/tmp', `${randomUUID()}.m4a`);
    const buffer = await data.toBuffer();
    await writeFile(tempPath, buffer);

    // Duration is sent as a form field; @fastify/multipart fields are MultipartValue objects
    const durationField = data.fields?.duration;
    const durationSeconds = Number(
      (durationField && 'value' in durationField ? durationField.value : null) ?? 0
    );

    try {
      const result = await transcribe(tempPath);

      if (!result.text) {
        return reply.code(200).send({ session: null, message: 'No speech detected' });
      }

      const [session] = await db
        .insert(sessions)
        .values({
          transcription: result.text,
          durationSeconds: durationSeconds,
          analysis: null,
        })
        .returning();

      return { session: { ...session, sentences: result.sentences } };
    } finally {
      await unlink(tempPath).catch(() => {});
    }
  });
}
