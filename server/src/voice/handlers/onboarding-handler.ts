import type { ConversationMessage } from '../response-generator.js';
import type { AgentTypeHandler, AgentConfig, FullUserContext, SessionEndResult } from './types.js';
import { IDENTITY_PROMPT } from '../prompts/identity.js';
import { BEHAVIOR_PROMPT } from '../prompts/behavior.js';
import { ONBOARDING_SESSION_PROMPT } from '../prompts/session-types/onboarding.js';
import { extractUserProfile } from '../../services/profile-extractor.js';
import { db } from '../../db/index.js';
import { users } from '../../db/schema.js';
import { eq } from 'drizzle-orm';

export class OnboardingHandler implements AgentTypeHandler {
  readonly needsUserContext = false;

  buildSystemPrompt(_agentConfig: AgentConfig | null, _userContext?: FullUserContext): string {
    return [IDENTITY_PROMPT, BEHAVIOR_PROMPT, ONBOARDING_SESSION_PROMPT].join('\n\n');
  }

  shouldAutoEnd(turnCount: number, _conversationHistory: ConversationMessage[]): boolean {
    return turnCount >= 2;
  }

  async onSessionEnd(
    userId: number,
    _agentConfig: AgentConfig | null,
    _transcriptBuffer: string[],
    conversationHistory: ConversationMessage[],
    _durationSeconds: number,
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

      return {
        type: 'onboarding',
        success: true,
        displayName: profile.displayName,
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
