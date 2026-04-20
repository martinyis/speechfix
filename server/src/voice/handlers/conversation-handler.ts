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
import { runAnalysis, runAnalysisPhased } from '../../analysis/index.js';
import type { PhasedInsightsPayload } from '../../analysis/types.js';
import { generateSessionMetadata } from '../../services/title-generator.js';
import { extractConversationNotes } from '../../services/context-extractor.js';
import { db } from '../../db/index.js';
import { sessions, corrections, fillerWords, users } from '../../db/schema.js';
import { eq } from 'drizzle-orm';
import { regenerateAllGreetings } from '../../services/greeting-generator.js';
import { absorbCorrections } from '../../services/weak-spot-manager.js';
import { runPatternAnalysisForUser } from '../../jobs/patterns.js';
import { generateSessionBriefInsights } from '../../services/session-insights-generator.js';
import { computeLanguageScore } from '../../services/scoring.js';

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

    // Skip analysis if no speech was captured
    if (!fullTranscription.trim()) {
      // Still regenerate greetings even if no speech
      regenerateAllGreetings(userId).catch(err =>
        console.error('[greeting] Regeneration failed (empty transcript):', err)
      );
      return { type: 'analysis' };
    }

    const userUtterances = transcriptBuffer;

    // Run speech analysis, title generation, and context extraction in parallel
    const [analysisResult, metadata, contextNotes] = await Promise.all([
      runAnalysis(userId, { sentences: userUtterances, mode: 'conversation', conversationHistory, speechTimeline }),
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

    // Start brief insights generation in parallel with DB writes
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

    // Await brief insights before storing analysis JSON
    const briefInsights = await briefInsightsPromise;
    const allInsights = [...analysisResult.sessionInsights, ...briefInsights];

    // Store analysis JSON
    await db.update(sessions).set({
      analysis: {
        sentences: userUtterances,
        fillerPositions: analysisResult.fillerPositions,
        sessionInsights: allInsights,
        conversationContext: conversationHistory,
        speechTimeline: speechTimeline ?? undefined,
      },
    }).where(eq(sessions.id, session.id));

    // Store corrections
    if (analysisResult.corrections.length > 0) {
      const inserted = await db.insert(corrections).values(
        analysisResult.corrections.map(c => ({
          sessionId: session.id,
          originalText: c.originalText,
          correctedText: c.correctedText,
          explanation: c.explanation || null,
          shortReason: c.shortReason || null,
          correctionType: c.correctionType || 'other',
          sentenceIndex: c.sentenceIndex,
          severity: c.severity,
          contextSnippet: c.contextSnippet || null,
        }))
      ).returning();

      // Fire-and-forget: absorb corrections into weak spots system
      absorbCorrections(userId, inserted.map(r => r.id), userUtterances).catch(err =>
        console.error('[conversation-handler] Failed to absorb corrections:', err)
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

    // Fire-and-forget: auto pattern analysis
    runPatternAnalysisForUser(userId).catch(err =>
      console.error('[conversation-handler] Auto pattern analysis failed:', err)
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
  ): Promise<SessionEndResult> {
    const fullTranscription = transcriptBuffer.join(' ');

    if (!fullTranscription.trim()) {
      regenerateAllGreetings(userId).catch(err =>
        console.error('[greeting] Regeneration failed (empty transcript):', err)
      );
      return { type: 'analysis' };
    }

    const userUtterances = transcriptBuffer;

    // Start title generation and context extraction in parallel with phased analysis
    const metadataPromise = generateSessionMetadata(fullTranscription, conversationHistory);
    const contextNotesPromise = extractConversationNotes(conversationHistory);

    // State shared between phased callbacks
    let dbSessionId = 0;
    let deliveryScore: number | null = null;
    let languageScore: number | null = null;
    let allInsights: any[] = [];
    let fillersPerMinute = 0;
    let totalWords = 0;

    // Run phased analysis: fillers → insights → grammar streaming
    const analysisResult = await runAnalysisPhased(
      userId,
      { sentences: userUtterances, mode: 'conversation', conversationHistory, speechTimeline },
      durationSeconds,
      // onPhasedInsights: fires after fillers + insights are ready, before grammar
      async (phasedPayload: PhasedInsightsPayload) => {
        deliveryScore = phasedPayload.deliveryScore;
        allInsights = phasedPayload.insights;
        fillersPerMinute = phasedPayload.metrics.fillersPerMinute;
        totalWords = userUtterances.join(' ').split(/\s+/).filter(Boolean).length;

        // Wait for metadata so we can create the DB session
        const metadata = await metadataPromise;

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
            clarityScore: deliveryScore ?? 100,
          })
          .returning();

        dbSessionId = session.id;
        console.log(`[conversation-handler] Phased: session stored in DB: ${dbSessionId}`);

        // Store filler words
        if (phasedPayload.fillerWords.length > 0) {
          await db.insert(fillerWords).values(
            phasedPayload.fillerWords.map(f => ({
              sessionId: dbSessionId,
              word: f.word,
              count: f.count,
            }))
          );
        }

        // Store initial analysis JSON (insights + fillers, no corrections yet)
        await db.update(sessions).set({
          analysis: {
            sentences: userUtterances,
            fillerPositions: phasedPayload.fillerPositions,
            sessionInsights: allInsights,
            conversationContext: conversationHistory,
            speechTimeline: speechTimeline ?? undefined,
          },
        }).where(eq(sessions.id, dbSessionId));

        // Notify client: insights are ready, navigate to session-detail
        onInsightsReady?.(phasedPayload, dbSessionId);
      },
      // onCorrection: streams individual corrections to client
      onCorrection,
    );

    // Compute clarity score from corrections
    const sentencesWithCorrections = new Set(
      analysisResult.corrections.map(c => c.sentenceIndex),
    ).size;
    const totalSentences = userUtterances.length;
    const clarityScore = totalSentences > 0
      ? Math.round((Math.max(0, totalSentences - sentencesWithCorrections) / totalSentences) * 100)
      : 100;

    // Store corrections and get back their IDs
    let correctionIds: number[] = [];
    if (analysisResult.corrections.length > 0 && dbSessionId > 0) {
      const inserted = await db.insert(corrections).values(
        analysisResult.corrections.map(c => ({
          sessionId: dbSessionId,
          originalText: c.originalText,
          correctedText: c.correctedText,
          explanation: c.explanation || null,
          shortReason: c.shortReason || null,
          correctionType: c.correctionType || 'other',
          sentenceIndex: c.sentenceIndex,
          severity: c.severity,
          contextSnippet: c.contextSnippet || null,
        }))
      ).returning();
      correctionIds = inserted.map(r => r.id);

      absorbCorrections(userId, correctionIds, userUtterances).catch(err =>
        console.error('[conversation-handler] Failed to absorb corrections:', err)
      );
    }

    // Add "Issues found" metric now that we know correction count
    allInsights.push({ type: 'metric', description: 'Issues found', value: analysisResult.corrections.length });

    // Compute deterministic Language score now that corrections are in hand.
    // Pattern analysis runs in the background (fire-and-forget below), so pass
    // undefined — pattern-flag deductions are skipped in this phase.
    languageScore = computeLanguageScore(
      analysisResult.corrections,
      fillersPerMinute,
      undefined,
      durationSeconds,
      totalWords,
    );
    if (languageScore !== null) {
      allInsights.push({ type: 'language_score', description: 'Language score', value: languageScore });
    }

    // Update analysis JSON with final insights (now includes corrections count + language score)
    if (dbSessionId > 0) {
      await db.update(sessions).set({
        analysis: {
          sentences: userUtterances,
          fillerPositions: analysisResult.fillerPositions,
          sessionInsights: allInsights,
          conversationContext: conversationHistory,
          speechTimeline: speechTimeline ?? undefined,
        },
        clarityScore,
      }).where(eq(sessions.id, dbSessionId));
    }

    console.log(`[conversation-handler] Phased analysis complete: ${analysisResult.corrections.length} corrections, ${analysisResult.fillerWords.length} filler types`);

    // Write context notes
    const contextNotes = await contextNotesPromise;
    if (contextNotes.length > 0) {
      await appendContextNotes(userId, contextNotes, agentConfig?.id ?? null);
    }

    // Fire-and-forget background tasks
    regenerateAllGreetings(userId).catch(err =>
      console.error('[greeting] Regeneration failed:', err)
    );
    runPatternAnalysisForUser(userId).catch(err =>
      console.error('[conversation-handler] Auto pattern analysis failed:', err)
    );

    return {
      type: 'analysis',
      dbSessionId,
      clarityScore,
      score: languageScore ?? deliveryScore ?? null,
      deliveryScore,
      languageScore,
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