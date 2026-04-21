export interface ChatTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export const END_SESSION_TOOL: ChatTool = {
  type: 'function',
  function: {
    name: 'end_session',
    description:
      'End the current voice session. Call this when the user indicates they want to stop, finish, or leave the conversation (e.g. "I\'m done", "let\'s stop", "OK bye", "gotta go").',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
};

export const END_ONBOARDING_TOOL: ChatTool = {
  type: 'function',
  function: {
    name: 'end_onboarding',
    description:
      'End the onboarding conversation. Call this when you\'ve wrapped up the conversation naturally. Your text response in this same message is the farewell — it will be spoken aloud to the user.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
};
