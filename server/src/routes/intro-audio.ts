import { FastifyInstance } from 'fastify';
import { createHash } from 'crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

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
  "Let's set things up.",
];

const FULL_SCRIPT = INTRO_SEGMENTS.join(' ');
const SCRIPT_HASH = createHash('md5').update(FULL_SCRIPT).digest('hex');

const SAMPLE_RATE = 24000;
const BITS_PER_SAMPLE = 16;
const NUM_CHANNELS = 1;

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

/** Wrap raw PCM data in a WAV header */
function pcmToWav(pcmBuffer: Buffer): Buffer {
  const byteRate = SAMPLE_RATE * NUM_CHANNELS * (BITS_PER_SAMPLE / 8);
  const blockAlign = NUM_CHANNELS * (BITS_PER_SAMPLE / 8);
  const dataSize = pcmBuffer.length;
  const headerSize = 44;

  const wav = Buffer.alloc(headerSize + dataSize);

  // RIFF header
  wav.write('RIFF', 0);
  wav.writeUInt32LE(36 + dataSize, 4); // file size - 8
  wav.write('WAVE', 8);

  // fmt chunk
  wav.write('fmt ', 12);
  wav.writeUInt32LE(16, 16);           // chunk size
  wav.writeUInt16LE(1, 20);            // PCM format
  wav.writeUInt16LE(NUM_CHANNELS, 22);
  wav.writeUInt32LE(SAMPLE_RATE, 24);
  wav.writeUInt32LE(byteRate, 28);
  wav.writeUInt16LE(blockAlign, 32);
  wav.writeUInt16LE(BITS_PER_SAMPLE, 34);

  // data chunk
  wav.write('data', 36);
  wav.writeUInt32LE(dataSize, 40);
  pcmBuffer.copy(wav, headerSize);

  return wav;
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

  // Generate TTS via ElevenLabs REST API
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID;
  if (!apiKey || !voiceId) {
    console.error('[intro-audio] ElevenLabs not configured');
    return null;
  }

  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=pcm_24000`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: FULL_SCRIPT,
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            speed: 1.0,
          },
        }),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[intro-audio] ElevenLabs error:', response.status, errorText);
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
    const result = await ensureAudioCached();
    if (!result) {
      return reply.code(500).send({ error: 'Failed to generate intro audio' });
    }
    return reply.send({ segments: result.meta.segments, totalDurationMs: result.meta.totalDurationMs });
  });

  // WAV binary stream (public — same audio for all users)
  app.get('/intro-audio/stream', async (_request, reply) => {
    const result = await ensureAudioCached();
    if (!result) {
      return reply.code(500).send({ error: 'Failed to generate intro audio' });
    }
    const wavBuffer = readFileSync(result.wavPath);
    return reply
      .header('Content-Type', 'audio/wav')
      .header('Content-Length', wavBuffer.length)
      .header('Cache-Control', 'public, max-age=86400')
      .send(wavBuffer);
  });
}
