import type { ConversationMessage } from '../response-generator.js';
import type { AgentTypeHandler, AgentConfig, FullUserContext, SessionEndResult } from './types.js';
import type { SpeechTimeline } from '../speech-types.js';
import type { ChatTool } from '../tools.js';
import { END_SESSION_TOOL } from '../tools.js';
import { IDENTITY_PROMPT } from '../prompts/identity.js';
import { BEHAVIOR_PROMPT, CUSTOM_AGENT_BEHAVIOR_PROMPT } from '../prompts/behavior.js';
import { REFLEXA_SESSION_PROMPT, CUSTOM_AGENT_SESSION_PROMPT } from '../prompts/session-types/conversation.js';
import { buildUserContextPrompt } from '../prompts/context.js';
import { resolveElicitationStyle, ELICITATION_PROMPTS } from '../prompts/elicitation.js';
import { runAnalysis, runAnalysisPhased } from '../../../analysis/index.js';
import type { PhasedInsightsPayload } from '../../../analysis/types.js';
import { generateSessionMetadata } from '../../sessions/title-generator.js';
import { extractConversationNotes } from '../../sessions/context-extractor.js';
import { db } from '../../../db/index.js';
import { sessions, users } from '../../../db/schema.js';
import { eq } from 'drizzle-orm';
import { generateSessionBriefInsights } from '../../sessions/insights-generator.js';
import { generateAndPersistDeepInsights, type DeepInsight } from '../../sessions/deep-insights.js';
import {
  handleEmptyTranscript,
  insertCorrectionsBatch,
  insertFillerWordsBatch,
  runPostAnalysisSideEffects,
} from './session-persist.js';

export class ConversationHandler implements AgentTypeHandler {
  readonly needsUserContext = true;
  readonly greetingStrategy = 'pregenerated' as const;
  readonly maxCompletionTokens = { withTools: 200, withoutTools: 100 };

  buildSystemPrompt(agentConfig: AgentConfig | null, userContext?: FullUserContext, _formContext?: Record<string, unknown> | null): string {
    const layers: string[] = [];

    const elicitationFragment = ELICITATION_PROMPTS[resolveElicitationStyle(agentConfig)];

    if (agentConfig) {
      // Custom agent path
      layers.push(`Your name is ${agentConfig.name}.\n\n${agentConfig.systemPrompt}`);
      layers.push(CUSTOM_AGENT_BEHAVIOR_PROMPT);
      if (agentConfig.behaviorPrompt) {
        layers.push(agentConfig.behaviorPrompt);
      }
      layers.push(CUSTOM_AGENT_SESSION_PROMPT);
      if (elicitationFragment) {
        layers.push(elicitationFragment);
      }
      const contextPrompt = buildUserContextPrompt(userContext, agentConfig.id);
      if (contextPrompt) {
        layers.push(contextPrompt);
      }
    } else {
      // Reflexa path
      layers.push(IDENTITY_PROMPT);
      layers.push(BEHAVIOR_PROMPT);
      layers.push(REFLEXA_SESSION_PROMPT);
      if (elicitationFragment) {
        layers.push(elicitationFragment);
      }
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
    speechTimeline?: SpeechTimeline,
  ): Promise<SessionEndResult> {
    const fullTranscription = transcriptBuffer.join(' ');

    if (!fullTranscription.trim()) {
      handleEmptyTranscript(userId);
      return { type: 'analysis' };
    }

    const userUtterances = transcriptBuffer;

    const [analysisResult, metadata, contextNotes] = await Promise.all([
      runAnalysis(userId, { sentences: userUtterances, mode: 'conversation', conversationHistory, speechTimeline }),
      generateSessionMetadata(fullTranscription, conversationHistory),
      extractConversationNotes(conversationHistory),
    ]);

    const briefInsightsPromise = generateSessionBriefInsights({
      sentences: userUtterances,
      corrections: analysisResult.corrections,
      fillerWords: analysisResult.fillerWords,
      durationSeconds,
      existingInsights: analysisResult.sessionInsights,
    }).catch(err => {
      console.error('[conversation-handler] Brief insights failed:', err);
      return [];
    });

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
      })
      .returning();

    const briefInsights = await briefInsightsPromise;
    const allInsights = [...analysisResult.sessionInsights, ...briefInsights];

    await db.update(sessions).set({
      analysis: {
        sentences: userUtterances,
        fillerPositions: analysisResult.fillerPositions,
        sessionInsights: allInsights,
        conversationContext: conversationHistory,
        speechTimeline: speechTimeline ?? undefined,
      },
    }).where(eq(sessions.id, session.id));

    const correctionIds = await insertCorrectionsBatch(session.id, analysisResult.corrections);
    await insertFillerWordsBatch(session.id, analysisResult.fillerWords);

    console.log(`[conversation-handler] Session stored: ${session.id} — ${analysisResult.corrections.length} corrections, ${analysisResult.fillerWords.length} filler types`);

    await runPostAnalysisSideEffects({
      userId, agentConfig, correctionIds, userUtterances, contextNotes,
    });

    return {
      type: 'analysis',
      dbSessionId: session.id,
      analysisResults: {
        sentences: userUtterances,
        corrections: analysisResult.corrections,
        fillerWords: analysisResult.fillerWords,
        fillerPositions: analysisResult.fillerPositions,
        sessionInsights: allInsights,
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
    onInsightsReady?: (payload: any, dbSessionId: number) => void,
    speechTimeline?: SpeechTimeline,
    onDeepInsightsReady?: (insights: DeepInsight[], dbSessionId: number) => void,
  ): Promise<SessionEndResult> {
    const fullTranscription = transcriptBuffer.join(' ');

    if (!fullTranscription.trim()) {
      handleEmptyTranscript(userId);
      return { type: 'analysis' };
    }

    const userUtterances = transcriptBuffer;

    const metadataPromise = generateSessionMetadata(fullTranscription, conversationHistory);
    const contextNotesPromise = extractConversationNotes(conversationHistory);

    let dbSessionId = 0;
    let allInsights: any[] = [];

    const analysisResult = await runAnalysisPhased(
      userId,
      { sentences: userUtterances, mode: 'conversation', conversationHistory, speechTimeline },
      durationSeconds,
      async (phasedPayload: PhasedInsightsPayload) => {
        allInsights = phasedPayload.insights;

        const metadata = await metadataPromise;

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
          })
          .returning();
        dbSessionId = session.id;

        await insertFillerWordsBatch(dbSessionId, phasedPayload.fillerWords);

        await db.update(sessions).set({
          analysis: {
            sentences: userUtterances,
            fillerPositions: phasedPayload.fillerPositions,
            sessionInsights: allInsights,
            conversationContext: conversationHistory,
            speechTimeline: speechTimeline ?? undefined,
          },
        }).where(eq(sessions.id, dbSessionId));

        onInsightsReady?.(phasedPayload, dbSessionId);
      },
      onCorrection,
    );

    let correctionIds: number[] = [];
    if (dbSessionId > 0) {
      correctionIds = await insertCorrectionsBatch(dbSessionId, analysisResult.corrections);
    }

    allInsights.push({ type: 'metric', description: 'Issues found', value: analysisResult.corrections.length });

    if (dbSessionId > 0) {
      await db.update(sessions).set({
        analysis: {
          sentences: userUtterances,
          fillerPositions: analysisResult.fillerPositions,
          sessionInsights: allInsights,
          conversationContext: conversationHistory,
          speechTimeline: speechTimeline ?? undefined,
        },
      }).where(eq(sessions.id, dbSessionId));
    }

    console.log(`[conversation-handler] Phased: ${analysisResult.corrections.length} corrections, ${analysisResult.fillerWords.length} filler types`);

    // Fire-and-forget deep insights: ~10s on Opus. Must NOT block analysis_complete.
    if (dbSessionId > 0 && speechTimeline) {
      const capturedDbSessionId = dbSessionId;
      const metadata = await metadataPromise;
      const conversationTranscript = conversationHistory
        .filter(m => m.content && m.content !== '[Session started]' && !m.content.startsWith('[User has been silent'))
        .map(m => ({
          role: (m.role === 'assistant' ? 'ai' : 'user') as 'ai' | 'user',
          text: m.content,
        }));

      void generateAndPersistDeepInsights(capturedDbSessionId, {
        speechTimeline,
        conversationTranscript,
        corrections: analysisResult.corrections.map(c => ({
          originalText: c.originalText,
          correctedText: c.correctedText,
          correctionType: c.correctionType,
          severity: c.severity,
        })),
        fillerWords: analysisResult.fillerWords,
        fillerPositions: analysisResult.fillerPositions.map(p => ({
          word: p.word,
          sentenceIndex: p.sentenceIndex,
          time: p.timeSeconds ?? null,
        })),
        topicCategory: metadata.topicCategory ?? null,
        sessionTitle: metadata.title ?? null,
        durationSeconds,
      }).then(insights => {
        if (insights !== null) {
          onDeepInsightsReady?.(insights, capturedDbSessionId);
        }
      }).catch(err => {
        console.error(`[conversation-handler] Deep insights job crashed for session ${capturedDbSessionId}:`, err);
      });
    }

    const contextNotes = await contextNotesPromise;
    await runPostAnalysisSideEffects({
      userId, agentConfig, correctionIds, userUtterances, contextNotes,
    });

    return {
      type: 'analysis',
      dbSessionId,
      correctionIds,
      analysisResults: {
        sentences: userUtterances,
        corrections: analysisResult.corrections,
        fillerWords: analysisResult.fillerWords,
        fillerPositions: analysisResult.fillerPositions,
        sessionInsights: allInsights,
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