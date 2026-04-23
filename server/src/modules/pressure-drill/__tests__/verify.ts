/**
 * Realtime filler detector verify script.
 *
 * No test runner is configured on this repo. Run directly with:
 *   cd server && npx tsx src/modules/pressure-drill/__tests__/verify.ts
 * Exits 1 on any assertion failure. Logs OK on success.
 *
 * Fixtures live in ../realtime-filler-detector.test-fixtures.ts (canonical —
 * do NOT redefine positives/negatives here).
 */
import assert from 'node:assert/strict';
import {
  RealtimeFillerDetector,
  isObviousFiller,
} from '../realtime-filler-detector.js';
import {
  POSITIVES,
  NEGATIVES,
} from '../realtime-filler-detector.test-fixtures.js';

// ── isObviousFiller: truth table ──────────────────────────────────────
for (const p of POSITIVES) {
  assert.equal(isObviousFiller(p), true, `expected positive: "${p}"`);
}
for (const n of NEGATIVES) {
  assert.equal(isObviousFiller(n), false, `expected negative: "${n}"`);
}

// ── Detector: basic pipe ──────────────────────────────────────────────
{
  const events: Array<{ word: string; throttled: boolean }> = [];
  let fakeSeconds = 0;
  const d = new RealtimeFillerDetector({
    hapticThrottleMs: 3000,
    getElapsedSeconds: () => fakeSeconds,
    onDetection: (e) => events.push({ word: e.word, throttled: e.throttled }),
  });

  d.processFinalWords([{ word: 'um', confidence: 0.9 } as any]);
  assert.equal(events.length, 1);
  assert.equal(events[0].throttled, false);

  // Immediate second um → throttled.
  d.processFinalWords([{ word: 'um', confidence: 0.9, start: 1.0 } as any]);
  assert.equal(events.length, 2);
  assert.equal(events[1].throttled, true);
}

// ── Detector: dedupe by start ─────────────────────────────────────────
{
  const events: Array<{ word: string }> = [];
  const d = new RealtimeFillerDetector({
    hapticThrottleMs: 0,
    getElapsedSeconds: () => 0,
    onDetection: (e) => events.push({ word: e.word }),
  });
  // Same `start` timestamp → dedupe.
  d.processFinalWords([{ word: 'uh', start: 5.0, confidence: 1 } as any]);
  d.processFinalWords([{ word: 'uh', start: 5.0, confidence: 1 } as any]);
  assert.equal(events.length, 1, 'dedupe by start failed');
}

console.log('[pressure-drill verify] realtime-filler-detector OK');
