// This module re-exports prompt components. Handlers compose their own
// prompts directly from the individual modules.

export { IDENTITY_PROMPT } from './identity.js';
export { BEHAVIOR_PROMPT } from './behavior.js';
export { CONVERSATION_SESSION_PROMPT } from './session-types/conversation.js';
export { ONBOARDING_SESSION_PROMPT } from './session-types/onboarding.js';
export { AGENT_CREATOR_SESSION_PROMPT } from './session-types/agent-creator.js';
export { buildUserContextPrompt } from './context.js';
