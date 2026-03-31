import type { AgentTypeHandler, AgentConfig } from './types.js';
import { ConversationHandler } from './conversation-handler.js';
import { OnboardingHandler } from './onboarding-handler.js';
import { AgentCreatorHandler } from './agent-creator-handler.js';
import { FillerCoachHandler } from './filler-coach-handler.js';

export type SystemAgentMode = 'conversation' | 'onboarding' | 'agent-creator' | 'filler-coach';

const conversationHandler = new ConversationHandler();
const onboardingHandler = new OnboardingHandler();
const agentCreatorHandler = new AgentCreatorHandler();
const fillerCoachHandler = new FillerCoachHandler();

export function resolveHandler(
  mode: SystemAgentMode | null,
  agentConfig: AgentConfig | null,
): AgentTypeHandler {
  if (agentConfig) return conversationHandler;
  switch (mode) {
    case 'onboarding': return onboardingHandler;
    case 'agent-creator': return agentCreatorHandler;
    case 'filler-coach': return fillerCoachHandler;
    case 'conversation':
    default: return conversationHandler;
  }
}

export type { AgentTypeHandler, AgentConfig, SessionEndResult, FullUserContext } from './types.js';
