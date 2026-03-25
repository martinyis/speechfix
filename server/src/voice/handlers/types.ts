import type Anthropic from '@anthropic-ai/sdk';
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
  speechObservation?: string | null;
  agentId?: number;
  agentName?: string;
  agent?: { id: number; name: string; type: string; voiceId: string | null; avatarSeed?: string | null; createdAt: string };
  farewellMessage?: string | null;
}

export interface AgentTypeHandler {
  readonly needsUserContext: boolean;
  buildSystemPrompt(agentConfig: AgentConfig | null, userContext?: FullUserContext, formContext?: Record<string, unknown> | null): string;
  getTools?(): Anthropic.Messages.Tool[];
  shouldAutoEnd(turnCount: number, conversationHistory: ConversationMessage[]): boolean;
  onSessionEnd(
    userId: number,
    agentConfig: AgentConfig | null,
    transcriptBuffer: string[],
    conversationHistory: ConversationMessage[],
    durationSeconds: number,
    formContext?: Record<string, unknown> | null,
  ): Promise<SessionEndResult>;
}
