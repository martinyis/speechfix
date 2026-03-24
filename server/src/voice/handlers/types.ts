import type { ConversationMessage, UserContext } from '../response-generator.js';

export interface AgentConfig {
  id: number;
  type: string;
  name: string;
  systemPrompt: string;
  behaviorPrompt: string | null;
  voiceId: string | null;
  settings: Record<string, unknown>;
}

export interface FullUserContext extends UserContext {
  contextNotes?: Array<{ date: string; notes: string[] }> | null;
}

export interface SessionEndResult {
  type: 'analysis' | 'onboarding' | 'agent-created';
  dbSessionId?: number;
  analysisResults?: {
    sentences: string[];
    corrections: any[];
    fillerWords: any[];
    fillerPositions: any[];
    sessionInsights: any[];
  };
  success?: boolean;
  displayName?: string | null;
  agentId?: number;
  agentName?: string;
}

export interface AgentTypeHandler {
  readonly needsUserContext: boolean;
  buildSystemPrompt(agentConfig: AgentConfig | null, userContext?: FullUserContext): string;
  shouldAutoEnd(turnCount: number, conversationHistory: ConversationMessage[]): boolean;
  onSessionEnd(
    userId: number,
    agentConfig: AgentConfig | null,
    transcriptBuffer: string[],
    conversationHistory: ConversationMessage[],
    durationSeconds: number,
  ): Promise<SessionEndResult>;
}
