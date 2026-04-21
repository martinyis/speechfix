import type { AgentTypeHandler, AgentConfig } from './types.js';
import { ConversationHandler } from './conversation-handler.js';
import { RoleplayHandler } from './roleplay-handler.js';
import { OnboardingHandler } from '../../onboarding/handler.js';
import { AgentCreatorHandler } from '../../agents/creator-handler.js';
import { FillerCoachHandler } from '../../filler-coach/handler.js';

export type SystemAgentMode = 'conversation' | 'onboarding' | 'agent-creator' | 'filler-coach';

const conversationHandler = new ConversationHandler();
const roleplayHandler = new RoleplayHandler();
const onboardingHandler = new OnboardingHandler();
const agentCreatorHandler = new AgentCreatorHandler();
const fillerCoachHandler = new FillerCoachHandler();

export function resolveHandler(
  mode: SystemAgentMode | null,
  agentConfig: AgentConfig | null,
): AgentTypeHandler {
  if (agentConfig) {
    if (agentConfig.agentMode === 'roleplay') return roleplayHandler;
    return conversationHandler;
  }
  switch (mode) {
    case 'onboarding': return onboardingHandler;
    case 'agent-creator': return agentCreatorHandler;
    case 'filler-coach': return fillerCoachHandler;
    case 'conversation':
    default: return conversationHandler;
  }
}

export type { AgentTypeHandler, AgentConfig, SessionEndResult, FullUserContext } from './types.js';
