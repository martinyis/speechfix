import { FastifyInstance } from 'fastify';
import { generatePromptBatch, PromptEngineError } from './prompt-engine.js';
import type { PromptBatchRequest, ScenarioSlug, DurationPreset } from './types.js';
import { DURATION_PRESETS } from './types.js';
import { getScenario } from './scenarios.js';

/**
 * Test-only route. POST a PromptBatchRequest, get a PromptBatchResponse.
 * Useful for iterating on prompt copy without running the full drill.
 */
export async function promptEngineRoutes(fastify: FastifyInstance) {
  fastify.post<{ Body: Partial<PromptBatchRequest> }>(
    '/pressure-drill/debug/generate-prompts',
    async (request, reply) => {
      const body = request.body ?? {};
      const scenarioSlug = body.scenarioSlug as ScenarioSlug | undefined;
      const durationPreset = body.durationPreset as DurationPreset | undefined;

      if (!scenarioSlug || !getScenario(scenarioSlug)) {
        return reply.code(400).send({ error: 'Invalid scenarioSlug' });
      }
      if (durationPreset === undefined || !DURATION_PRESETS.includes(durationPreset)) {
        return reply.code(400).send({ error: 'Invalid durationPreset' });
      }

      const req: PromptBatchRequest = {
        scenarioSlug,
        durationPreset,
        elapsedSeconds: body.elapsedSeconds ?? 0,
        lastTranscriptWindow: body.lastTranscriptWindow ?? '',
        previouslyShownPrompts: body.previouslyShownPrompts ?? [],
      };

      try {
        const result = await generatePromptBatch(req);
        return result;
      } catch (err) {
        if (err instanceof PromptEngineError) {
          return reply.code(502).send({ error: err.kind, message: err.message });
        }
        return reply.code(500).send({ error: 'unknown', message: (err as Error).message });
      }
    },
  );
}
