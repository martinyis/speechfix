/**
 * Real-time filler detector.
 *
 * Consumes Deepgram transcript fragments word-by-word and emits filler
 * detections with a haptic throttle. Caller (drill handler) forwards results
 * to the client as `filler_detected` WS events.
 *
 * Detects two tiers:
 *   - Obvious fillers: um / uh / er / hmm / mhm (canonical)
 *   - Ambiguous fillers (Option A): like / so / basically / actually, plus
 *     the phrase "you know". These have real meanings and will false-positive
 *     occasionally — accepted trade-off for catching common filler styles.
 */

export interface FillerDetection {
  word: string;             // matched filler text, lowercased (phrase joined by space)
  confidence: number;       // Deepgram word confidence if available, else 1
  atSeconds: number;        // elapsed seconds from session start
  throttled: boolean;       // true => haptic must be suppressed
}

// Obvious fillers — standalone tokens.
const FILLER_REGEX = /^(um+|uh+|u+hh+|hmm+|m+hm+|e+r+)$/i;

// Ambiguous fillers — single words that are also legitimate content but
// function as fillers in pressured monologue. User opted in via Option A.
const AMBIGUOUS_FILLER_REGEX = /^(like|so|basically|actually|literally)$/i;

// Phrase fillers — matched across adjacent word pairs.
const PHRASE_FILLERS: ReadonlyArray<readonly string[]> = [
  ['you', 'know'],
  ['i', 'mean'],
  ['kind', 'of'],
  ['sort', 'of'],
];

// Backchannels / agreement markers — explicitly NOT fillers.
const BACKCHANNEL_REGEX = /^(uh-huh|mm-hmm|mm-hm|uh-uh|mhm)$/i;

function normalize(rawWord: string): string {
  return rawWord.trim().toLowerCase().replace(/[.,?!:;"']/g, '');
}

export function isObviousFiller(rawWord: string): boolean {
  const n = normalize(rawWord);
  if (!n) return false;
  if (BACKCHANNEL_REGEX.test(n)) return false;
  return FILLER_REGEX.test(n);
}

export function isAmbiguousFiller(rawWord: string): boolean {
  const n = normalize(rawWord);
  if (!n) return false;
  return AMBIGUOUS_FILLER_REGEX.test(n);
}

function matchesPhraseAt(words: readonly { word: string }[], i: number): readonly string[] | null {
  const first = normalize(words[i].word);
  for (const phrase of PHRASE_FILLERS) {
    if (phrase[0] !== first) continue;
    if (i + phrase.length > words.length) continue;
    let ok = true;
    for (let k = 1; k < phrase.length; k++) {
      if (normalize(words[i + k].word) !== phrase[k]) { ok = false; break; }
    }
    if (ok) return phrase;
  }
  return null;
}

export interface RealtimeFillerDetectorConfig {
  /** Ms between allowed haptic buzzes. Detections inside this window are
   *  still emitted but throttled=true (mobile suppresses haptic). Default 3000. */
  hapticThrottleMs?: number;
  /** Returns seconds elapsed since session start. Injected so tests can fake clock. */
  getElapsedSeconds: () => number;
  /** Called once per detection. */
  onDetection: (d: FillerDetection) => void;
}

interface WordLike {
  word: string;
  confidence?: number;
  start?: number;
}

export class RealtimeFillerDetector {
  private lastBuzzAtMs = -Infinity;
  private readonly throttleMs: number;
  private readonly getElapsedSeconds: () => number;
  private readonly onDetection: (d: FillerDetection) => void;
  // Deepgram can repeat the same interim word in multiple interim frames. Track
  // the last Deepgram word `start` time we processed so we don't double-count.
  private processedStarts = new Set<number>();

  constructor(cfg: RealtimeFillerDetectorConfig) {
    this.throttleMs = cfg.hapticThrottleMs ?? 3000;
    this.getElapsedSeconds = cfg.getElapsedSeconds;
    this.onDetection = cfg.onDetection;
  }

  /**
   * Feed Deepgram transcript words — interim AND final. Originally this was
   * final-only (interim revisions = false positives) but in practice Deepgram
   * nova-3 STRIPS short fillers (um/uh) between interim and final even with
   * `filler_words: true`. Catching them on interims is the only reliable path.
   *
   * Dedupe by word `start` timestamp ensures the same word arriving in
   * interim then final fires only once.
   *
   * @param words  word list from any transcript event
   */
  processFinalWords(words: WordLike[] | undefined): void {
    if (!words?.length) {
      console.log('[pd-debug:filler-detector] processFinalWords called with 0 words');
      return;
    }
    const nowMs = Date.now();
    const elapsed = this.getElapsedSeconds();

    console.log(
      `[pd-debug:filler-detector] checking ${words.length} words: [${words.map((w) => w.word).join(', ')}]`,
    );

    let i = 0;
    while (i < words.length) {
      const w = words[i];

      // 1) Try phrase match starting at i (e.g., "you know"). Consumes N words.
      const phrase = matchesPhraseAt(words, i);
      if (phrase) {
        const startKey = words[i].start;
        if (startKey != null && this.processedStarts.has(startKey)) {
          console.log(`[pd-debug:filler-detector]   phrase="${phrase.join(' ')}" SKIPPED (dedupe start=${startKey})`);
          i += phrase.length;
          continue;
        }
        if (startKey != null) this.processedStarts.add(startKey);
        console.log(`[pd-debug:filler-detector]   phrase="${phrase.join(' ')}" MATCHED`);

        const throttled = nowMs - this.lastBuzzAtMs < this.throttleMs;
        if (!throttled) this.lastBuzzAtMs = nowMs;

        this.onDetection({
          word: phrase.join(' '),
          confidence: w.confidence ?? 1,
          atSeconds: elapsed,
          throttled,
        });
        i += phrase.length;
        continue;
      }

      // 2) Single-word filler match (obvious + ambiguous tiers).
      const obvious = isObviousFiller(w.word);
      const ambiguous = !obvious && isAmbiguousFiller(w.word);
      if (!obvious && !ambiguous) {
        const lower = normalize(w.word);
        if (/^(um|uh|er|hmm|mhm)/i.test(lower)) {
          console.log(`[pd-debug:filler-detector]   word="${w.word}" NOT MATCHED (near-miss)`);
        }
        i++;
        continue;
      }

      const startKey = w.start;
      if (startKey != null) {
        if (this.processedStarts.has(startKey)) {
          console.log(`[pd-debug:filler-detector]   word="${w.word}" SKIPPED (dedupe start=${startKey})`);
          i++;
          continue;
        }
        this.processedStarts.add(startKey);
      }
      console.log(
        `[pd-debug:filler-detector]   word="${w.word}" MATCHED (${obvious ? 'obvious' : 'ambiguous'})`,
      );

      const throttled = nowMs - this.lastBuzzAtMs < this.throttleMs;
      if (!throttled) this.lastBuzzAtMs = nowMs;

      this.onDetection({
        word: normalize(w.word),
        confidence: w.confidence ?? 1,
        atSeconds: elapsed,
        throttled,
      });
      i++;
    }

    // Cap dedupe memory; 2000 start values ≈ several minutes of speech.
    if (this.processedStarts.size > 2000) this.processedStarts.clear();
  }

  /** Reset throttle + dedupe state. Use if the session is restarted. */
  reset(): void {
    this.lastBuzzAtMs = -Infinity;
    this.processedStarts.clear();
  }
}
