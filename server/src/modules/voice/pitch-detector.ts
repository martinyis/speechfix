/**
 * YIN pitch detection algorithm for 16-bit PCM audio.
 * Returns estimated fundamental frequency (F0) in Hz, or null if unvoiced.
 *
 * Reference: de Cheveigné & Kawahara (2002), "YIN, a fundamental frequency estimator for speech and music"
 */

const DEFAULT_SAMPLE_RATE = 16000;
const YIN_THRESHOLD = 0.15;
const MIN_F0 = 60;   // Hz — lowest pitch to detect
const MAX_F0 = 500;  // Hz — highest pitch to detect

export interface PitchResult {
  f0: number | null;   // Hz, or null if unvoiced
  confidence: number;  // 0-1, higher = more confident
}

/**
 * Detect pitch from a 16-bit PCM buffer using the YIN algorithm.
 * Expects mono audio at the given sample rate.
 */
export function detectPitch(
  pcmBuffer: Buffer,
  sampleRate: number = DEFAULT_SAMPLE_RATE,
): PitchResult {
  const samples = new Int16Array(
    pcmBuffer.buffer,
    pcmBuffer.byteOffset,
    pcmBuffer.length / 2,
  );

  const numSamples = samples.length;
  if (numSamples < 2) return { f0: null, confidence: 0 };

  // Convert lag range from frequency range
  const minLag = Math.floor(sampleRate / MAX_F0);
  const maxLag = Math.ceil(sampleRate / MIN_F0);
  const tauMax = Math.min(maxLag, Math.floor(numSamples / 2));

  if (tauMax <= minLag) return { f0: null, confidence: 0 };

  // Step 1 & 2: Difference function
  const diff = new Float64Array(tauMax);
  for (let tau = 1; tau < tauMax; tau++) {
    let sum = 0;
    for (let i = 0; i < tauMax; i++) {
      const d = samples[i] - samples[i + tau];
      sum += d * d;
    }
    diff[tau] = sum;
  }

  // Step 3: Cumulative mean normalized difference function (CMNDF)
  const cmndf = new Float64Array(tauMax);
  cmndf[0] = 1;
  let runningSum = 0;
  for (let tau = 1; tau < tauMax; tau++) {
    runningSum += diff[tau];
    cmndf[tau] = runningSum > 0 ? (diff[tau] * tau) / runningSum : 1;
  }

  // Step 4: Absolute threshold — find the first dip below threshold
  let bestTau = -1;
  for (let tau = minLag; tau < tauMax - 1; tau++) {
    if (cmndf[tau] < YIN_THRESHOLD) {
      // Find the local minimum in this dip
      while (tau + 1 < tauMax && cmndf[tau + 1] < cmndf[tau]) {
        tau++;
      }
      bestTau = tau;
      break;
    }
  }

  // No pitch found below threshold — try global minimum as fallback
  if (bestTau === -1) {
    let minVal = Infinity;
    for (let tau = minLag; tau < tauMax; tau++) {
      if (cmndf[tau] < minVal) {
        minVal = cmndf[tau];
        bestTau = tau;
      }
    }
    // Only accept if reasonably periodic
    if (minVal > 0.5) return { f0: null, confidence: 0 };
  }

  // Step 5: Parabolic interpolation for sub-sample accuracy
  const refinedTau = parabolicInterpolation(cmndf, bestTau);
  const confidence = 1 - cmndf[bestTau];
  const f0 = sampleRate / refinedTau;

  // Sanity check
  if (f0 < MIN_F0 || f0 > MAX_F0 || !isFinite(f0)) {
    return { f0: null, confidence: 0 };
  }

  return { f0: Math.round(f0 * 10) / 10, confidence: Math.max(0, Math.min(1, confidence)) };
}

function parabolicInterpolation(data: Float64Array, index: number): number {
  if (index <= 0 || index >= data.length - 1) return index;

  const s0 = data[index - 1];
  const s1 = data[index];
  const s2 = data[index + 1];

  const denominator = 2 * (2 * s1 - s2 - s0);
  if (Math.abs(denominator) < 1e-10) return index;

  const adjustment = (s2 - s0) / denominator;
  return index + adjustment;
}

/**
 * Accumulator that buffers PCM chunks and runs pitch detection every N ms.
 * Designed for streaming audio at 100ms chunk intervals.
 */
export class PitchAccumulator {
  private buffer: Buffer = Buffer.alloc(0);
  private sampleRate: number;
  private analysisIntervalChunks: number;
  private chunkCount = 0;

  constructor(sampleRate = DEFAULT_SAMPLE_RATE, analysisIntervalMs = 200) {
    this.sampleRate = sampleRate;
    // At 100ms chunks, analysisIntervalMs=200 means every 2 chunks
    this.analysisIntervalChunks = Math.max(1, Math.round(analysisIntervalMs / 100));
  }

  /**
   * Add a PCM chunk. Returns a PitchResult every analysisIntervalChunks, null otherwise.
   */
  addChunk(pcmBuffer: Buffer): PitchResult | null {
    this.buffer = Buffer.concat([this.buffer, pcmBuffer]);
    this.chunkCount++;

    if (this.chunkCount % this.analysisIntervalChunks !== 0) return null;

    // Analyze accumulated buffer
    const result = detectPitch(this.buffer, this.sampleRate);
    this.buffer = Buffer.alloc(0); // Reset
    return result;
  }

  reset() {
    this.buffer = Buffer.alloc(0);
    this.chunkCount = 0;
  }
}
