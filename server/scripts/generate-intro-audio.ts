import 'dotenv/config';
import WebSocket from 'ws';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import { pcmToWav } from '../src/shared/audio/wav.js';
import {
  DEFAULT_VOICE_ID,
  TTS_MODEL,
  TTS_SPEED,
  TTS_EMOTION,
} from '../src/modules/voice/voice-config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..', '..');
const MOBILE_WAV_PATH = join(REPO_ROOT, 'mobile/assets/sounds/intro.wav');
const MOBILE_TS_PATH = join(REPO_ROOT, 'mobile/lib/introTimestamps.ts');

const FULL_SCRIPT =
  "What if your biggest speech habits are the ones no one's ever mentioned? I find them, and turn them into practice. Welcome to Reflexa — tap below.";

// Segment boundaries defined by word-index starts (inclusive start, exclusive next-start)
const SEGMENT_STARTS = [
  { idx: 0, label: 'What if your biggest speech habits' },
  { idx: 6, label: "are the ones no one's ever mentioned?" },
  { idx: 13, label: 'I find them, and turn them into practice.' },
  { idx: 21, label: 'Welcome to Reflexa — tap below.' },
];

interface WordTiming {
  word: string;
  startMs: number;
  endMs: number;
}

async function main() {
  const apiKey = process.env.CARTESIA_API_KEY;
  if (!apiKey) {
    console.error('CARTESIA_API_KEY not set in environment');
    process.exit(1);
  }

  console.log('[intro-gen] Connecting to Cartesia WebSocket…');
  const wsParams = new URLSearchParams({
    api_key: apiKey,
    cartesia_version: '2025-04-16',
  });
  const ws = new WebSocket(
    `wss://api.cartesia.ai/tts/websocket?${wsParams.toString()}`,
  );

  const pcmChunks: Buffer[] = [];
  const wordTimings: WordTiming[] = [];
  const contextId = randomUUID();

  await new Promise<void>((resolve, reject) => {
    ws.on('open', () => {
      console.log('[intro-gen] Connected. Sending generation request…');
      ws.send(
        JSON.stringify({
          model_id: TTS_MODEL,
          transcript: FULL_SCRIPT,
          voice: { mode: 'id', id: DEFAULT_VOICE_ID },
          output_format: {
            container: 'raw',
            encoding: 'pcm_s16le',
            sample_rate: 24000,
          },
          context_id: contextId,
          continue: false,
          language: 'en',
          generation_config: { speed: TTS_SPEED, emotion: TTS_EMOTION },
          add_timestamps: true,
        }),
      );
    });

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.context_id && msg.context_id !== contextId) return;

        if (msg.type === 'chunk' && msg.data) {
          pcmChunks.push(Buffer.from(msg.data, 'base64'));
        } else if (msg.type === 'timestamps' && msg.word_timestamps) {
          const { words, start, end } = msg.word_timestamps as {
            words: string[];
            start: number[];
            end: number[];
          };
          for (let i = 0; i < words.length; i++) {
            wordTimings.push({
              word: words[i],
              startMs: Math.round(start[i] * 1000),
              endMs: Math.round(end[i] * 1000),
            });
          }
        } else if (msg.type === 'done') {
          console.log('[intro-gen] Received done from Cartesia');
          ws.close();
          resolve();
        } else if (msg.type === 'error') {
          reject(
            new Error(`Cartesia error: ${JSON.stringify(msg.error || msg)}`),
          );
        }
      } catch (err) {
        console.error('[intro-gen] Message parse error:', err);
      }
    });

    ws.on('error', (err) => reject(err));
    ws.on('close', () => {
      // If we closed without seeing 'done', treat as normal completion if we got data
      if (pcmChunks.length > 0) resolve();
    });
  });

  console.log(
    `[intro-gen] Collected ${pcmChunks.length} audio chunks, ${wordTimings.length} word timings`,
  );

  if (pcmChunks.length === 0) {
    throw new Error('No audio chunks received from Cartesia');
  }
  if (wordTimings.length === 0) {
    throw new Error(
      'No word timestamps received — check add_timestamps support for this model',
    );
  }

  const pcmBuffer = Buffer.concat(pcmChunks);
  const wavBuffer = pcmToWav(pcmBuffer);
  const durationMs = Math.round((pcmBuffer.length / (24000 * 2)) * 1000);
  console.log(
    `[intro-gen] Total audio: ${durationMs}ms (${pcmBuffer.length} bytes PCM, ${wavBuffer.length} bytes WAV)`,
  );

  // Write WAV to mobile bundled assets
  if (!existsSync(dirname(MOBILE_WAV_PATH))) {
    mkdirSync(dirname(MOBILE_WAV_PATH), { recursive: true });
  }
  writeFileSync(MOBILE_WAV_PATH, wavBuffer);
  console.log(`[intro-gen] Wrote ${MOBILE_WAV_PATH}`);

  // Group word timings into segments by word-index boundaries
  const segmentGroups: WordTiming[][] = SEGMENT_STARTS.map(() => []);
  for (let wi = 0; wi < wordTimings.length; wi++) {
    let segIdx = 0;
    for (let s = SEGMENT_STARTS.length - 1; s >= 0; s--) {
      if (wi >= SEGMENT_STARTS[s].idx) {
        segIdx = s;
        break;
      }
    }
    segmentGroups[segIdx].push(wordTimings[wi]);
  }

  console.log('[intro-gen] Segment breakdown:');
  segmentGroups.forEach((words, i) => {
    console.log(
      `  S${i} (${words.length} words): ${words.map((w) => w.word).join(' ')}`,
    );
  });

  // Generate introTimestamps.ts
  const segmentsJson = segmentGroups.map((words, idx) => ({
    segmentIndex: idx,
    words,
  }));

  const tsContent = `export interface WordTiming {
  word: string;
  startMs: number;
  endMs: number;
}

export interface SegmentTimings {
  segmentIndex: number;
  words: WordTiming[];
}

export const INTRO_SEGMENTS: SegmentTimings[] = ${JSON.stringify(segmentsJson, null, 2)};

export const ALL_WORDS: WordTiming[] = INTRO_SEGMENTS.flatMap(s => s.words);
`;

  writeFileSync(MOBILE_TS_PATH, tsContent);
  console.log(`[intro-gen] Wrote ${MOBILE_TS_PATH}`);

  console.log(
    `\n[intro-gen] Done. ${wordTimings.length} words, ${durationMs}ms audio, ${segmentGroups.length} segments.`,
  );
  process.exit(0);
}

main().catch((err) => {
  console.error('[intro-gen] FATAL:', err);
  process.exit(1);
});
