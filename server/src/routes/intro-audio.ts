import { FastifyInstance } from 'fastify';
import { createHash } from 'crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { pcmToWav } from '../shared/audio/wav.js';
import { DEFAULT_VOICE_ID, TTS_MODEL, TTS_SPEED, TTS_EMOTION } from '../voice/voice-config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = join(__dirname, '..', '..', '.cache');
const CACHE_PCM_PATH = join(CACHE_DIR, 'intro-audio.pcm');
const CACHE_WAV_PATH = join(CACHE_DIR, 'intro-audio.wav');
const CACHE_META_PATH = join(CACHE_DIR, 'intro-audio-meta.json');

const INTRO_SEGMENTS = [
  'Hey. Welcome to Reflexa.',
  "I'm your AI speaking coach,",
  'built to help you speak English with more clarity and confidence.',
  "Here's how it works.",
  'You talk to me, like a real conversation.',
  'I listen, I respond, and behind the scenes,',
  "I'm analyzing your speech patterns,",
  'grammar, filler words, clarity, all of it.',
  'After each session, you get a detailed breakdown',
  'of exactly what to work on.',
  'No generic tips. Just precise, personalized feedback',
  'based on how you actually speak.',
  'Before we begin,',
  "I'll need access to your microphone so I can listen to you speak. Tap the button below to get started.",
];

const FULL_SCRIPT = INTRO_SEGMENTS.join(' ');
const SCRIPT_HASH = createHash('md5').update(FULL_SCRIPT).digest('hex');

const SAMPLE_RATE = 24000;
const BITS_PER_SAMPLE = 16;

interface CachedMeta {
  scriptHash: string;
  totalDurationMs: number;
  segments: Array<{ text: string; startMs: number; endMs: number }>;
}

function computeSegmentTimings(totalDurationMs: number): Array<{ text: string; startMs: number; endMs: number }> {
  const totalChars = INTRO_SEGMENTS.reduce((sum, s) => sum + s.length, 0);
  let currentMs = 0;

  return INTRO_SEGMENTS.map((text) => {
    const startMs = Math.round(currentMs);
    const durationMs = (text.length / totalChars) * totalDurationMs;
    currentMs += durationMs;
    return { text, startMs, endMs: Math.round(currentMs) };
  });
}

async function ensureAudioCached(): Promise<{ meta: CachedMeta; wavPath: string } | null> {
  // Check cache validity
  if (existsSync(CACHE_META_PATH) && existsSync(CACHE_WAV_PATH)) {
    try {
      const meta: CachedMeta = JSON.parse(readFileSync(CACHE_META_PATH, 'utf-8'));
      if (meta.scriptHash === SCRIPT_HASH) {
        return { meta, wavPath: CACHE_WAV_PATH };
      }
    } catch {
      // Cache corrupted, regenerate
    }
  }

  // Generate TTS via Cartesia REST API
  const apiKey = process.env.CARTESIA_API_KEY;
  if (!apiKey) {
    console.error('[intro-audio] Cartesia not configured');
    return null;
  }

  try {
    const response = await fetch(
      'https://api.cartesia.ai/tts/bytes',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Cartesia-Version': '2025-04-16',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model_id: TTS_MODEL,
          transcript: FULL_SCRIPT,
          voice: { mode: 'id', id: DEFAULT_VOICE_ID },
          language: 'en',
          output_format: {
            container: 'raw',
            encoding: 'pcm_s16le',
            sample_rate: 24000,
          },
          generation_config: { speed: TTS_SPEED, emotion: TTS_EMOTION },
        }),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[intro-audio] Cartesia error:', response.status, errorText);
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    const pcmBuffer = Buffer.from(arrayBuffer);
    const wavBuffer = pcmToWav(pcmBuffer);

    // PCM 24kHz 16-bit mono = 48000 bytes/sec
    const bytesPerSecond = SAMPLE_RATE * (BITS_PER_SAMPLE / 8);
    const totalDurationMs = Math.round((pcmBuffer.length / bytesPerSecond) * 1000);
    const segments = computeSegmentTimings(totalDurationMs);

    // Cache to filesystem
    if (!existsSync(CACHE_DIR)) {
      mkdirSync(CACHE_DIR, { recursive: true });
    }
    writeFileSync(CACHE_PCM_PATH, pcmBuffer);
    writeFileSync(CACHE_WAV_PATH, wavBuffer);
    const meta: CachedMeta = { scriptHash: SCRIPT_HASH, totalDurationMs, segments };
    writeFileSync(CACHE_META_PATH, JSON.stringify(meta, null, 2));

    return { meta, wavPath: CACHE_WAV_PATH };
  } catch (err) {
    console.error('[intro-audio] Generation error:', err);
    return null;
  }
}

export async function introAudioRoute(app: FastifyInstance) {
  // JSON metadata: segments + timing (authenticated)
  app.get('/intro-audio', async (_request, reply) => {
    app.log.info('[intro-audio] GET /intro-audio — metadata request');
    const result = await ensureAudioCached();
    if (!result) {
      app.log.error('[intro-audio] ensureAudioCached returned null — audio generation failed');
      return reply.code(500).send({ error: 'Failed to generate intro audio' });
    }
    app.log.info(`[intro-audio] Returning metadata: ${result.meta.segments.length} segments, ${result.meta.totalDurationMs}ms total`);
    return reply.send({ segments: result.meta.segments, totalDurationMs: result.meta.totalDurationMs });
  });

  // WAV binary stream (public — same audio for all users)
  app.get('/intro-audio/stream', async (_request, reply) => {
    app.log.info('[intro-audio] GET /intro-audio/stream — audio stream request');
    const result = await ensureAudioCached();
    if (!result) {
      app.log.error('[intro-audio] ensureAudioCached returned null — cannot serve stream');
      return reply.code(500).send({ error: 'Failed to generate intro audio' });
    }
    const wavBuffer = readFileSync(result.wavPath);
    app.log.info(`[intro-audio] Serving WAV: ${wavBuffer.length} bytes from ${result.wavPath}`);
    return reply
      .header('Content-Type', 'audio/wav')
      .header('Content-Length', wavBuffer.length)
      .header('Cache-Control', 'public, max-age=86400')
      .send(wavBuffer);
  });
}
