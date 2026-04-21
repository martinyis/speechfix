// This module re-exports prompt components. Handlers compose their own
// prompts directly from the individual modules.

export { IDENTITY_PROMPT } from './identity.js';
export { BEHAVIOR_PROMPT, CUSTOM_AGENT_BEHAVIOR_PROMPT } from './behavior.js';
export { REFLEXA_SESSION_PROMPT, CUSTOM_AGENT_SESSION_PROMPT } from './session-types/conversation.js';
export { ONBOARDING_SESSION_PROMPT } from '../../modules/onboarding/prompt.js';
export { AGENT_CREATOR_SESSION_PROMPT } from './session-types/agent-creator.js';
export { buildUserContextPrompt } from './context.js';
export { ROLEPLAY_AUTHORITY_BLOCK, ROLEPLAY_BEHAVIOR_PROMPT, ROLEPLAY_SESSION_PROMPT } from './session-types/roleplay.js';