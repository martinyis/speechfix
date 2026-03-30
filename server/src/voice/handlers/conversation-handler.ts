import type { ConversationMessage } from '../response-generator.js';
import type { AgentTypeHandler, AgentConfig, FullUserContext, SessionEndResult } from './types.js';
import type { ChatTool } from '../tools.js';
import { END_SESSION_TOOL } from '../tools.js';
import { IDENTITY_PROMPT } from '../prompts/identity.js';
import { BEHAVIOR_PROMPT, CUSTOM_AGENT_BEHAVIOR_PROMPT } from '../prompts/behavior.js';
import { REFLEXA_SESSION_PROMPT, CUSTOM_AGENT_SESSION_PROMPT } from '../prompts/session-types/conversation.js';
import { buildUserContextPrompt } from '../prompts/context.js';
import { analyzeSpeech, analyzeSpeechStreaming } from '../../services/analysis.js';
import { generateSessionMetadata } from '../../services/title-generator.js';
import { extractConversationNotes } from '../../services/context-extractor.js';
import { db } from '../../db/index.js';
import { sessions, corrections, fillerWords, users } from '../../db/schema.js';
import { eq } from 'drizzle-orm';
import { regenerateAllGreetings } from '../../services/greeting-generator.js';

export class ConversationHandler implements AgentTypeHandler {
  readonly needsUserContext = true;

  buildSystemPrompt(agentConfig: AgentConfig | null, userContext?: FullUserContext, _formContext?: Record<string, unknown> | null): string {
    const layers: string[] = [];

    if (agentConfig) {
      // Custom agent path
      layers.push(`Your name is ${agentConfig.name}.\n\n${agentConfig.systemPrompt}`);
      layers.push(CUSTOM_AGENT_BEHAVIOR_PROMPT);
      if (agentConfig.behaviorPrompt) {
        layers.push(agentConfig.behaviorPrompt);
      }
      layers.push(CUSTOM_AGENT_SESSION_PROMPT);
      const contextPrompt = buildUserContextPrompt(userContext, agentConfig.id);
      if (contextPrompt) {
        layers.push(contextPrompt);
      }
    } else {
      // Reflexa path
      layers.push(IDENTITY_PROMPT);
      layers.push(BEHAVIOR_PROMPT);
      layers.push(REFLEXA_SESSION_PROMPT);
      const contextPrompt = buildUserContextPrompt(userContext, null);
      if (contextPrompt) {
        layers.push(contextPrompt);
      }
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
    agentConfig: AgentConfig | null,
    transcriptBuffer: string[],
    conversationHistory: ConversationMessage[],
    durationSeconds: number,
    _formContext?: Record<string, unknown> | null,
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
      await appendContextNotes(userId, contextNotes, agentConfig?.id ?? null);
    }

    // Fire-and-forget: regenerate greetings for next session
    regenerateAllGreetings(userId).catch(err =>
      console.error('[greeting] Regeneration failed:', err)
    );

    return {
      type: 'analysis',
      dbSessionId: session.id,
      clarityScore,
      analysisResults: {
        sentences: userUtterances,
        corrections: analysisResult.corrections,
        fillerWords: analysisResult.fillerWords,
        fillerPositions: analysisResult.fillerPositions,
        sessionInsights: analysisResult.sessionInsights,
      },
    };
  }

  async onSessionEndStreaming(
    userId: number,
    agentConfig: AgentConfig | null,
    transcriptBuffer: string[],
    conversationHistory: ConversationMessage[],
    durationSeconds: number,
    onCorrection: (correction: any) => void,
    _formContext?: Record<string, unknown> | null,
  ): Promise<SessionEndResult> {
    const fullTranscription = transcriptBuffer.join(' ');

    if (!fullTranscription.trim()) {
      return { type: 'analysis' };
    }

    const userUtterances = transcriptBuffer;

    // Run streaming analysis, title generation, and context extraction in parallel
    const [analysisResult, metadata, contextNotes] = await Promise.all([
      analyzeSpeechStreaming(userUtterances, 'conversation', conversationHistory, onCorrection),
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

    console.log(`[conversation-handler] Streaming session stored in DB: ${session.id}`);

    // Store analysis JSON
    await db.update(sessions).set({
      analysis: {
        sentences: userUtterances,
        fillerPositions: analysisResult.fillerPositions,
        sessionInsights: analysisResult.sessionInsights,
        conversationContext: conversationHistory,
      },
    }).where(eq(sessions.id, session.id));

    // Store corrections and get back their IDs
    let correctionIds: number[] = [];
    if (analysisResult.corrections.length > 0) {
      const inserted = await db.insert(corrections).values(
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
      ).returning();
      correctionIds = inserted.map(r => r.id);
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

    console.log(`[conversation-handler] Streaming analysis complete: ${analysisResult.corrections.length} corrections, ${analysisResult.fillerWords.length} filler types`);

    // Write context notes back to user
    if (contextNotes.length > 0) {
      await appendContextNotes(userId, contextNotes, agentConfig?.id ?? null);
    }

    // Fire-and-forget: regenerate greetings for next session
    regenerateAllGreetings(userId).catch(err =>
      console.error('[greeting] Regeneration failed:', err)
    );

    return {
      type: 'analysis',
      dbSessionId: session.id,
      clarityScore,
      correctionIds,
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
export async function appendContextNotes(userId: number, notes: string[], agentId?: number | null): Promise<void> {
  if (notes.length === 0) return;

  const [user] = await db.select({ contextNotes: users.contextNotes })
    .from(users)
    .where(eq(users.id, userId));

  const existing = (user?.contextNotes as Array<{ date: string; notes: string[]; agentId?: number | null }>) ?? [];

  const today = new Date().toISOString().slice(0, 10);
  existing.push({ date: today, notes, agentId: agentId ?? null });

  // Trim to last 20 entries
  const trimmed = existing.slice(-20);

  await db.update(users).set({ contextNotes: trimmed }).where(eq(users.id, userId));
}