export interface DiffSegment {
  type: 'equal' | 'deleted' | 'changed';
  text: string;
}

/**
 * Compute the Longest Common Subsequence table for two word arrays.
 */
function lcsTable(a: string[], b: string[]): number[][] {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1].toLowerCase() === b[j - 1].toLowerCase()) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  return dp;
}

/**
 * Backtrack the LCS table to find which indices in `a` are part of the LCS.
 */
function lcsIndices(a: string[], b: string[], dp: number[][]): Set<number> {
  const indices = new Set<number>();
  let i = a.length;
  let j = b.length;

  while (i > 0 && j > 0) {
    if (a[i - 1].toLowerCase() === b[j - 1].toLowerCase()) {
      indices.add(i - 1);
      i--;
      j--;
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }

  return indices;
}

/**
 * Word-level diff using LCS. Highlights which words in the original text
 * are wrong (deleted or changed) compared to the corrected text.
 *
 * - 'equal'   — word exists in both original and corrected (via LCS match)
 * - 'deleted' — word in original was removed in corrected version
 * - 'changed' — word in original is adjacent to an insertion in corrected version
 */
export function wordDiff(originalText: string, correctedText: string): DiffSegment[] {
  const origWords = originalText.trim().split(/\s+/).filter(Boolean);
  const corrWords = correctedText.trim().split(/\s+/).filter(Boolean);

  if (origWords.length === 0) return [];

  const dp = lcsTable(origWords, corrWords);
  const matchedOrigIndices = lcsIndices(origWords, corrWords, dp);

  // Build initial segments: equal or deleted
  const segments: DiffSegment[] = origWords.map((word, i) => ({
    type: matchedOrigIndices.has(i) ? ('equal' as const) : ('deleted' as const),
    text: word,
  }));

  // Detect insertions in corrected text and mark adjacent original words as 'changed'
  // Walk both sequences to find corrected words that don't appear in the LCS
  const corrMatchedIndices = new Set<number>();
  {
    let oi = origWords.length;
    let ci = corrWords.length;
    while (oi > 0 && ci > 0) {
      if (origWords[oi - 1].toLowerCase() === corrWords[ci - 1].toLowerCase()) {
        corrMatchedIndices.add(ci - 1);
        oi--;
        ci--;
      } else if (dp[oi - 1][ci] >= dp[oi][ci - 1]) {
        oi--;
      } else {
        ci--;
      }
    }
  }

  // Find insertion positions in corrected text and mark nearby original words
  const origOrder = Array.from(matchedOrigIndices).sort((a, b) => a - b);
  let matchPtr = 0;

  for (let corrIdx = 0; corrIdx < corrWords.length; corrIdx++) {
    if (corrMatchedIndices.has(corrIdx)) {
      // This corrected word is matched — advance
      matchPtr++;
      continue;
    }
    // This is an inserted word in the corrected text
    // Find the nearest original word to mark as 'changed'
    if (matchPtr < origOrder.length) {
      // Mark the original word just before or at this match point
      const nearestOrigIdx = matchPtr > 0 ? origOrder[matchPtr - 1] : origOrder[0];
      if (segments[nearestOrigIdx].type === 'equal') {
        segments[nearestOrigIdx] = { ...segments[nearestOrigIdx], type: 'changed' };
      }
    } else if (origOrder.length > 0) {
      // Past all matches — mark the last matched original word
      const lastOrigIdx = origOrder[origOrder.length - 1];
      if (segments[lastOrigIdx].type === 'equal') {
        segments[lastOrigIdx] = { ...segments[lastOrigIdx], type: 'changed' };
      }
    }
  }

  return segments;
}

/**
 * Maps snake_case correction types to human-readable uppercase labels.
 * e.g. "article_usage" → "ARTICLE USAGE", "verb_tense" → "VERB TENSE"
 */
export function formatCorrectionTypeLabel(correctionType: string): string {
  return correctionType.replace(/_/g, ' ').toUpperCase();
}
