import type { AgentTypeHandler, AgentConfig } from './types.js';
import { ConversationHandler } from './conversation-handler.js';
import { OnboardingHandler } from './onboarding-handler.js';
import { AgentCreatorHandler } from './agent-creator-handler.js';

export type SystemAgentMode = 'conversation' | 'onboarding' | 'agent-creator';

const conversationHandler = new ConversationHandler();
const onboardingHandler = new OnboardingHandler();
const agentCreatorHandler = new AgentCreatorHandler();

export function resolveHandler(
  mode: SystemAgentMode | null,
  agentConfig: AgentConfig | null,
): AgentTypeHandler {
  if (agentConfig) return conversationHandler;
  switch (mode) {
    case 'onboarding': return onboardingHandler;
    case 'agent-creator': return agentCreatorHandler;
    case 'conversation':
    default: return conversationHandler;
  }
}

export type { AgentTypeHandler, AgentConfig, SessionEndResult, FullUserContext } from './types.js';
