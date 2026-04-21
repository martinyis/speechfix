/**
 * Deterministic scoring for post-session results.
 *
 * Two scores are computed from raw metrics (no LLM):
 *  - Delivery score   — "how you sounded" (pronunciation, pace, expression, steadiness, flow)
 *  - Language score   — "what you said" (grammar errors, filler density, patterns)
 *
 * Both return `null` when the session is too short or lacks data to score fairly.
 */

import type { Correction, SpeechPattern } from '../../analysis/types.js';
import type { SpeechTimeline } from '../voice/speech-types.js';

// --- Thresholds ---
const MIN_WORDS = 15;
const MIN_DURATION_SECONDS = 10;

// Target conversational pace band (WPM)
const WPM_BAND_LOW = 110;
const WPM_BAND_HIGH = 160;
const WPM_FALLOFF = 60; // distance (wpm) beyond which pace component = 0

// --- Delivery weights (sum to 1.0) ---
const W_PRONUNCIATION = 0.30;
const W_PACE = 0.20;
const W_EXPRESSION = 0.20;
const W_STEADINESS = 0.15;
const W_FLOW = 0.15;

// Expression: map pitchAssessment → score
const PITCH_SCORE: Record<SpeechTimeline['pitchAssessment'], number> = {
  monotone: 40,
  limited: 60,
  varied: 85,
  expressive: 95,
};

// --- Language deductions ---
const DEDUCT_ERROR = 5;
const CAP_ERROR = 40;
const DEDUCT_IMPROVEMENT = 2;
const CAP_IMPROVEMENT = 20;
const DEDUCT_POLISH = 1;
const CAP_POLISH = 10;
const DEDUCT_PER_FILLER_ABOVE_THRESHOLD = 2;
const FILLER_THRESHOLD_PER_MIN = 3;
const CAP_FILLER = 15;
const DEDUCT_PATTERN = 2;
const CAP_PATTERN = 10;

/** Clamp value to [0, 100] and round to nearest int. */
function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

/**
 * Compute Delivery score from speech timeline.
 *
 * Weights:
 *  - Pronunciation 30% — avgConfidence * 100
 *  - Pace 20%         — per-utterance smoothed fit to 110-160 WPM band
 *  - Expression 20%   — pitchAssessment lookup (skipped + reweighted if pitchVariation === 0)
 *  - Steadiness 15%   — volumeConsistency * 100
 *  - Flow 15%         — starts at 100, deducts for long/average pauses and low speech ratio
 *
 * Returns null if no timeline or session too short.
 */
export function computeDeliveryScore(
  timeline: SpeechTimeline | undefined,
  durationSeconds: number,
  totalWords: number,
): number | null {
  if (!timeline) return null;
  if (totalWords < MIN_WORDS) return null;
  if (durationSeconds < MIN_DURATION_SECONDS) return null;

  // Pronunciation 0..100
  const pronunciation = clampScore(timeline.avgConfidence * 100);

  // Pace: fit each utterance's WPM to target band, smoothed falloff
  const wpmValues = timeline.utterances.map(u => u.wpm).filter(w => w > 0);
  let pace = 0;
  if (wpmValues.length > 0) {
    const fits = wpmValues.map(wpm => {
      if (wpm >= WPM_BAND_LOW && wpm <= WPM_BAND_HIGH) return 1;
      const dist = wpm < WPM_BAND_LOW ? WPM_BAND_LOW - wpm : wpm - WPM_BAND_HIGH;
      return Math.max(0, 1 - dist / WPM_FALLOFF);
    });
    const avgFit = fits.reduce((s, v) => s + v, 0) / fits.length;
    pace = clampScore(avgFit * 100);
  }

  // Expression: pitch-based. Skip + reweight if pitch data unavailable.
  const hasPitch = timeline.pitchVariation > 0;
  const expression = hasPitch ? PITCH_SCORE[timeline.pitchAssessment] : 0;

  // Steadiness 0..100
  const steadiness = clampScore(timeline.volumeConsistency * 100);

  // Flow: start at 100, apply deductions
  let flow = 100;
  if (timeline.longestPauseMs > 2500) {
    flow -= Math.min(25, (timeline.longestPauseMs - 2500) / 100); // smooth-ish
  }
  if (timeline.avgPauseDurationMs > 800) {
    flow -= Math.min(15, (timeline.avgPauseDurationMs - 800) / 50);
  }
  // Normal conversation speech-to-silence ratio is ~0.25-0.5.
  // Below 0.15 suggests halting delivery.
  if (timeline.speechToSilenceRatio < 0.15) {
    flow -= (0.15 - timeline.speechToSilenceRatio) * 200; // 0.05 under → -10
  }
  flow = clampScore(flow);

  // Weighted sum, reweighting if expression is skipped
  let total: number;
  if (hasPitch) {
    total =
      pronunciation * W_PRONUNCIATION +
      pace * W_PACE +
      expression * W_EXPRESSION +
      steadiness * W_STEADINESS +
      flow * W_FLOW;
  } else {
    // Reweight the remaining 4 components proportionally to fill the 20% Expression slot
    const remaining = W_PRONUNCIATION + W_PACE + W_STEADINESS + W_FLOW;
    total =
      (pronunciation * W_PRONUNCIATION +
        pace * W_PACE +
        steadiness * W_STEADINESS +
        flow * W_FLOW) / remaining;
  }

  return clampScore(total);
}

/**
 * Compute Language score from corrections, fillers, and patterns.
 *
 * Starts at 100, deducts:
 *  - Errors       −5 each (cap −40)
 *  - Improvements −2 each (cap −20)
 *  - Polish       −1 each (cap −10)
 *  - Filler density above 3/min: −2 per excess filler/min (cap −15)
 *  - Pattern flags: −2 each (cap −10). Pass empty/undefined to skip this component.
 *
 * Returns null on empty sessions (no transcripts / too short).
 */
export function computeLanguageScore(
  corrections: Correction[],
  fillersPerMinute: number,
  patterns: SpeechPattern[] | undefined,
  durationSeconds: number,
  totalWords: number,
): number | null {
  if (totalWords === 0) return null;
  if (totalWords < MIN_WORDS) return null;
  if (durationSeconds < MIN_DURATION_SECONDS) return null;

  const errors = corrections.filter(c => c.severity === 'error').length;
  const improvements = corrections.filter(c => c.severity === 'improvement').length;
  const polish = corrections.filter(c => c.severity === 'polish').length;

  let score = 100;
  score -= Math.min(CAP_ERROR, errors * DEDUCT_ERROR);
  score -= Math.min(CAP_IMPROVEMENT, improvements * DEDUCT_IMPROVEMENT);
  score -= Math.min(CAP_POLISH, polish * DEDUCT_POLISH);

  const fillerExcess = Math.max(0, fillersPerMinute - FILLER_THRESHOLD_PER_MIN);
  score -= Math.min(CAP_FILLER, fillerExcess * DEDUCT_PER_FILLER_ABOVE_THRESHOLD);

  if (patterns && patterns.length > 0) {
    const flagCount = patterns.filter(
      p => p.type === 'hedging' || p.type === 'repetitive_starter' || p.type === 'overused_word',
    ).length;
    score -= Math.min(CAP_PATTERN, flagCount * DEDUCT_PATTERN);
  }

  return clampScore(score);
}
