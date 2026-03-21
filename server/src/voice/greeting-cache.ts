/**
 * Loads pre-generated greeting audio from disk.
 * Audio files are created once via: npx tsx scripts/generate-greetings.ts
 * No API calls at runtime — just reads PCM files from assets/greetings/.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

/** ~100ms of PCM 16kHz 16-bit mono */
const CHUNK_SIZE_BYTES = 3200;

interface CachedGreeting {
  text: string;
  audioChunks: string[];
  totalAudioBytes: number;
}

let greetingCache: CachedGreeting[] = [];
let cacheReady = false;

const ASSETS_DIR = join(import.meta.dirname, '../../assets/greetings');

export async function initGreetingCache(): Promise<void> {
  const metadataPath = join(ASSETS_DIR, 'metadata.json');

  if (!existsSync(metadataPath)) {
    console.warn('[greeting-cache] No greeting files found. Run: npx tsx scripts/generate-greetings.ts');
    return;
  }

  try {
    const metadata: { index: number; text: string; file: string }[] =
      JSON.parse(readFileSync(metadataPath, 'utf-8'));

    const results: CachedGreeting[] = [];

    for (const entry of metadata) {
      const pcmPath = join(ASSETS_DIR, entry.file);
      if (!existsSync(pcmPath)) {
        console.warn(`[greeting-cache] Missing file: ${entry.file}, skipping`);
        continue;
      }

      const pcmBuffer = readFileSync(pcmPath);
      const audioChunks: string[] = [];
      for (let offset = 0; offset < pcmBuffer.length; offset += CHUNK_SIZE_BYTES) {
        const end = Math.min(offset + CHUNK_SIZE_BYTES, pcmBuffer.length);
        audioChunks.push(pcmBuffer.subarray(offset, end).toString('base64'));
      }

      results.push({
        text: entry.text,
        audioChunks,
        totalAudioBytes: pcmBuffer.length,
      });
    }

    if (results.length > 0) {
      greetingCache = results;
      cacheReady = true;
      console.log(`[greeting-cache] Loaded ${results.length} greetings from disk`);
    }
  } catch (err) {
    console.error('[greeting-cache] Failed to load greetings:', err);
  }
}

export function getRandomGreeting(): CachedGreeting | null {
  if (!cacheReady || greetingCache.length === 0) return null;
  return greetingCache[Math.floor(Math.random() * greetingCache.length)];
}
