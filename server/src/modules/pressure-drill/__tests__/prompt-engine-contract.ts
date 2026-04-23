/**
 * Live Anthropic contract check for the silent prompt engine.
 *
 * Hits the real Anthropic endpoint — verifies the SHAPE of the response, not
 * the content. Skips gracefully if ANTHROPIC_API_KEY is not set so CI stays
 * deterministic.
 *
 * Run with:
 *   cd server && npx tsx src/modules/pressure-drill/__tests__/prompt-engine-contract.ts
 */
import assert from 'node:assert/strict';
import 'dotenv/config';
import { generatePromptBatch } from '../prompt-engine.js';

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn(
      '[prompt-engine verify] ANTHROPIC_API_KEY not set — skipping live test',
    );
    return;
  }
  const result = await generatePromptBatch({
    scenarioSlug: 'pitch_idea',
    durationPreset: 180,
    elapsedSeconds: 0,
    lastTranscriptWindow: '',
    previouslyShownPrompts: [],
  });
  assert.equal(result.prompts.length, 4, 'expected 4 prompts');
  for (const p of result.prompts) {
    assert.ok(
      typeof p === 'string' && p.length > 0,
      'empty prompt',
    );
    const words = p.split(/\s+/);
    assert.ok(
      words.length <= 10,
      `prompt exceeds 10 words: "${p}"`,
    );
  }
  const unique = new Set(result.prompts);
  assert.equal(unique.size, 4, 'prompts not unique within batch');
  console.log(
    `[prompt-engine verify] ${result.prompts.length} prompts @ ${result.latencyMs}ms`,
  );
}

main().catch((err) => {
  console.error('[prompt-engine verify] FAILED:', err);
  process.exit(1);
});
