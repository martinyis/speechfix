import type { Correction } from './types.js';

/**
 * State-machine parser that extracts individual Correction objects from a
 * partial JSON stream.  It watches for the "corrections" array and yields
 * each complete object as soon as the closing brace is seen.
 */
export class CorrectionStreamParser {
  private buffer = '';
  private inCorrectionsArray = false;
  private braceDepth = 0;
  private currentObjectStart = -1;
  private inString = false;
  private escapeNext = false;
  private correctionsDone = false;
  private scanPos = 0;

  /** Feed a new chunk of text; returns any fully-parsed corrections. */
  feed(chunk: string): Correction[] {
    this.buffer += chunk;
    const results: Correction[] = [];

    if (this.correctionsDone) return results;

    // Strip leading markdown fences that Claude sometimes emits
    if (!this.inCorrectionsArray && this.buffer.length < 200) {
      const stripped = this.buffer.replace(/^\s*```(?:json)?\s*/, '');
      if (stripped !== this.buffer) {
        this.buffer = stripped;
        this.scanPos = 0;
      }
    }

    // PHASE 1: Find the corrections array using indexOf (no char scanning)
    if (!this.inCorrectionsArray) {
      const corrIdx = this.buffer.indexOf('"corrections"');
      if (corrIdx === -1) {
        // Haven't seen the key yet — keep only the tail in buffer
        if (this.buffer.length > 20) {
          this.buffer = this.buffer.slice(-20);
          this.scanPos = 0;
        }
        return results;
      }
      const bracketIdx = this.buffer.indexOf('[', corrIdx + '"corrections"'.length);
      if (bracketIdx === -1) return results;

      this.inCorrectionsArray = true;
      this.buffer = this.buffer.slice(bracketIdx + 1);
      this.inString = false;
      this.escapeNext = false;
      this.scanPos = 0;
    }

    // PHASE 2: Character-by-character scanning inside the corrections array
    let i = this.scanPos;
    while (i < this.buffer.length) {
      const ch = this.buffer[i];

      // Handle string context (ignore braces inside JSON strings)
      if (this.escapeNext) {
        this.escapeNext = false;
        i++;
        continue;
      }
      if (ch === '\\' && this.inString) {
        this.escapeNext = true;
        i++;
        continue;
      }
      if (ch === '"') {
        this.inString = !this.inString;
        i++;
        continue;
      }
      if (this.inString) {
        i++;
        continue;
      }

      // Inside the corrections array
      if (ch === '{' && this.braceDepth === 0) {
        this.currentObjectStart = i;
        this.braceDepth = 1;
        i++;
        continue;
      }

      if (this.braceDepth > 0) {
        if (ch === '{') this.braceDepth++;
        if (ch === '}') this.braceDepth--;

        if (this.braceDepth === 0) {
          // Complete object
          const objStr = this.buffer.slice(this.currentObjectStart, i + 1);
          try {
            const raw = JSON.parse(objStr);
            const normalized: Correction = {
              sentenceIndex: raw.sentenceIndex ?? 0,
              originalText: raw.originalText ?? '',
              correctedText: raw.correctedText ?? '',
              explanation: raw.explanation ?? '',
              shortReason: typeof raw.shortReason === 'string' ? raw.shortReason.trim() : '',
              correctionType: raw.correctionType || raw.type || 'other',
              severity: ['error', 'improvement', 'polish'].includes(raw.severity) ? raw.severity : 'error',
              contextSnippet: raw.contextSnippet ?? '',
            };
            results.push(normalized);
          } catch {
            console.warn('[stream-parser] Failed to parse correction object:', objStr.slice(0, 80));
          }
          // Advance buffer past this object
          this.buffer = this.buffer.slice(i + 1);
          i = 0;
          this.currentObjectStart = -1;
          continue;
        }
      }

      if (ch === ']' && this.braceDepth === 0 && this.inCorrectionsArray) {
        this.correctionsDone = true;
        // Keep remaining buffer for post-stream parsing of other fields
        this.buffer = this.buffer.slice(i + 1);
        this.scanPos = 0;
        break;
      }

      i++;
    }

    // Save scan position for next feed() call
    this.scanPos = i;

    return results;
  }

  isDone(): boolean {
    return this.correctionsDone;
  }
}
