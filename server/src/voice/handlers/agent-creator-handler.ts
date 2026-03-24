import type { ConversationMessage } from '../response-generator.js';
import type { AgentTypeHandler, AgentConfig, FullUserContext, SessionEndResult } from './types.js';
import { IDENTITY_PROMPT } from '../prompts/identity.js';
import { BEHAVIOR_PROMPT } from '../prompts/behavior.js';
import { AGENT_CREATOR_SESSION_PROMPT } from '../prompts/session-types/agent-creator.js';
import { extractAgentConfig } from '../../services/agent-config-extractor.js';
import { db } from '../../db/index.js';
import { agents } from '../../db/schema.js';

export class AgentCreatorHandler implements AgentTypeHandler {
  readonly needsUserContext = false;

  buildSystemPrompt(_agentConfig: AgentConfig | null, _userContext?: FullUserContext): string {
    return [IDENTITY_PROMPT, BEHAVIOR_PROMPT, AGENT_CREATOR_SESSION_PROMPT].join('\n\n');
  }

  shouldAutoEnd(_turnCount: number, _conversationHistory: ConversationMessage[]): boolean {
    return false;
  }

  async onSessionEnd(
    userId: number,
    _agentConfig: AgentConfig | null,
    transcriptBuffer: string[],
    conversationHistory: ConversationMessage[],
    _durationSeconds: number,
  ): Promise<SessionEndResult> {
    const fullTranscription = transcriptBuffer.join(' ');

    // If no speech was captured, create a fallback agent
    if (!fullTranscription.trim()) {
      const [newAgent] = await db
        .insert(agents)
        .values({
          userId,
          type: 'conversation',
          name: 'Custom Agent',
          systemPrompt: 'You are a friendly conversation partner who enjoys discussing a wide range of topics.',
          behaviorPrompt: null,
        })
        .returning();

      console.log(`[agent-creator-handler] Fallback agent created: ${newAgent.id}`);

      return { type: 'agent-created', agentId: newAgent.id, agentName: newAgent.name };
    }

    const config = await extractAgentConfig(conversationHistory);

    const [newAgent] = await db
      .insert(agents)
      .values({
        userId,
        type: 'conversation',
        name: config.name,
        systemPrompt: config.systemPrompt,
        behaviorPrompt: config.behaviorPrompt,
      })
      .returning();

    console.log(`[agent-creator-handler] Agent created: ${newAgent.id} (${newAgent.name})`);

    return { type: 'agent-created', agentId: newAgent.id, agentName: newAgent.name };
  }
}
