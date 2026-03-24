import type { ConversationMessage } from '../response-generator.js';
import type { AgentTypeHandler, AgentConfig, FullUserContext, SessionEndResult } from './types.js';
import { IDENTITY_PROMPT } from '../prompts/identity.js';
import { BEHAVIOR_PROMPT } from '../prompts/behavior.js';
import { CONVERSATION_SESSION_PROMPT } from '../prompts/session-types/conversation.js';
import { buildUserContextPrompt } from '../prompts/context.js';
import { analyzeSpeech } from '../../services/analysis.js';
import { generateSessionMetadata } from '../../services/title-generator.js';
import { extractConversationNotes } from '../../services/context-extractor.js';
import { db } from '../../db/index.js';
import { sessions, corrections, fillerWords, users } from '../../db/schema.js';
import { eq } from 'drizzle-orm';

export class ConversationHandler implements AgentTypeHandler {
  readonly needsUserContext = true;

  buildSystemPrompt(agentConfig: AgentConfig | null, userContext?: FullUserContext): string {
    const layers: string[] = [];

    // Identity layer: custom agent prompt or default
    if (agentConfig) {
      layers.push(agentConfig.systemPrompt);
    } else {
      layers.push(IDENTITY_PROMPT);
    }

    // Behavior layer: always include universal rules
    layers.push(BEHAVIOR_PROMPT);

    // Custom behavior additions from agent config
    if (agentConfig?.behaviorPrompt) {
      layers.push(agentConfig.behaviorPrompt);
    }

    // Session type layer
    layers.push(CONVERSATION_SESSION_PROMPT);

    // User context layer
    const contextPrompt = buildUserContextPrompt(userContext);
    if (contextPrompt) {
      layers.push(contextPrompt);
    }

    return layers.join('\n\n');
  }

  shouldAutoEnd(_turnCount: number, _conversationHistory: ConversationMessage[]): boolean {
    return false;
  }

  async onSessionEnd(
    userId: number,
    agentConfig: AgentConfig | null,
    transcriptBuffer: string[],
    conversationHistory: ConversationMessage[],
    durationSeconds: number,
  ): Promise<SessionEndResult> {
    const fullTranscription = transcriptBuffer.join(' ');

    // Skip analysis if no speech was captured
    if (!fullTranscription.trim()) {
      return { type: 'analysis' };
    }

    const userUtterances = transcriptBuffer;

    // Run speech analysis, title generation, and context extraction in parallel
    const [analysisResult, metadata, contextNotes] = await Promise.all([
      analyzeSpeech(userUtterances, 'conversation', conversationHistory),
      generateSessionMetadata(fullTranscription, conversationHistory),
      extractConversationNotes(conversationHistory),
    ]);

    // Compute clarity score
    const sentencesWithCorrections = new Set(
      analysisResult.corrections.map((c) => c.sentenceIndex),
    ).size;
    const totalSentences = userUtterances.length;
    const clarityScore = totalSentences > 0
      ? Math.round((Math.max(0, totalSentences - sentencesWithCorrections) / totalSentences) * 100)
      : 100;

    // Create session in DB
    const [session] = await db
      .insert(sessions)
      .values({
        userId,
        agentId: agentConfig?.id ?? null,
        type: 'voice',
        status: 'completed',
        transcription: fullTranscription,
        durationSeconds,
        conversationTranscript: conversationHistory,
        title: metadata.title,
        description: metadata.description,
        topicCategory: metadata.topicCategory,
        clarityScore,
      })
      .returning();

    console.log(`[conversation-handler] Session stored in DB: ${session.id}`);

    // Store analysis JSON
    await db.update(sessions).set({
      analysis: {
        sentences: userUtterances,
        fillerPositions: analysisResult.fillerPositions,
        sessionInsights: analysisResult.sessionInsights,
        conversationContext: conversationHistory,
      },
    }).where(eq(sessions.id, session.id));

    // Store corrections
    if (analysisResult.corrections.length > 0) {
      await db.insert(corrections).values(
        analysisResult.corrections.map(c => ({
          sessionId: session.id,
          originalText: c.originalText,
          correctedText: c.correctedText,
          explanation: c.explanation || null,
          correctionType: c.correctionType || 'other',
          sentenceIndex: c.sentenceIndex,
          severity: c.severity,
          contextSnippet: c.contextSnippet || null,
        }))
      );
    }

    // Store filler words
    if (analysisResult.fillerWords.length > 0) {
      await db.insert(fillerWords).values(
        analysisResult.fillerWords.map(f => ({
          sessionId: session.id,
          word: f.word,
          count: f.count,
        }))
      );
    }

    console.log(`[conversation-handler] Analysis complete: ${analysisResult.corrections.length} corrections, ${analysisResult.fillerWords.length} filler types`);

    // Write context notes back to user
    if (contextNotes.length > 0) {
      await appendContextNotes(userId, contextNotes);
    }

    return {
      type: 'analysis',
      dbSessionId: session.id,
      analysisResults: {
        sentences: userUtterances,
        corrections: analysisResult.corrections,
        fillerWords: analysisResult.fillerWords,
        fillerPositions: analysisResult.fillerPositions,
        sessionInsights: analysisResult.sessionInsights,
      },
    };
  }
}

/**
 * Appends context notes to a user's contextNotes array.
 * Keeps only the most recent 20 entries.
 */
export async function appendContextNotes(userId: number, notes: string[]): Promise<void> {
  if (notes.length === 0) return;

  const [user] = await db.select({ contextNotes: users.contextNotes })
    .from(users)
    .where(eq(users.id, userId));

  const existing = (user?.contextNotes as Array<{ date: string; notes: string[] }>) ?? [];

  const today = new Date().toISOString().slice(0, 10);
  existing.push({ date: today, notes });

  // Trim to last 20 entries
  const trimmed = existing.slice(-20);

  await db.update(users).set({ contextNotes: trimmed }).where(eq(users.id, userId));
}
