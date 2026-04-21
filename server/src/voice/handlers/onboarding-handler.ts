import type { ConversationMessage } from '../response-generator.js';
import type { AgentTypeHandler, AgentConfig, FullUserContext, SessionEndResult } from './types.js';
import type { ChatTool } from '../tools.js';
import { IDENTITY_PROMPT } from '../prompts/identity.js';
import { BEHAVIOR_PROMPT } from '../prompts/behavior.js';
import { ONBOARDING_SESSION_PROMPT } from '../prompts/session-types/onboarding.js';
import { END_ONBOARDING_TOOL } from '../tools.js';
import { extractUserProfile } from '../../modules/onboarding/profile-extractor.js';
import { analyzeOnboardingProfile } from '../../modules/onboarding/profile-analyzer.js';
import { decideInitialFlags } from '../../services/practice-modes/decide-flags.js';
import type { AnalysisFlags, SpeechSignals } from '../../services/practice-modes/types.js';
import { ensureGreetingsExist } from '../../services/greeting-generator.js';
import { db } from '../../db/index.js';
import { users } from '../../db/schema.js';
import { eq } from 'drizzle-orm';

export class OnboardingHandler implements AgentTypeHandler {
  readonly needsUserContext = false;
  readonly greetingStrategy = 'none' as const;
  readonly silenceTimeoutMs = 30_000;
  readonly maxSessionDurationMs = 3 * 60 * 1000;
  readonly maxCompletionTokens = { withTools: 180, withoutTools: 150 };

  buildSystemPrompt(_agentConfig: AgentConfig | null, _userContext?: FullUserContext, _formContext?: Record<string, unknown> | null): string {
    return [IDENTITY_PROMPT, BEHAVIOR_PROMPT, ONBOARDING_SESSION_PROMPT].join('\n\n');
  }

  getTools(): ChatTool[] {
    return [END_ONBOARDING_TOOL];
  }

  shouldAutoEnd(_turnCount: number, _conversationHistory: ConversationMessage[]): boolean {
    return false;
  }

  async onSessionEnd(
    userId: number,
    _agentConfig: AgentConfig | null,
    _transcriptBuffer: string[],
    conversationHistory: ConversationMessage[],
    _durationSeconds: number,
    _formContext?: Record<string, unknown> | null,
    _speechTimeline?: unknown,
  ): Promise<SessionEndResult> {
    try {
      const [profileRes, analyzerRes] = await Promise.allSettled([
        extractUserProfile(conversationHistory),
        analyzeOnboardingProfile(conversationHistory),
      ]);

      const profile = profileRes.status === 'fulfilled'
        ? profileRes.value
        : { displayName: null, context: null, goals: [] };

      let analysisFlags: AnalysisFlags | undefined;
      let onboardingAnalysis: SpeechSignals | undefined;
      if (analyzerRes.status === 'fulfilled') {
        if (analyzerRes.value.ok) {
          onboardingAnalysis = analyzerRes.value.signals;
          analysisFlags = decideInitialFlags(onboardingAnalysis);
        } else {
          console.log(`[onboarding-handler] Skipping auto-flags for user ${userId}: ${analyzerRes.value.reason}`);
        }
      } else {
        console.log(`[onboarding-handler] Analyzer rejected for user ${userId}:`, analyzerRes.reason);
      }

      await db.update(users).set({
        displayName: profile.displayName,
        context: profile.context,
        goals: profile.goals,
        onboardingComplete: true,
        ...(analysisFlags ? { analysisFlags } : {}),
        ...(onboardingAnalysis ? { onboardingAnalysis } : {}),
      }).where(eq(users.id, userId));

      console.log(
        `[onboarding-handler] Profile saved for user ${userId}: ${profile.displayName}` +
        (analysisFlags ? ` | flags=${JSON.stringify(analysisFlags)}` : ''),
      );

      // Generate greetings for Reflexa + filler-coach (await so they're ready)
      await ensureGreetingsExist(userId);

      // The AI already spoke its farewell (including speech observation) via TTS
      // before calling end_onboarding, so we don't need to generate separate text here.
      return {
        type: 'onboarding',
        success: true,
        displayName: profile.displayName,
        speechObservation: null,
        farewellMessage: null,
      };
    } catch (err) {
      console.error(`[onboarding-handler] Profile extraction error:`, err);

      // Still mark onboarding as complete so user isn't stuck
      await db.update(users).set({ onboardingComplete: true })
        .where(eq(users.id, userId));

      return {
        type: 'onboarding',
        success: true,
      };
    }
  }
}
