import type Anthropic from '@anthropic-ai/sdk';

export const END_SESSION_TOOL: Anthropic.Messages.Tool = {
  name: 'end_session',
  description:
    'End the current voice session. Call this when the user indicates they want to stop, finish, or leave the conversation (e.g. "I\'m done", "let\'s stop", "OK bye", "gotta go").',
  input_schema: {
    type: 'object' as const,
    properties: {},
    required: [],
  },
};
