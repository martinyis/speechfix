/**
 * Encodes raw PCM audio (16-bit little-endian, 16kHz mono) to Ogg Opus.
 * Shells out to system ffmpeg — keep deps minimal, no npm wrapper.
 *
 * Target: ~64kbps Opus, general "audio" profile (not the telephony-grade
 * "voip" profile which mangles timbre at low bitrates). ~480KB/minute.
 */

import { spawn } from 'node:child_process';

export interface EncodeOptions {
  inputPcmPath: string;    // raw PCM file path
  outputOggPath: string;   // destination Ogg Opus file
  sampleRate?: number;     // default 16000
  bitrate?: string;        // default "64k"
}

/**
 * Encode a raw PCM file to Ogg Opus. Resolves when encoding completes.
 * Rejects if ffmpeg exits non-zero or is not installed.
 */
export function encodePcmToOpus(opts: EncodeOptions): Promise<void> {
  const sampleRate = opts.sampleRate ?? 16000;
  const bitrate = opts.bitrate ?? '64k';

  return new Promise((resolvePromise, rejectPromise) => {
    // ffmpeg -f s16le -ar 16000 -ac 1 -i input.pcm -c:a libopus -b:a 64k -application audio output.ogg
    const args = [
      '-hide_banner',
      '-loglevel', 'error',
      '-f', 's16le',            // input format: signed 16-bit little-endian
      '-ar', String(sampleRate), // input sample rate
      '-ac', '1',                // mono
      '-i', opts.inputPcmPath,
      '-c:a', 'libopus',
      '-b:a', bitrate,
      '-application', 'audio',   // general-audio profile: avoids the VoIP
                                 // codec's aggressive speech modeling that
                                 // produces telephony-style artifacts
      '-y',                      // overwrite output if exists
      opts.outputOggPath,
    ];

    const proc = spawn('ffmpeg', args);

    let stderr = '';
    proc.stderr?.on('data', (chunk) => { stderr += chunk.toString(); });

    proc.on('error', (err) => {
      rejectPromise(new Error(`ffmpeg spawn failed: ${err.message}`));
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolvePromise();
      } else {
        rejectPromise(new Error(`ffmpeg exited with code ${code}: ${stderr.trim()}`));
      }
    });
  });
}

/** Quick check that ffmpeg is available at startup. */
export async function checkFfmpegAvailable(): Promise<boolean> {
  return new Promise((resolvePromise) => {
    const proc = spawn('ffmpeg', ['-version']);
    proc.on('error', () => resolvePromise(false));
    proc.on('close', (code) => resolvePromise(code === 0));
  });
}

/**
 * Encode a client-uploaded M4A (48kHz AAC) to Ogg Opus, optionally trimming
 * to only the provided utterance segments (in SECONDS of the input file) with
 * short per-segment fades to avoid click artifacts at splice boundaries.
 *
 * If `segments` is empty or undefined, the whole file is encoded.
 *
 * Uses `-filter_complex` with per-segment atrim+asetpts+afade chains fed into
 * a final `concat` filter. Avoids `aselect` (timestamp discontinuities break
 * Ogg muxing).
 */
export interface EncodeM4aOptions {
  inputM4aPath: string;
  outputOggPath: string;
  /** Utterance segments in seconds; trimmed if provided. */
  segments?: Array<{ start: number; end: number }>;
  /** Output Opus bitrate, default 96k (sounds like voice memo at 48kHz). */
  bitrate?: string;
  /** Per-edge fade duration in seconds, default 0.008 (8ms). */
  fadeSec?: number;
}

export function encodeM4aToOpusWithTrim(opts: EncodeM4aOptions): Promise<void> {
  const bitrate = opts.bitrate ?? '96k';
  const fadeSec = opts.fadeSec ?? 0.008;
  const segments = (opts.segments ?? []).filter((s) => s.end > s.start);

  return new Promise((resolvePromise, rejectPromise) => {
    const args: string[] = [
      '-hide_banner',
      '-loglevel', 'error',
      '-i', opts.inputM4aPath,
    ];

    if (segments.length > 0) {
      // Build per-segment filter: atrim, reset PTS, apply in+out fades
      // relative to the segment duration. Then concat all segments on audio.
      const filterChains: string[] = [];
      const concatInputs: string[] = [];
      segments.forEach((seg, i) => {
        const dur = Math.max(0, seg.end - seg.start);
        // Clip fade to at most half segment duration so fade-in and fade-out
        // don't overlap on very short segments.
        const fade = Math.min(fadeSec, dur / 2);
        const fadeOutStart = Math.max(0, dur - fade);
        filterChains.push(
          `[0:a]atrim=start=${seg.start}:end=${seg.end},` +
          `asetpts=PTS-STARTPTS,` +
          `afade=t=in:st=0:d=${fade.toFixed(4)},` +
          `afade=t=out:st=${fadeOutStart.toFixed(4)}:d=${fade.toFixed(4)}[s${i}]`
        );
        concatInputs.push(`[s${i}]`);
      });
      const concat = `${concatInputs.join('')}concat=n=${segments.length}:v=0:a=1[out]`;
      const fullFilter = [...filterChains, concat].join(';');
      args.push('-filter_complex', fullFilter, '-map', '[out]');
    }

    args.push(
      '-c:a', 'libopus',
      '-b:a', bitrate,
      '-ar', '48000',
      '-ac', '1',
      '-application', 'audio',
      '-y',
      opts.outputOggPath,
    );

    const proc = spawn('ffmpeg', args);
    let stderr = '';
    proc.stderr?.on('data', (chunk) => { stderr += chunk.toString(); });
    proc.on('error', (err) => rejectPromise(new Error(`ffmpeg spawn failed: ${err.message}`)));
    proc.on('close', (code) => {
      if (code === 0) resolvePromise();
      else rejectPromise(new Error(`ffmpeg exited ${code}: ${stderr.trim()}`));
    });
  });
}
