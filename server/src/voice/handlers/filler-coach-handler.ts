import type { ConversationMessage } from '../response-generator.js';
import type { AgentTypeHandler, AgentConfig, FullUserContext, SessionEndResult } from './types.js';
import type { ChatTool } from '../tools.js';
import { END_SESSION_TOOL } from '../tools.js';
import { FILLER_COACH_IDENTITY_PROMPT, FILLER_COACH_SESSION_PROMPT } from '../prompts/session-types/filler-coach.js';
import { FILLER_COACH_BEHAVIOR_PROMPT } from '../prompts/behavior.js';
import { FillerAnalyzer } from '../../analysis/analyzers/fillers.js';
import { regenerateAllGreetings } from '../../services/greeting-generator.js';
import { runPatternAnalysisForUser } from '../../jobs/patterns.js';
import { db } from '../../db/index.js';
import { fillerCoachSessions } from '../../db/schema.js';

const fillerAnalyzer = new FillerAnalyzer();

export class FillerCoachHandler implements AgentTypeHandler {
  readonly needsUserContext = false;
  readonly greetingStrategy = 'pregenerated' as const;
  readonly includeElapsedTime = true;
  readonly maxSessionDurationMs = 10 * 60 * 1000; // 10 min hard cap
  readonly maxCompletionTokens = { withTools: 220, withoutTools: 160 };

  buildSystemPrompt(
    _agentConfig: AgentConfig | null,
    _userContext?: FullUserContext,
    formContext?: Record<string, unknown> | null,
  ): string {
    const layers: string[] = [];

    layers.push(FILLER_COACH_IDENTITY_PROMPT);
    layers.push(FILLER_COACH_BEHAVIOR_PROMPT);

    // Inject target words into session prompt
    const targetWords = (formContext?.targetWords as string) || 'all common filler words (um, uh, like, you know, so, basically, actually, right, I mean, kind of, sort of, literally)';
    const sessionPrompt = FILLER_COACH_SESSION_PROMPT.replace('{targetWords}', targetWords);

    // Inject topic directive
    const topicDirective = (formContext?.topicDirective as string) || 'Ask what\'s on their mind or what they\'ve been up to. Be curious and engaged.';
    const finalPrompt = sessionPrompt.replace('{topicDirective}', topicDirective);
    layers.push(finalPrompt);

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
    userId: number,
    _agentConfig: AgentConfig | null,
    transcriptBuffer: string[],
    conversationHistory: ConversationMessage[],
    durationSeconds: number,
    formContext?: Record<string, unknown> | null,
    _speechTimeline?: unknown,
  ): Promise<SessionEndResult> {
    const userUtterances = transcriptBuffer;

    if (!userUtterances.join(' ').trim()) {
      // Still regenerate greetings even if no speech
      regenerateAllGreetings(userId).catch(err =>
        console.error('[greeting] Filler coach regen failed:', err)
      );
      return { type: 'filler-practice' };
    }

    // Run filler analysis
    const fillerResult = await fillerAnalyzer.analyze({
      sentences: userUtterances,
      mode: 'conversation',
      conversationHistory,
    });

    const totalFillerCount = fillerResult.fillerWords.reduce((sum, fw) => sum + fw.count, 0);

    // Persist to filler_coach_sessions
    const [coachSession] = await db
      .insert(fillerCoachSessions)
      .values({
        userId,
        durationSeconds,
        totalFillerCount,
        fillerData: {
          fillerWords: fillerResult.fillerWords,
          fillerPositions: fillerResult.fillerPositions,
          sentences: userUtterances,
        },
        cognitiveLevel: (formContext?.cognitiveLevel as number) ?? null,
        topicSlug: (formContext?.topicSlug as string) ?? null,
      })
      .returning();

    console.log(`[filler-coach-handler] Saved coach session ${coachSession.id}: ${fillerResult.fillerWords.length} filler types, ${totalFillerCount} total`);

    // Fire-and-forget: regenerate greetings for next session
    regenerateAllGreetings(userId).catch(err =>
      console.error('[greeting] Filler coach regen failed:', err)
    );

    // Fire-and-forget: trigger pattern analysis (debounce handles frequency)
    runPatternAnalysisForUser(userId).catch(err =>
      console.error('[filler-coach-handler] Pattern analysis trigger failed:', err)
    );

    return {
      type: 'filler-practice',
      dbSessionId: coachSession.id,
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
