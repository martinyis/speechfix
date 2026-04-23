import Anthropic from '@anthropic-ai/sdk';
import type {
  PromptBatchRequest,
  PromptBatchResponse,
  Scenario,
} from './types.js';
import { getScenario } from './scenarios.js';
import {
  PROMPT_BATCH_SYSTEM,
  buildPromptBatchUserMessage,
} from './prompt-builder.js';

const anthropic = new Anthropic();

// Model pinned — see README open decision D1. Upgrade in-place when Anthropic
// publishes a newer Haiku.
export const PROMPT_ENGINE_MODEL = 'claude-haiku-4-5-20251001';

// Request budget — the drill UI shows prompts in real time. If Haiku is slow,
// we fall back to seed prompts. 1500ms is tight enough to feel alive; 3000ms
// would let Haiku complete on 99th percentile but adds perceivable lag.
export const PROMPT_REQUEST_TIMEOUT_MS = 1500;

export class PromptEngineError extends Error {
  constructor(
    public readonly kind: 'timeout' | 'invalid_json' | 'bad_shape' | 'anthropic_error',
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
  }
}

/**
 * Produce a batch of 4 prompts. Throws PromptEngineError on failure — caller
 * (Phase 4 handler) is responsible for falling back to seed prompts.
 */
export async function generatePromptBatch(
  req: PromptBatchRequest,
): Promise<PromptBatchResponse> {
  const scenario: Scenario | null = getScenario(req.scenarioSlug);
  if (!scenario) {
    throw new PromptEngineError('bad_shape', `Unknown scenario: ${req.scenarioSlug}`);
  }

  const userMessage = buildPromptBatchUserMessage(req, scenario);

  const startedAt = Date.now();

  // AbortSignal.timeout is Node 18+ native. Available in this runtime.
  const signal = AbortSignal.timeout(PROMPT_REQUEST_TIMEOUT_MS);

  let response;
  try {
    response = await anthropic.messages.create(
      {
        model: PROMPT_ENGINE_MODEL,
        max_tokens: 256,
        system: PROMPT_BATCH_SYSTEM,
        messages: [{ role: 'user', content: userMessage }],
      },
      { signal },
    );
  } catch (err: any) {
    if (err?.name === 'AbortError' || err?.name === 'TimeoutError') {
      throw new PromptEngineError('timeout', `Prompt batch timed out after ${PROMPT_REQUEST_TIMEOUT_MS}ms`, err);
    }
    throw new PromptEngineError('anthropic_error', err?.message ?? 'Anthropic SDK error', err);
  }

  const latencyMs = Date.now() - startedAt;

  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new PromptEngineError('bad_shape', 'Anthropic response had no text block');
  }

  // Tolerate stray markdown fences ('```json ... ```') some models still emit
  // despite instructions. Strip them before parsing.
  const cleaned = textBlock.text
    .replace(/^\s*```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();

  let parsed: { prompts?: unknown };
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    throw new PromptEngineError('invalid_json', `Response was not valid JSON: ${cleaned.slice(0, 200)}`, err);
  }

  if (!Array.isArray(parsed.prompts) || parsed.prompts.length !== 4) {
    throw new PromptEngineError('bad_shape', `Expected 4 prompts, got ${Array.isArray(parsed.prompts) ? parsed.prompts.length : 'non-array'}`);
  }

  const prompts = parsed.prompts.map((p) => String(p).trim());
  // Enforce ≤10 words per prompt. Haiku usually respects this; trim if not.
  const clamped = prompts.map((p) => {
    const words = p.split(/\s+/);
    return words.length <= 10 ? p : words.slice(0, 10).join(' ');
  });

  // Deduplicate within this batch (rare but possible).
  const unique = Array.from(new Set(clamped));
  while (unique.length < 4) {
    // Pad with the first prompt if the model repeated itself; better than
    // returning fewer than 4 and breaking the mobile cache.
    unique.push(clamped[0] ?? 'Say more.');
  }

  return {
    prompts: unique.slice(0, 4),
    model: PROMPT_ENGINE_MODEL,
    latencyMs,
  };
}
