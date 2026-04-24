import type { AgentConfig, FullUserContext } from './types.js';
import type { BrevityOptions } from '../response-generator.js';
import { ConversationHandler } from './conversation-handler.js';
import { ROLEPLAY_AUTHORITY_BLOCK, ROLEPLAY_BEHAVIOR_PROMPT, ROLEPLAY_SESSION_PROMPT } from '../prompts/session-types/roleplay.js';
import { buildUserContextPrompt } from '../prompts/context.js';
import {
  BREVITY_PROMPT_ROLEPLAY,
  ROLEPLAY_TRUNCATE_WORDS,
  ROLEPLAY_QUESTION_TRUNCATE_WORDS,
} from '../prompts/brevity.js';

export class RoleplayHandler extends ConversationHandler {
  override readonly maxCompletionTokens = { withTools: 200, withoutTools: 70 };

  override getBrevityBudget(isDirectQuestion: boolean, hasTools: boolean, _agentConfig: AgentConfig | null): BrevityOptions {
    if (hasTools) {
      return { maxCompletionTokens: this.maxCompletionTokens.withTools };
    }
    return isDirectQuestion
      ? { maxCompletionTokens: 100, truncateToWords: ROLEPLAY_QUESTION_TRUNCATE_WORDS }
      : { maxCompletionTokens: 70, truncateToWords: ROLEPLAY_TRUNCATE_WORDS };
  }

  buildSystemPrompt(agentConfig: AgentConfig | null, userContext?: FullUserContext, _formContext?: Record<string, unknown> | null): string {
    const layers: string[] = [
      ROLEPLAY_AUTHORITY_BLOCK,
      `Your name is ${agentConfig?.name}.\n\n${agentConfig?.systemPrompt}`,
    ];

    if (agentConfig?.behaviorPrompt) {
      layers.push(agentConfig.behaviorPrompt);
    }

    layers.push(ROLEPLAY_BEHAVIOR_PROMPT);
    layers.push(ROLEPLAY_SESSION_PROMPT);

    const contextPrompt = buildUserContextPrompt(userContext, agentConfig?.id ?? null);
    if (contextPrompt) {
      layers.push(contextPrompt);
    }

    // Brevity fragment must be LAST so LLMs weight it most heavily.
    // It also reinforces the stage-directions ban from ROLEPLAY_AUTHORITY_BLOCK.
    layers.push(BREVITY_PROMPT_ROLEPLAY);

    return layers.join('\n\n');
  }
}
