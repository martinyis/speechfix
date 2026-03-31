import type { ConversationMessage } from '../response-generator.js';
import type { AgentTypeHandler, AgentConfig, FullUserContext, SessionEndResult } from './types.js';
import type { ChatTool } from '../tools.js';
import { END_SESSION_TOOL } from '../tools.js';
import { FILLER_COACH_IDENTITY_PROMPT, FILLER_COACH_SESSION_PROMPT } from '../prompts/session-types/filler-coach.js';
import { FILLER_COACH_BEHAVIOR_PROMPT } from '../prompts/behavior.js';
import { FillerAnalyzer } from '../../analysis/analyzers/fillers.js';

const fillerAnalyzer = new FillerAnalyzer();

export class FillerCoachHandler implements AgentTypeHandler {
  readonly needsUserContext = false;
  readonly maxSessionDurationMs = 10 * 60 * 1000; // 10 min hard cap

  buildSystemPrompt(
    _agentConfig: AgentConfig | null,
    _userContext?: FullUserContext,
    formContext?: Record<string, unknown> | null,
  ): string {
    const layers: string[] = [];

    layers.push(FILLER_COACH_IDENTITY_PROMPT);
    layers.push(FILLER_COACH_BEHAVIOR_PROMPT);

    // Inject target words into session prompt
    const targetWords = (formContext?.targetWords as string) || 'um, uh, like, you know';
    const sessionPrompt = FILLER_COACH_SESSION_PROMPT.replace('{targetWords}', targetWords);
    layers.push(sessionPrompt);

    // Filler history from past sessions (pre-fetched and passed via formContext)
    const fillerHistory = formContext?.fillerHistory as string | undefined;
    if (fillerHistory) {
      layers.push(fillerHistory);
    }

    return layers.join('\n\n');
  }

  getTools(): ChatTool[] {
    return [END_SESSION_TOOL];
  }

  shouldAutoEnd(_turnCount: number, _conversationHistory: ConversationMessage[]): boolean {
    return false;
  }

  async onSessionEnd(
    _userId: number,
    _agentConfig: AgentConfig | null,
    transcriptBuffer: string[],
    conversationHistory: ConversationMessage[],
    _durationSeconds: number,
    _formContext?: Record<string, unknown> | null,
  ): Promise<SessionEndResult> {
    const userUtterances = transcriptBuffer;

    if (!userUtterances.join(' ').trim()) {
      return { type: 'filler-practice' };
    }

    // Run filler analysis only (no DB writes, no session creation)
    const fillerResult = await fillerAnalyzer.analyze({
      sentences: userUtterances,
      mode: 'conversation',
      conversationHistory,
    });

    console.log(`[filler-coach-handler] Analysis complete: ${fillerResult.fillerWords.length} filler types (not saved to DB)`);

    return {
      type: 'filler-practice',
      analysisResults: {
        sentences: userUtterances,
        corrections: [],
        fillerWords: fillerResult.fillerWords,
        fillerPositions: fillerResult.fillerPositions,
        sessionInsights: [],
      },
    };
  }

  // No onSessionEndStreaming — filler analysis is fast, no grammar corrections to stream
}
