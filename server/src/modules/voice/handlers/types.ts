import type { ChatTool } from '../tools.js';
import type { ConversationMessage, UserContext, BrevityOptions } from '../response-generator.js';
import type { SpeechTimeline } from '../speech-types.js';

export interface AgentConfig {
  id: number;
  type: string;
  agentMode: string;
  name: string;
  systemPrompt: string;
  behaviorPrompt: string | null;
  voiceId: string | null;
  settings: Record<string, unknown>;
}

export interface FullUserContext extends UserContext {
  contextNotes?: Array<{ date: string; notes: string[]; agentId?: number | null }> | null;
}

export interface SessionEndResult {
  type: 'analysis' | 'onboarding' | 'agent-created' | 'filler-practice';
  dbSessionId?: number;
  correctionIds?: number[];
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
  agent?: { id: number; name: string; type: string; agentMode: string; voiceId: string | null; avatarSeed?: string | null; createdAt: string };
  farewellMessage?: string | null;
}

export interface AirtimeCounts {
  aiWordCount: number;
  userWordCount: number;
}

export interface AgentTypeHandler {
  readonly needsUserContext: boolean;
  readonly greetingStrategy: 'pregenerated' | 'none';
  readonly includeElapsedTime?: boolean;
  readonly silenceTimeoutMs?: number;
  readonly maxSessionDurationMs?: number;
  readonly maxCompletionTokens?: { withTools: number; withoutTools: number };
  buildSystemPrompt(agentConfig: AgentConfig | null, userContext?: FullUserContext, formContext?: Record<string, unknown> | null): string;
  getTools?(): ChatTool[];
  shouldAutoEnd(turnCount: number, conversationHistory: ConversationMessage[]): boolean;
  /**
   * Return per-turn brevity budget based on whether the user asked a direct
   * question, whether tools are enabled this turn, and which agent is active
   * (custom agents get more slack than Reflexa). Handlers that opt out
   * (no budget) should omit this method — the default (`maxCompletionTokens`
   * from the handler, no truncation) will be used.
   */
  getBrevityBudget?(isDirectQuestion: boolean, hasTools: boolean, agentConfig: AgentConfig | null): BrevityOptions;
  onSessionEnd(
    userId: number,
    agentConfig: AgentConfig | null,
    transcriptBuffer: string[],
    conversationHistory: ConversationMessage[],
    durationSeconds: number,
    formContext?: Record<string, unknown> | null,
    speechTimeline?: SpeechTimeline,
    airtimeCounts?: AirtimeCounts,
  ): Promise<SessionEndResult>;

  onSessionEndStreaming?(
    userId: number,
    agentConfig: AgentConfig | null,
    transcriptBuffer: string[],
    conversationHistory: ConversationMessage[],
    durationSeconds: number,
    onCorrection: (correction: any) => void,
    formContext?: Record<string, unknown> | null,
    onInsightsReady?: (payload: any, dbSessionId: number) => void,
    speechTimeline?: SpeechTimeline,
    onDeepInsightsReady?: (insights: any[], dbSessionId: number) => void,
    airtimeCounts?: AirtimeCounts,
  ): Promise<SessionEndResult>;
}
