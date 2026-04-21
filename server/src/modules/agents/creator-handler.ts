import type { ConversationMessage } from '../../voice/response-generator.js';
import type { AgentTypeHandler, AgentConfig, FullUserContext, SessionEndResult } from '../../voice/handlers/types.js';
import type { ChatTool } from '../../voice/tools.js';
import { END_SESSION_TOOL } from '../../voice/tools.js';
import { AGENT_CREATOR_SESSION_PROMPT } from './creator-prompt.js';
import { extractAgentConfig } from './config-extractor.js';
import { db } from '../../db/index.js';
import { agents } from '../../db/schema.js';
import { generateGreetingForAgent } from './greeting-generator.js';

export class AgentCreatorHandler implements AgentTypeHandler {
  readonly needsUserContext = false;
  readonly greetingStrategy = 'none' as const;
  readonly maxCompletionTokens = { withTools: 150, withoutTools: 100 };

  buildSystemPrompt(_agentConfig: AgentConfig | null, _userContext?: FullUserContext, formContext?: Record<string, unknown> | null): string {
    // Agent creator doesn't need the full identity/behavior prompts — those are for conversation mode
    // and cause the model to over-explain and yap. Use a minimal identity instead.
    const layers = [
      'You are Reflexa, an AI assistant. You speak in casual, natural English. Keep it brief and direct.',
      AGENT_CREATOR_SESSION_PROMPT,
    ];

    if (formContext) {
      const parts: string[] = [];
      if (formContext.name) parts.push(`Name: ${formContext.name}`);
      if (formContext.description) parts.push(`Description: ${formContext.description}`);
      if (formContext.focusArea) parts.push(`Focus Area: ${formContext.focusArea}`);
      if (formContext.conversationStyle) parts.push(`Style: ${formContext.conversationStyle}`);
      if (formContext.customRules) parts.push(`Custom Rules: ${formContext.customRules}`);

      if (parts.length > 0) {
        layers.push(
          `The user has already provided the following via a form:\n${parts.join('\n')}\nAcknowledge what they've filled in and ask about anything that's still unclear or could be refined.`
        );
      }
    }

    return layers.join('\n\n');
  }

  getTools(): ChatTool[] {
    return [END_SESSION_TOOL];
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
    formContext?: Record<string, unknown> | null,
    _speechTimeline?: unknown,
  ): Promise<SessionEndResult> {
    const fullTranscription = transcriptBuffer.join(' ');

    const formVoiceId = formContext?.voiceId as string | undefined;
    const formName = formContext?.name as string | undefined;
    const formAvatarSeed = formContext?.avatarSeed as string | undefined;
    const formSettings: Record<string, unknown> = {};
    if (formContext?.description) formSettings.description = formContext.description;
    if (formContext?.focusArea) formSettings.focusArea = formContext.focusArea;
    if (formContext?.conversationStyle) formSettings.conversationStyle = formContext.conversationStyle;
    if (formAvatarSeed) formSettings.avatarSeed = formAvatarSeed;

    // If no speech was captured, create a fallback agent
    if (!fullTranscription.trim()) {
      const [newAgent] = await db
        .insert(agents)
        .values({
          userId,
          type: 'conversation',
          agentMode: 'conversation',
          name: formName || 'Custom Agent',
          systemPrompt: 'You are a friendly conversation partner who enjoys discussing a wide range of topics.',
          behaviorPrompt: null,
          voiceId: formVoiceId || null,
          settings: Object.keys(formSettings).length > 0 ? formSettings : {},
        })
        .returning();

      console.log(`[agent-creator-handler] Fallback agent created: ${newAgent.id}`);

      // Await greeting so it's ready when user taps "Start Practicing"
      await generateGreetingForAgent(userId, newAgent.id);

      return {
        type: 'agent-created',
        agentId: newAgent.id,
        agentName: newAgent.name,
        agent: {
          id: newAgent.id,
          name: newAgent.name,
          type: newAgent.type,
          agentMode: newAgent.agentMode,
          voiceId: newAgent.voiceId,
          avatarSeed: formAvatarSeed ?? null,
          createdAt: newAgent.createdAt.toISOString(),
        },
      };
    }

    const config = await extractAgentConfig(conversationHistory);

    const [newAgent] = await db
      .insert(agents)
      .values({
        userId,
        type: 'conversation',
        agentMode: config.agentMode,
        name: config.name,
        systemPrompt: config.systemPrompt,
        behaviorPrompt: config.behaviorPrompt,
        voiceId: formVoiceId || null,
        settings: Object.keys(formSettings).length > 0 ? formSettings : {},
      })
      .returning();

    console.log(`[agent-creator-handler] Agent created: ${newAgent.id} (${newAgent.name})`);

    // Await greeting so it's ready when user taps "Start Practicing"
    await generateGreetingForAgent(userId, newAgent.id);

    return {
      type: 'agent-created',
      agentId: newAgent.id,
      agentName: newAgent.name,
      agent: {
        id: newAgent.id,
        name: newAgent.name,
        type: newAgent.type,
        agentMode: newAgent.agentMode,
        voiceId: newAgent.voiceId,
        avatarSeed: formAvatarSeed ?? null,
        createdAt: newAgent.createdAt.toISOString(),
      },
    };
  }
}
