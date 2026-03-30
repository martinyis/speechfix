import { WebSocket } from 'ws';
import { DeepgramClient, TranscriptResult } from './deepgram.js';
import { generateResponse } from './response-generator.js';
import type { ConversationMessage, ResponseMeta } from './response-generator.js';
import { ElevenLabsTTS } from './tts.js';
import { detectTurnHeuristic, detectTurnLLM } from './turn-detector.js';
import type { AgentTypeHandler, AgentConfig, FullUserContext } from './handlers/types.js';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { fetchAndConsumeGreeting, regenerateAllGreetings } from '../services/greeting-generator.js';
import { hasLowConfidenceWords, correctTranscript, type WordWithConfidence } from '../services/transcript-corrector.js';

const SPEECH_FINAL_DEBOUNCE_MS = 1200;

export type SessionState = 'idle' | 'listening' | 'thinking' | 'speaking';

export class VoiceSession {
  sessionId: string;
  ws: WebSocket;
  state: SessionState = 'idle';
  transcriptBuffer: string[] = [];
  conversationHistory: ConversationMessage[] = [];
  currentUtteranceBuffer = '';
  private currentUtteranceWords: WordWithConfidence[] = [];
  activeAbortController: AbortController | null = null;
  startTime: number = 0;
  audioChunkCount = 0;
  private isSpeaking = false;
  private muted = false;
  private muteTranscriptBuffer: string[] = [];
  private greetingDone = false;
  private speakingEndedAt = 0;
  private currentTurnId = 0;
  private turnAudioBytes = 0;
  private turnCount = 0;

  private deepgram: DeepgramClient | null = null;
  private tts: ElevenLabsTTS | null = null;
  private userId: number;
  private handler: AgentTypeHandler;
  private agentConfig: AgentConfig | null;
  private formContext: Record<string, unknown> | null;
  private systemPrompt: string = '';
  private sessionEnding = false;
  private speechFinalTimer: ReturnType<typeof setTimeout> | null = null;
  private silenceTimer: ReturnType<typeof setTimeout> | null = null;
  private silenceNudgeCount = 0;
  private sessionMaxTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(ws: WebSocket, userId: number, handler: AgentTypeHandler, agentConfig: AgentConfig | null, formContext?: Record<string, unknown> | null) {
    this.sessionId = crypto.randomUUID();
    this.ws = ws;
    this.userId = userId;
    this.handler = handler;
    this.agentConfig = agentConfig;
    this.formContext = formContext ?? null;
  }

  async start() {
    this.startTime = Date.now();
    this.state = 'listening';

    // --- Parallel setup: fetch user context + greeting, connect Deepgram + ElevenLabs ---
    const deepgramKey = process.env.DEEPGRAM_API_KEY;
    const elevenLabsKey = process.env.ELEVENLABS_API_KEY;
    const voiceId = this.agentConfig?.voiceId || process.env.ELEVENLABS_VOICE_ID;

    const contextAndGreetingPromise = (async () => {
      let userContext: FullUserContext | undefined;
      let preGeneratedGreeting: string | null = null;

      if (this.handler.needsUserContext) {
        try {
          const [userResult, greeting] = await Promise.all([
            db.select({
              displayName: users.displayName,
              context: users.context,
              goals: users.goals,
              contextNotes: users.contextNotes,
            }).from(users).where(eq(users.id, this.userId)),
            fetchAndConsumeGreeting(this.userId, this.agentConfig?.id ?? null),
          ]);
          if (userResult[0]) {
            userContext = {
              displayName: userResult[0].displayName,
              context: userResult[0].context,
              goals: userResult[0].goals as string[] | null,
              contextNotes: userResult[0].contextNotes as FullUserContext['contextNotes'],
            };
          }
          preGeneratedGreeting = greeting;
        } catch (err) {
          console.error('[voice-session] Failed to fetch user profile/greeting:', err);
        }
      }

      return { userContext, preGeneratedGreeting };
    })();

    const deepgramPromise = (async () => {
      if (!deepgramKey) {
        console.warn('[voice-session] No DEEPGRAM_API_KEY, STT disabled');
        return;
      }
      this.deepgram = new DeepgramClient(deepgramKey, {
        onTranscript: (result) => this.onTranscript(result),
        onUtteranceEnd: () => this.onUtteranceEnd(),
        onError: (err) => console.error(`[voice-session] Deepgram error:`, err),
        onClose: () => console.log(`[voice-session] Deepgram connection closed`),
      });
      try {
        await this.deepgram.connect();
        console.log(`[voice-session] Deepgram connected for session ${this.sessionId}`);
      } catch (err) {
        console.error(`[voice-session] Failed to connect Deepgram:`, err);
        this.deepgram = null;
      }
    })();

    const ttsPromise = (async () => {
      if (!elevenLabsKey || !voiceId) {
        console.warn('[voice-session] No ELEVENLABS_API_KEY/VOICE_ID, TTS disabled');
        return;
      }
      this.tts = new ElevenLabsTTS(elevenLabsKey, voiceId, {
        onAudio: (base64Chunk) => {
          if (this.isSpeaking) {
            this.turnAudioBytes += Math.ceil(base64Chunk.length * 3 / 4);
            this.sendToClient({ type: 'audio', data: base64Chunk, turnId: this.currentTurnId });
          }
        },
        onDone: () => {
          console.log(`[voice-session] TTS done for turn`);
        },
        onError: (err) => {
          console.error(`[voice-session] TTS error:`, err);
        },
      });
      try {
        await this.tts.connect();
        console.log(`[voice-session] ElevenLabs connected for session ${this.sessionId}`);
      } catch (err) {
        console.error(`[voice-session] Failed to connect ElevenLabs:`, err);
        this.tts = null;
      }
    })();

    // Wait for all parallel setup to complete
    const [{ userContext, preGeneratedGreeting }] = await Promise.all([
      contextAndGreetingPromise,
      deepgramPromise,
      ttsPromise,
    ]);

    // Build system prompt via handler
    this.systemPrompt = this.handler.buildSystemPrompt(this.agentConfig, userContext, this.formContext);

    this.sendToClient({ type: 'ready', sessionId: this.sessionId });
    console.log(`[DEBUG] Sent 'ready' to client`);

    // --- Greeting: use pre-generated text or fall back to Claude ---
    console.log(`[DEBUG] Starting greeting generation`);

    const sentinel = '[Session started]';
    this.conversationHistory.push({ role: 'user', content: sentinel });

    if (preGeneratedGreeting) {
      console.log(`[DEBUG] Using pre-generated greeting: "${preGeneratedGreeting}"`);
      await this.sendGreetingDirectly(preGeneratedGreeting);

      // Fire-and-forget: regenerate greetings for next session
      regenerateAllGreetings(this.userId).catch(err =>
        console.error('[greeting] Background regeneration failed:', err)
      );
    } else {
      console.log(`[DEBUG] No pre-generated greeting, falling back to Claude`);
      await this.generateAndSendResponse();
    }

    this.greetingDone = true;
    console.log(`[DEBUG] Greeting done, greetingDone=${this.greetingDone}, state=${this.state}, isSpeaking=${this.isSpeaking}`);

    // Start max session duration timer (cost protection)
    if (this.handler.maxSessionDurationMs) {
      this.sessionMaxTimer = setTimeout(() => {
        if (!this.sessionEnding) {
          console.log(`[voice-session] Max duration reached, ending session`);
          this.handleDone();
        }
      }, this.handler.maxSessionDurationMs);
    }
  }

  handleAudio(base64Data: string) {
    if (this.state === 'idle') return;

    this.audioChunkCount++;

    // Don't forward audio to Deepgram until the greeting has finished playing,
    // otherwise the user's mic picks up sound that interrupts the greeting.
    if (!this.greetingDone) {
      if (this.audioChunkCount % 50 === 1) {
        console.log(`[audio-pipe] ⏸ Dropping chunk #${this.audioChunkCount} (greeting not done)`);
      }
      return;
    }

    // Don't forward audio while AI is speaking — prevents echo from being transcribed.
    // Also skip for 800ms after AI finishes to catch trailing echo.
    if (this.isSpeaking || (this.speakingEndedAt && Date.now() - this.speakingEndedAt < 800)) {
      if (this.audioChunkCount % 20 === 0) {
        const reason = this.isSpeaking ? 'AI speaking' : `echo grace (${Date.now() - this.speakingEndedAt}ms since speak end)`;
        console.log(`[audio-pipe] ⏸ Dropping chunk #${this.audioChunkCount} (${reason})`);
      }
      return;
    }

    // Forward audio to Deepgram for transcription
    if (this.deepgram) {
      const buffer = Buffer.from(base64Data, 'base64');
      if (this.audioChunkCount % 20 === 0) {
        console.log(`[audio-pipe] ✅ Forwarding chunk #${this.audioChunkCount} to Deepgram: ${buffer.length} bytes`);
      }
      this.deepgram.sendAudio(buffer);
    } else {
      if (this.audioChunkCount % 50 === 0) {
        console.log(`[audio-pipe] ⚠️ No Deepgram client, chunk #${this.audioChunkCount} dropped`);
      }
    }
  }

  private onTranscript(result: TranscriptResult) {
    // Audio is not forwarded to Deepgram while AI is speaking (echo prevention),
    // so we shouldn't get transcripts during speech. But guard just in case.
    if (this.isSpeaking) {
      console.log(`[audio-pipe] ⚠️ Transcript received while AI speaking (ignored): "${result.text}"`);
      return;
    }

    // Log every transcript with word-level confidence
    const wordDetails = result.words
      .map(w => `"${w.word}"(${(w.confidence * 100).toFixed(0)}%)`)
      .join(' ');
    console.log(`[audio-pipe] 🎯 Transcript [final=${result.isFinal}, speechFinal=${result.speechFinal}, confidence=${(result.confidence * 100).toFixed(1)}%]: "${result.text}"`);
    console.log(`[audio-pipe] 📝 Words: ${wordDetails}`);

    if (result.isFinal) {
      this.currentUtteranceBuffer += (this.currentUtteranceBuffer ? ' ' : '') + result.text;
      for (const w of result.words) {
        this.currentUtteranceWords.push({ word: w.word, confidence: w.confidence });
      }
      console.log(`[audio-pipe] 📋 Utterance buffer now: "${this.currentUtteranceBuffer}"`);
    }

    this.sendToClient({
      type: 'transcript',
      text: result.text,
      final: result.isFinal,
    });

    if (result.speechFinal) {
      console.log(`[audio-pipe] 🔚 Speech final detected, starting ${SPEECH_FINAL_DEBOUNCE_MS}ms debounce`);
      // Debounce: reset timer on each speechFinal so we wait for the user to finish
      if (this.speechFinalTimer) clearTimeout(this.speechFinalTimer);
      this.speechFinalTimer = setTimeout(() => {
        this.speechFinalTimer = null;
        this.onSpeechFinalDebounced();
      }, SPEECH_FINAL_DEBOUNCE_MS);
    }
  }

  private async onSpeechFinal() {
    if (this.sessionEnding) return;
    this.clearSilenceTimer();
    this.silenceNudgeCount = 0;

    let utterance = this.currentUtteranceBuffer.trim();
    const words = this.currentUtteranceWords;
    this.currentUtteranceBuffer = '';
    this.currentUtteranceWords = [];

    if (!utterance) return;

    // Correct low-confidence words via LLM before they enter conversation history
    if (words.length > 0 && hasLowConfidenceWords(words)) {
      const lowWords = words.filter(w => w.confidence < 0.80);
      console.log(`[transcript-correction] Low-confidence words detected: ${lowWords.map(w => `"${w.word}"(${(w.confidence * 100).toFixed(0)}%)`).join(', ')}`);
      const corrected = await correctTranscript(utterance, words, this.conversationHistory);
      if (corrected !== utterance) {
        console.log(`[transcript-correction] Corrected: "${utterance}" → "${corrected}"`);
        utterance = corrected;
      } else {
        console.log(`[transcript-correction] No changes needed`);
      }
    }

    console.log(`[voice-session] Speech final, utterance: "${utterance}"`);
    this.transcriptBuffer.push(utterance);

    // Merge consecutive user messages to maintain role alternation (required by Anthropic API)
    const lastMsg = this.conversationHistory[this.conversationHistory.length - 1];
    if (lastMsg?.role === 'user') {
      lastMsg.content += ' ' + utterance;
    } else {
      this.conversationHistory.push({ role: 'user', content: utterance });
    }

    // Muted = solo practice mode: accumulate transcripts, never respond
    if (this.muted) {
      this.muteTranscriptBuffer.push(utterance);
      return;
    }

    this.turnCount++;

    // Generate response first
    await this.generateAndSendResponse();

    // Then check if handler wants to auto-end
    if (this.handler.shouldAutoEnd(this.turnCount, this.conversationHistory)) {
      await this.handleDone();
    }
  }

  /** Debounced speech-final: runs turn detection before responding. */
  private async onSpeechFinalDebounced() {
    if (this.sessionEnding || this.isSpeaking) return;

    const utterance = this.currentUtteranceBuffer.trim();
    if (!utterance) return;

    const decision = detectTurnHeuristic(utterance, this.conversationHistory);
    console.log(`[turn-detector] heuristic: "${utterance}" → ${decision}`);

    if (decision === 'respond') {
      this.onSpeechFinal();
      return;
    }

    if (decision === 'wait') {
      console.log(`[turn-detector] waiting for more speech`);
      return;
    }

    // uncertain → run LLM for a more nuanced decision
    console.log(`[turn-detector] uncertain, running LLM detection`);
    const context = this.conversationHistory
      .slice(-4)
      .map(m => `${m.role}: ${m.content}`)
      .join('\n');
    const llmDecision = await detectTurnLLM(utterance, context);
    console.log(`[turn-detector] LLM: "${utterance}" → ${llmDecision}`);

    if (llmDecision === 'respond') {
      this.onSpeechFinal();
    } else {
      console.log(`[turn-detector] LLM says wait, keeping listener open`);
    }
  }

  /** Ensure TTS is connected, reconnecting if needed. */
  private async ensureTTSConnected(): Promise<boolean> {
    if (!this.tts) return false;
    if (this.tts.isConnected()) return true;

    console.log(`[DEBUG] TTS disconnected, reconnecting...`);
    try {
      await this.tts.connect();
      console.log(`[DEBUG] TTS reconnected`);
      return true;
    } catch (err) {
      console.error(`[voice-session] Failed to reconnect TTS:`, err);
      return false;
    }
  }

  /** Send pre-generated greeting text directly to TTS, bypassing Claude. */
  private async sendGreetingDirectly(greetingText: string) {
    this.currentTurnId++;
    this.turnAudioBytes = 0;
    this.state = 'speaking';
    this.isSpeaking = true;
    this.sendToClient({ type: 'turn_state', state: 'speaking', turnId: this.currentTurnId });

    await this.ensureTTSConnected();
    this.tts?.startTurn();

    if (this.tts) {
      this.tts.sendText(greetingText);
      this.tts.flush();
      await this.tts.waitForCompletion();
    }

    this.conversationHistory.push({ role: 'assistant', content: greetingText });

    this.sendToClient({
      type: 'audio_end',
      turnId: this.currentTurnId,
      totalAudioBytes: this.turnAudioBytes,
    });

    this.isSpeaking = false;
    this.speakingEndedAt = Date.now();
    this.state = 'listening';
    this.sendToClient({ type: 'turn_state', state: 'listening', turnId: this.currentTurnId });
    console.log(`[DEBUG] sendGreetingDirectly done, audioBytes=${this.turnAudioBytes}`);

    this.startSilenceTimer();
  }

  private async generateAndSendResponse() {
    if (this.sessionEnding) return;
    console.log(`[DEBUG] generateAndSendResponse() called, state=${this.state}, isSpeaking=${this.isSpeaking}`);
    const abortController = new AbortController();
    this.activeAbortController = abortController;
    this.currentTurnId++;
    this.turnAudioBytes = 0;

    this.state = 'speaking';
    this.isSpeaking = true;
    this.sendToClient({ type: 'turn_state', state: 'speaking', turnId: this.currentTurnId });
    console.log(`[DEBUG] Set state=speaking, turnId=${this.currentTurnId}`);

    // Ensure TTS is connected before starting
    await this.ensureTTSConnected();
    this.tts?.startTurn();

    let fullResponse = '';
    const tools = this.handler.getTools?.() ?? [];
    const meta: ResponseMeta = { toolCalls: [] };

    try {
      const responseGen = generateResponse(
        this.conversationHistory,
        abortController.signal,
        this.systemPrompt,
        tools.length > 0 ? tools : undefined,
        meta,
      );

      for await (const chunk of responseGen) {
        if (abortController.signal.aborted) break;

        fullResponse += (fullResponse ? ' ' : '') + chunk;
        console.log(`[voice-session] Response chunk: "${chunk}"`);

        // Pipe to TTS — reconnect mid-stream if connection dropped
        if (this.tts) {
          const sent = this.tts.sendText(chunk);
          if (!sent) {
            console.log(`[DEBUG] TTS send failed mid-stream, reconnecting...`);
            const reconnected = await this.ensureTTSConnected();
            if (reconnected) {
              // Resend this chunk on the fresh connection
              this.tts.sendText(chunk);
            }
          }
        }
      }

      // Flush remaining TTS buffer and wait for all audio to be delivered
      if (!abortController.signal.aborted && this.tts) {
        console.log(`[DEBUG] Flushing TTS (EOS signal)`);
        this.tts.flush();
        console.log(`[DEBUG] Waiting for TTS completion...`);
        await this.tts.waitForCompletion();
        console.log(`[DEBUG] TTS complete, ${this.turnAudioBytes} audio bytes sent`);
      }

      if (!abortController.signal.aborted && fullResponse) {
        this.conversationHistory.push({ role: 'assistant', content: fullResponse });
        console.log(`[DEBUG] Full response stored: "${fullResponse}"`);
      }
    } catch (err: any) {
      if (err.name !== 'AbortError' && !abortController.signal.aborted) {
        console.error(`[voice-session] Response generation error:`, err);
      } else {
        console.log(`[DEBUG] Response generation aborted`);
      }
    } finally {
      if (this.activeAbortController === abortController) {
        this.activeAbortController = null;
      }

      // Tell client all audio has been sent, with total bytes so it can estimate playback
      this.sendToClient({
        type: 'audio_end',
        turnId: this.currentTurnId,
        totalAudioBytes: this.turnAudioBytes,
      });

      this.isSpeaking = false;
      this.speakingEndedAt = Date.now();
      this.state = 'listening';
      // Single state message instead of duplicate agent_speaking + turn_state
      this.sendToClient({ type: 'turn_state', state: 'listening', turnId: this.currentTurnId });
      console.log(`[DEBUG] generateAndSendResponse done, state=listening, audioBytes=${this.turnAudioBytes}`);
    }

    // Voice-initiated session end: farewell audio already fully streamed
    if (meta.toolCalls.includes('end_session') || meta.toolCalls.includes('end_onboarding')) {
      console.log(`[voice-session] ${meta.toolCalls.includes('end_onboarding') ? 'end_onboarding' : 'end_session'} tool called, ending session`);
      this.sendToClient({ type: 'session_ending' });
      await this.handleDone();
      return;
    }

    // Start silence timer after AI finishes speaking (if handler opts in)
    this.startSilenceTimer();
  }

  private startSilenceTimer() {
    if (!this.handler.silenceTimeoutMs) return;
    this.clearSilenceTimer();
    this.silenceTimer = setTimeout(() => this.onSilenceTimeout(), this.handler.silenceTimeoutMs);
  }

  private clearSilenceTimer() {
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
  }

  private async onSilenceTimeout() {
    if (this.sessionEnding || this.isSpeaking) return;
    this.silenceNudgeCount++;
    if (this.silenceNudgeCount >= 2) {
      console.log(`[voice-session] Silence timeout (${this.silenceNudgeCount} nudges), ending session`);
      await this.handleDone();
    } else {
      console.log(`[voice-session] Silence timeout, nudging user`);
      this.conversationHistory.push({ role: 'user', content: '[User has been silent for 30 seconds]' });
      await this.generateAndSendResponse();
    }
  }

  private onUtteranceEnd() {
    if (this.isSpeaking) return;

    // UtteranceEnd is the absolute backstop (2500ms silence).
    // Clear any pending debounce and force-respond — user is definitely done.
    if (this.speechFinalTimer) {
      clearTimeout(this.speechFinalTimer);
      this.speechFinalTimer = null;
    }

    if (this.currentUtteranceBuffer.trim()) {
      console.log(`[voice-session] Utterance end (backstop): "${this.currentUtteranceBuffer.trim()}"`);
      this.onSpeechFinal();
    }
  }

  handleMute() {
    if (this.muted) return;
    this.muted = true;
    this.muteTranscriptBuffer = [];

    // If AI is currently speaking or thinking, interrupt it
    if (this.isSpeaking || this.state === 'thinking') {
      this.handleInterrupt();
    }

    this.state = 'listening';
    this.sendToClient({ type: 'mute_state', muted: true });
    console.log(`[voice-session] ${this.sessionId} muted`);
  }

  handleUnmute() {
    if (!this.muted) return;
    this.muted = false;

    // Flush any pending utterance buffer
    if (this.currentUtteranceBuffer.trim()) {
      const utterance = this.currentUtteranceBuffer.trim();
      this.transcriptBuffer.push(utterance);
      this.muteTranscriptBuffer.push(utterance);

      const lastMsg = this.conversationHistory[this.conversationHistory.length - 1];
      if (lastMsg?.role === 'user') {
        lastMsg.content += ' ' + utterance;
      } else {
        this.conversationHistory.push({ role: 'user', content: utterance });
      }
      this.currentUtteranceBuffer = '';
      this.currentUtteranceWords = [];
    }

    // Inject context so the AI knows what was said during mute
    if (this.muteTranscriptBuffer.length > 0) {
      const muteSpeech = this.muteTranscriptBuffer.join(' ');
      this.conversationHistory.push({
        role: 'assistant',
        content: `[The user was speaking freely with you muted. Here's what they said: "${muteSpeech}". Continue the conversation naturally, acknowledging what they talked about.]`,
      });
    }

    this.muteTranscriptBuffer = [];
    this.sendToClient({ type: 'mute_state', muted: false });
    this.sendToClient({ type: 'turn_state', state: 'listening' });
    console.log(`[voice-session] ${this.sessionId} unmuted`);
  }

  handleInterrupt() {
    console.log(`[DEBUG] handleInterrupt() called, state=${this.state}, isSpeaking=${this.isSpeaking}`);
    if (this.speechFinalTimer) {
      clearTimeout(this.speechFinalTimer);
      this.speechFinalTimer = null;
    }
    if (this.activeAbortController) {
      this.activeAbortController.abort();
      this.activeAbortController = null;
    }

    // Abort TTS
    if (this.tts) {
      this.tts.abort();
    }

    this.isSpeaking = false;
    this.speakingEndedAt = Date.now();
    this.state = 'listening';
    this.sendToClient({ type: 'turn_state', state: 'listening', turnId: this.currentTurnId });
    console.log(`[voice-session] ${this.sessionId} interrupted`);
  }

  async handleDone() {
    if (this.sessionEnding) return;
    this.sessionEnding = true;

    console.log(`[voice-session] Session ${this.sessionId} ending`);

    // Stop audio and generation
    this.isSpeaking = false;
    if (this.tts) this.tts.abort();
    if (this.activeAbortController) {
      this.activeAbortController.abort();
      this.activeAbortController = null;
    }
    this.state = 'idle';

    // Flush remaining utterance
    if (this.currentUtteranceBuffer.trim()) {
      this.transcriptBuffer.push(this.currentUtteranceBuffer.trim());
      this.currentUtteranceBuffer = '';
      this.currentUtteranceWords = [];
    }

    const durationSeconds = Math.round((Date.now() - this.startTime) / 1000);

    try {
      // Prefer streaming path when handler supports it
      if (this.handler.onSessionEndStreaming) {
        let correctionIndex = 0;
        const onCorrection = (correction: any) => {
          this.sendToClient({
            type: 'correction',
            index: correctionIndex++,
            data: correction,
          });
        };

        try {
          const result = await this.handler.onSessionEndStreaming(
            this.userId,
            this.agentConfig,
            this.transcriptBuffer,
            this.conversationHistory,
            durationSeconds,
            onCorrection,
            this.formContext,
          );

          // Send analysis_complete with remaining data (fillers, insights, etc.)
          this.sendToClient({
            type: 'analysis_complete',
            sessionId: this.sessionId,
            dbSessionId: result.dbSessionId ?? null,
            agentId: this.agentConfig?.id ?? null,
            agentName: this.agentConfig?.name ?? null,
            data: {
              sentences: result.analysisResults?.sentences ?? [],
              fillerWords: result.analysisResults?.fillerWords ?? [],
              fillerPositions: result.analysisResults?.fillerPositions ?? [],
              sessionInsights: result.analysisResults?.sessionInsights ?? [],
              clarityScore: result.clarityScore,
              correctionIds: result.correctionIds ?? [],
            },
          });
        } catch (streamErr) {
          console.warn(`[voice-session] Streaming analysis failed, falling back to non-streaming:`, streamErr);
          // Fall through to non-streaming path below
          await this.handleSessionEndFallback(durationSeconds);
        }
      } else {
        await this.handleSessionEndFallback(durationSeconds);
      }
    } catch (err) {
      console.error(`[voice-session] Session end error:`, err);
      this.sendToClient({
        type: 'session_end',
        sessionId: this.sessionId,
        dbSessionId: null,
        error: 'Processing failed',
      });
    }

    this.cleanup();
  }

  /** Non-streaming session end — original path extracted for fallback use. */
  private async handleSessionEndFallback(durationSeconds: number) {
    const result = await this.handler.onSessionEnd(
      this.userId,
      this.agentConfig,
      this.transcriptBuffer,
      this.conversationHistory,
      durationSeconds,
      this.formContext,
    );

    switch (result.type) {
      case 'analysis':
        this.sendToClient({
          type: 'session_end',
          sessionId: this.sessionId,
          dbSessionId: result.dbSessionId ?? null,
          agentId: this.agentConfig?.id ?? null,
          agentName: this.agentConfig?.name ?? null,
          results: result.analysisResults,
        });
        break;
      case 'onboarding':
        this.sendToClient({
          type: 'onboarding_complete',
          success: result.success,
          displayName: result.displayName,
          speechObservation: result.speechObservation ?? null,
          farewellMessage: result.farewellMessage ?? null,
        });
        break;
      case 'agent-created':
        this.sendToClient({
          type: 'agent_created',
          agent: result.agent,
        });
        break;
    }
  }

  cleanup() {
    if (this.speechFinalTimer) {
      clearTimeout(this.speechFinalTimer);
      this.speechFinalTimer = null;
    }
    this.clearSilenceTimer();
    if (this.sessionMaxTimer) {
      clearTimeout(this.sessionMaxTimer);
      this.sessionMaxTimer = null;
    }
    this.deepgram?.close();
    this.deepgram = null;

    this.tts?.close();
    this.tts = null;

    console.log(`[voice-session] Session ${this.sessionId} cleaned up`);
  }

  private sendToClient(message: Record<string, unknown>) {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }
}
