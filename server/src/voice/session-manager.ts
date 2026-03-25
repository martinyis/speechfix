import { WebSocket } from 'ws';
import { DeepgramClient, TranscriptResult } from './deepgram.js';
import { generateResponse } from './response-generator.js';
import type { ConversationMessage, ResponseMeta } from './response-generator.js';
import { ElevenLabsTTS } from './tts.js';
import type { AgentTypeHandler, AgentConfig, FullUserContext } from './handlers/types.js';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { eq } from 'drizzle-orm';

export type SessionState = 'idle' | 'listening' | 'thinking' | 'speaking';

export class VoiceSession {
  sessionId: string;
  ws: WebSocket;
  state: SessionState = 'idle';
  transcriptBuffer: string[] = [];
  conversationHistory: ConversationMessage[] = [];
  currentUtteranceBuffer = '';
  activeAbortController: AbortController | null = null;
  startTime: number = 0;
  private audioChunkCount = 0;
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

    // Fetch user context if handler needs it
    let userContext: FullUserContext | undefined;
    if (this.handler.needsUserContext) {
      try {
        const [user] = await db.select({
          displayName: users.displayName,
          context: users.context,
          goals: users.goals,
          contextNotes: users.contextNotes,
        }).from(users).where(eq(users.id, this.userId));
        if (user) {
          userContext = {
            displayName: user.displayName,
            context: user.context,
            goals: user.goals as string[] | null,
            contextNotes: user.contextNotes as FullUserContext['contextNotes'],
          };
        }
      } catch (err) {
        console.error('[voice-session] Failed to fetch user profile:', err);
      }
    }

    // Build system prompt via handler
    this.systemPrompt = this.handler.buildSystemPrompt(this.agentConfig, userContext, this.formContext);

    // Connect to Deepgram for streaming STT
    const deepgramKey = process.env.DEEPGRAM_API_KEY;
    if (deepgramKey) {
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
    } else {
      console.warn('[voice-session] No DEEPGRAM_API_KEY, STT disabled');
    }

    // Connect to ElevenLabs for TTS - use agentConfig voiceId if available
    const elevenLabsKey = process.env.ELEVENLABS_API_KEY;
    const voiceId = this.agentConfig?.voiceId || process.env.ELEVENLABS_VOICE_ID;
    if (elevenLabsKey && voiceId) {
      this.tts = new ElevenLabsTTS(elevenLabsKey, voiceId, {
        onAudio: (base64Chunk) => {
          // Forward TTS audio to client with turnId for proper stream identification
          if (this.isSpeaking) {
            this.turnAudioBytes += Math.ceil(base64Chunk.length * 3 / 4); // base64 → raw bytes
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
    } else {
      console.warn('[voice-session] No ELEVENLABS_API_KEY/VOICE_ID, TTS disabled');
    }

    this.sendToClient({ type: 'ready', sessionId: this.sessionId });
    console.log(`[DEBUG] Sent 'ready' to client`);

    // Generate AI greeting — don't process mic audio until greeting finishes
    console.log(`[DEBUG] Starting greeting generation`);

    const sentinel = '[Session started]';
    this.conversationHistory.push({ role: 'user', content: sentinel });
    await this.generateAndSendResponse();

    this.greetingDone = true;
    console.log(`[DEBUG] Greeting done, greetingDone=${this.greetingDone}, state=${this.state}, isSpeaking=${this.isSpeaking}`);
  }

  handleAudio(base64Data: string) {
    if (this.state === 'idle') return;

    this.audioChunkCount++;

    // Don't forward audio to Deepgram until the greeting has finished playing,
    // otherwise the user's mic picks up sound that interrupts the greeting.
    if (!this.greetingDone) {
      if (this.audioChunkCount % 50 === 1) {
        console.log(`[DEBUG] Dropping audio chunk #${this.audioChunkCount} (greeting not done)`);
      }
      return;
    }

    // Don't forward audio while AI is speaking — prevents echo from being transcribed.
    // Also skip for 800ms after AI finishes to catch trailing echo.
    if (this.isSpeaking || (this.speakingEndedAt && Date.now() - this.speakingEndedAt < 800)) {
      return;
    }

    // Forward audio to Deepgram for transcription
    if (this.deepgram) {
      const buffer = Buffer.from(base64Data, 'base64');
      this.deepgram.sendAudio(buffer);
    }

    if (this.audioChunkCount % 100 === 1) {
      console.log(`[voice-session] ${this.sessionId} audio chunks: ${this.audioChunkCount}`);
    }
  }

  private onTranscript(result: TranscriptResult) {
    // Audio is not forwarded to Deepgram while AI is speaking (echo prevention),
    // so we shouldn't get transcripts during speech. But guard just in case.
    if (this.isSpeaking) return;

    if (result.isFinal) {
      this.currentUtteranceBuffer += (this.currentUtteranceBuffer ? ' ' : '') + result.text;
      console.log(`[voice-session] Final transcript: "${result.text}"`);
    }

    this.sendToClient({
      type: 'transcript',
      text: result.text,
      final: result.isFinal,
    });

    if (result.speechFinal) {
      this.onSpeechFinal();
    }
  }

  private async onSpeechFinal() {
    if (this.sessionEnding) return;
    const utterance = this.currentUtteranceBuffer.trim();
    if (!utterance) return;

    console.log(`[voice-session] Speech final, utterance: "${utterance}"`);
    this.transcriptBuffer.push(utterance);
    this.currentUtteranceBuffer = '';

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
    if (meta.toolCalls.includes('end_session')) {
      console.log(`[voice-session] end_session tool called, ending session`);
      this.sendToClient({ type: 'session_ending' });
      await this.handleDone();
    }
  }

  private onUtteranceEnd() {
    if (this.isSpeaking) return;

    // Backup path: if speechFinal didn't fire, onSpeechFinal handles everything
    // (pushing to buffers, clearing currentUtteranceBuffer, running turn detection).
    if (this.currentUtteranceBuffer.trim()) {
      console.log(`[voice-session] Utterance end (backup): "${this.currentUtteranceBuffer.trim()}"`);
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
    }

    const durationSeconds = Math.round((Date.now() - this.startTime) / 1000);

    try {
      const result = await this.handler.onSessionEnd(
        this.userId,
        this.agentConfig,
        this.transcriptBuffer,
        this.conversationHistory,
        durationSeconds,
        this.formContext,
      );

      // Send result to client based on type
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
          });
          break;
        case 'agent-created':
          this.sendToClient({
            type: 'agent_created',
            agent: result.agent,
          });
          break;
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

  cleanup() {
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
