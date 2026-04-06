import type { ConversationMessage } from '../response-generator.js';
import type { AgentTypeHandler, AgentConfig, FullUserContext, SessionEndResult } from './types.js';
import type { ChatTool } from '../tools.js';
import { IDENTITY_PROMPT } from '../prompts/identity.js';
import { BEHAVIOR_PROMPT } from '../prompts/behavior.js';
import { ONBOARDING_SESSION_PROMPT } from '../prompts/session-types/onboarding.js';
import { END_ONBOARDING_TOOL } from '../tools.js';
import { extractUserProfile } from '../../services/profile-extractor.js';
import { ensureGreetingsExist } from '../../services/greeting-generator.js';
import { db } from '../../db/index.js';
import { users } from '../../db/schema.js';
import { eq } from 'drizzle-orm';

export class OnboardingHandler implements AgentTypeHandler {
  readonly needsUserContext = false;
  readonly greetingStrategy = 'none' as const;
  readonly silenceTimeoutMs = 30_000;
  readonly maxSessionDurationMs = 3 * 60 * 1000;

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
  ): Promise<SessionEndResult> {
    try {
      const profile = await extractUserProfile(conversationHistory);

      await db.update(users).set({
        displayName: profile.displayName,
        context: profile.context,
        goals: profile.goals,
        onboardingComplete: true,
      }).where(eq(users.id, userId));

      console.log(`[onboarding-handler] Profile saved for user ${userId}: ${profile.displayName}`);

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
