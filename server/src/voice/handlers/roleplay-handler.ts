import type { AgentConfig, FullUserContext } from './types.js';
import { ConversationHandler } from './conversation-handler.js';
import { ROLEPLAY_AUTHORITY_BLOCK, ROLEPLAY_BEHAVIOR_PROMPT, ROLEPLAY_SESSION_PROMPT } from '../prompts/session-types/roleplay.js';
import { buildUserContextPrompt } from '../prompts/context.js';

export class RoleplayHandler extends ConversationHandler {
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

    return layers.join('\n\n');
  }
}
