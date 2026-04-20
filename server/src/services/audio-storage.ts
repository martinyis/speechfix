/**
 * Tiny abstraction over audio file storage. Local FS for dev.
 * Swap to R2/S3 in prod by implementing the same interface.
 *
 * Paths stored in `sessions.audio_path` are relative (e.g. "42/1234.ogg").
 * The backend resolves them to absolute paths via AUDIO_ROOT.
 */

import { createReadStream, type ReadStream } from 'node:fs';
import { mkdir, rename, stat, unlink } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

const AUDIO_ROOT = resolve(process.env.AUDIO_ROOT || './audio');

export interface AudioStorage {
  /** Save a file at a given relative path. Source path must exist and will be moved (not copied). */
  save(sourcePath: string, relativePath: string): Promise<void>;
  /** Create a readable stream for the file at relativePath. Supports Range via { start, end }. */
  createReadStream(relativePath: string, range?: { start: number; end?: number }): Promise<ReadStream>;
  /** File size in bytes; null if missing. */
  size(relativePath: string): Promise<number | null>;
  /** Delete the file. No error if missing. */
  remove(relativePath: string): Promise<void>;
  /** Resolve a relative path to its absolute FS location (dev-only; may throw in cloud impl). */
  resolvePath(relativePath: string): string;
}

/** Local filesystem implementation. */
class LocalFsAudioStorage implements AudioStorage {
  resolvePath(relativePath: string): string {
    // Protect against path traversal
    const abs = resolve(AUDIO_ROOT, relativePath);
    if (!abs.startsWith(AUDIO_ROOT)) {
      throw new Error(`Invalid relative path: ${relativePath}`);
    }
    return abs;
  }

  async save(sourcePath: string, relativePath: string): Promise<void> {
    const dest = this.resolvePath(relativePath);
    await mkdir(dirname(dest), { recursive: true });
    await rename(sourcePath, dest);
  }

  async createReadStream(relativePath: string, range?: { start: number; end?: number }): Promise<ReadStream> {
    const abs = this.resolvePath(relativePath);
    return createReadStream(abs, range);
  }

  async size(relativePath: string): Promise<number | null> {
    try {
      const abs = this.resolvePath(relativePath);
      const s = await stat(abs);
      return s.size;
    } catch {
      return null;
    }
  }

  async remove(relativePath: string): Promise<void> {
    try {
      const abs = this.resolvePath(relativePath);
      await unlink(abs);
    } catch {
      // Swallow — file may not exist
    }
  }
}

export const audioStorage: AudioStorage = new LocalFsAudioStorage();

/**
 * Build the relative path for a session's audio file.
 * Convention: `{userId}/{sessionId}.ogg`
 */
export function buildSessionAudioPath(userId: number, sessionId: number): string {
  return join(String(userId), `${sessionId}.ogg`);
}

/**
 * Build the relative path for a session's raw M4A upload (hi-fi capture).
 * Convention: `{userId}/{sessionId}.m4a`
 */
export function buildSessionRawPath(userId: number, sessionId: number): string {
  return join(String(userId), `${sessionId}.m4a`);
}
