/**
 * Enriches filler positions with absolute timestamps by cross-referencing
 * the Deepgram word-level timings in UtteranceMetadata.
 *
 * Filler positions come from the LLM analyzer as {sentenceIndex, word, startIndex}
 * where startIndex is a character offset in the sentence. This helper maps each
 * position to an absolute `timeSeconds` value from the start of the session.
 */

import type { FillerWordPosition } from '../analysis/types.js';
import type { UtteranceMetadata } from '../voice/speech-types.js';

/**
 * Given filler positions + utterance metadata with word timings, return the
 * positions with `timeSeconds` populated where possible. Leaves timeSeconds
 * undefined when no timing match is found.
 */
export function enrichFillerTimestamps(
  positions: FillerWordPosition[],
  utterances: UtteranceMetadata[] | undefined,
): FillerWordPosition[] {
  if (!utterances || utterances.length === 0) return positions;

  return positions.map(pos => {
    const utt = utterances[pos.sentenceIndex];
    if (!utt || utt.words.length === 0) return pos;

    // Walk utterance words, compute running char offset (words joined by single space).
    // Find the word whose character range contains or is closest to pos.startIndex
    // AND whose text matches the filler word (case-insensitive, punctuation-stripped).
    const targetWord = normalizeWord(pos.word);
    let charOffset = 0;
    let bestMatch: { timeSeconds: number; delta: number } | null = null;

    for (const w of utt.words) {
      const wLen = w.word.length;
      const wNorm = normalizeWord(w.word);
      // The filler might be a single token or a multi-token phrase like "you know".
      // For simple case: match if normalized word equals first token of filler.
      const fillerFirstToken = targetWord.split(' ')[0];
      if (wNorm === fillerFirstToken) {
        const delta = Math.abs(charOffset - pos.startIndex);
        if (!bestMatch || delta < bestMatch.delta) {
          bestMatch = { timeSeconds: w.start, delta };
        }
      }
      charOffset += wLen + 1; // +1 for the space joining words
    }

    if (bestMatch) {
      return { ...pos, timeSeconds: Math.round(bestMatch.timeSeconds * 100) / 100 };
    }
    return pos;
  });
}

function normalizeWord(w: string): string {
  return w.toLowerCase().replace(/[^\w\s]/g, '').trim();
}
