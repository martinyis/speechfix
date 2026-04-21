/**
 * GET /sessions/:id/audio
 * Streams the persisted user audio for a session (Phase 2 Pitch Ribbon playback).
 *
 * POST /sessions/:id/raw-audio
 * Accepts a client-uploaded M4A (hi-fi capture). Stored on disk; encoded
 * to Opus asynchronously; raced against the legacy PCM pipeline with
 * audio_source precedence ('hifi' > 'pcm').
 *
 * Auth-gated to owner only. GET supports Range for seeking.
 */

import { FastifyInstance } from 'fastify';
import { createWriteStream } from 'node:fs';
import { mkdir, unlink } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import { db } from '../db/index.js';
import { sessions } from '../db/schema.js';
import { and, eq } from 'drizzle-orm';
import { audioStorage, buildSessionAudioPath } from '../shared/audio/storage.js';
import { encodeM4aToOpusWithTrim } from '../shared/audio/encoder.js';

/**
 * Kick off the M4A→Ogg-Opus encode, trimming to utterance segments if the
 * session has a stored speechTimeline. Updates audio_path + audio_source='hifi'.
 * Safe to call multiple times (idempotent; later call wins because we always
 * write 'hifi' precedence).
 */
export async function encodeAndPersistHifi(sessionId: number): Promise<void> {
  const [row] = await db.select({
    userId: sessions.userId,
    audioRawPath: sessions.audioRawPath,
    analysis: sessions.analysis,
  }).from(sessions).where(eq(sessions.id, sessionId));

  if (!row || !row.audioRawPath) return;

  const rawAbs = audioStorage.resolvePath(row.audioRawPath);
  const relativePath = buildSessionAudioPath(row.userId, sessionId);
  const tempOggPath = join(tmpdir(), `reflexa-hifi-${sessionId}-${randomUUID()}.ogg`);

  // Derive trim segments from the speech timeline (client-facing utterances
  // are in trim-time; the raw M4A is continuous wall-clock. If we have NO
  // timeline yet (encode race: user uploaded before analysis ran), just
  // encode the full file — safer than incorrect trims.
  const analysis = row.analysis as { speechTimeline?: { utterances?: Array<{ startTime: number; endTime: number }> } } | null;
  const utterances = analysis?.speechTimeline?.utterances ?? [];
  // NOTE: speechTimeline utterances are in TRIM-TIME, which is NOT the same
  // as the raw M4A timeline. For V1 we skip trim on hi-fi uploads — the M4A
  // already has AI-speech gated out client-side (mic muted during TTS), so
  // the only remaining silence is the user's own thinking pauses. A future
  // pass can re-derive dg-time utterances from an aux side-channel.
  const segments: Array<{ start: number; end: number }> = [];

  try {
    await encodeM4aToOpusWithTrim({
      inputM4aPath: rawAbs,
      outputOggPath: tempOggPath,
      segments,
    });
    await audioStorage.save(tempOggPath, relativePath);

    // 'hifi' precedence: always win the race against the PCM writer.
    await db.update(sessions)
      .set({ audioPath: relativePath, audioSource: 'hifi' })
      .where(eq(sessions.id, sessionId));

    console.log(`[session-audio] Hi-fi audio persisted for session ${sessionId}`);
    void utterances; // reserved for future trim pass
  } catch (err) {
    console.error(`[session-audio] Hi-fi encode failed for session ${sessionId}:`, err);
    await unlink(tempOggPath).catch(() => {});
  }
}

export async function sessionAudioRoutes(app: FastifyInstance) {
  app.get<{ Params: { id: string } }>('/sessions/:id/audio', async (request, reply) => {
    const sessionId = Number(request.params.id);
    if (!Number.isFinite(sessionId)) {
      return reply.code(400).send({ error: 'Invalid session id' });
    }

    const [session] = await db
      .select({ audioPath: sessions.audioPath })
      .from(sessions)
      .where(and(eq(sessions.id, sessionId), eq(sessions.userId, request.user.userId)));

    if (!session) {
      return reply.code(404).send({ error: 'Session not found' });
    }

    if (!session.audioPath) {
      return reply.code(404).send({ error: 'Audio not yet available' });
    }

    const total = await audioStorage.size(session.audioPath);
    if (total === null) {
      return reply.code(404).send({ error: 'Audio file missing on disk' });
    }

    const range = request.headers.range;
    if (range) {
      // Partial content for seek support. Range: bytes=start-end
      const match = /^bytes=(\d+)-(\d*)$/.exec(range);
      if (!match) {
        return reply.code(416).header('Content-Range', `bytes */${total}`).send();
      }
      const start = Number(match[1]);
      const end = match[2] ? Math.min(Number(match[2]), total - 1) : total - 1;
      if (start >= total) {
        return reply.code(416).header('Content-Range', `bytes */${total}`).send();
      }
      const stream = await audioStorage.createReadStream(session.audioPath, { start, end });
      return reply
        .code(206)
        .header('Content-Type', 'audio/ogg')
        .header('Content-Length', end - start + 1)
        .header('Content-Range', `bytes ${start}-${end}/${total}`)
        .header('Accept-Ranges', 'bytes')
        .header('Cache-Control', 'private, max-age=3600')
        .send(stream);
    }

    const stream = await audioStorage.createReadStream(session.audioPath);
    return reply
      .header('Content-Type', 'audio/ogg')
      .header('Content-Length', total)
      .header('Accept-Ranges', 'bytes')
      .header('Cache-Control', 'private, max-age=3600')
      .send(stream);
  });

  /**
   * POST /sessions/:id/raw-audio
   * Accepts a multipart M4A upload (up to 100MB; 60min @ 80kbps ≈ 36MB).
   * Streams to disk (never buffers in memory), moves into AudioStorage,
   * marks the session with `audio_raw_path`, then fires the encoder
   * asynchronously. Returns 202 immediately — the encoder's result shows
   * up later via audio_path update.
   */
  app.post<{ Params: { id: string } }>(
    '/sessions/:id/raw-audio',
    async (request, reply) => {
      const sessionId = Number(request.params.id);
      if (!Number.isFinite(sessionId)) {
        return reply.code(400).send({ error: 'Invalid session id' });
      }

      // Ownership check BEFORE consuming the stream (cheap).
      const [owned] = await db.select({ id: sessions.id }).from(sessions)
        .where(and(eq(sessions.id, sessionId), eq(sessions.userId, request.user.userId)));
      if (!owned) return reply.code(404).send({ error: 'Session not found' });

      // Route-local 100MB limit overrides the global 25MB.
      const part = await request.file({ limits: { fileSize: 100 * 1024 * 1024 } });
      if (!part) return reply.code(400).send({ error: 'No file provided' });

      // Stream the upload to a tmp path, then atomically move into storage.
      const rawRel = join(String(request.user.userId), `${sessionId}.m4a`);
      const tmpPath = join(tmpdir(), `reflexa-rawupload-${sessionId}-${randomUUID()}.m4a`);
      try {
        await mkdir(dirname(tmpPath), { recursive: true });
        await pipeline(part.file, createWriteStream(tmpPath));
        if (part.file.truncated) {
          await unlink(tmpPath).catch(() => {});
          return reply.code(413).send({ error: 'File too large' });
        }
        await audioStorage.save(tmpPath, rawRel);
      } catch (err) {
        await unlink(tmpPath).catch(() => {});
        request.log.error({ err }, 'Failed to persist raw audio upload');
        return reply.code(500).send({ error: 'Upload failed' });
      }

      await db.update(sessions)
        .set({ audioRawPath: rawRel })
        .where(eq(sessions.id, sessionId));

      // Fire-and-forget encode. The client only needs the 202 to clear its queue.
      encodeAndPersistHifi(sessionId).catch((err) => {
        request.log.error({ err, sessionId }, 'Async hi-fi encode failed');
      });

      return reply.code(202).send({ ok: true });
    }
  );
}
