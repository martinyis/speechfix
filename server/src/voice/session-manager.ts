import { WebSocket } from 'ws';
import { DeepgramClient, TranscriptResult } from './deepgram.js';
import { generateResponse } from './response-generator.js';
import type { ConversationMessage, ResponseMeta } from './response-generator.js';
import { CartesiaTTS } from './tts.js';
import { detectTurnHeuristic, detectTurnLLM } from './turn-detector.js';
import { DEFAULT_VOICE_ID, SYSTEM_MODE_VOICES } from './voice-config.js';
import type { AgentTypeHandler, AgentConfig, FullUserContext } from './handlers/types.js';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { eq, and, isNull, or } from 'drizzle-orm';
import { fetchGreeting, regenerateAllGreetings } from '../services/greeting-generator.js';
import { FillerCoachHandler } from './handlers/filler-coach-handler.js';
import { hasLowConfidenceWords, correctTranscript, type WordWithConfidence } from '../services/transcript-corrector.js';
import { PitchAccumulator } from './pitch-detector.js';
import type { WordTimingData, UtteranceMetadata, SpeechTimeline } from './speech-types.js';
import { createWriteStream, type WriteStream } from 'node:fs';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { encodePcmToOpus } from '../services/audio-encoder.js';
import { audioStorage, buildSessionAudioPath } from '../services/audio-storage.js';
import { sessions as sessionsTable } from '../db/schema.js';

const SPEECH_FINAL_DEBOUNCE_MS = 150;

// PCM capture format — single source of truth. If any of these change the
// entire pipeline (mobile startRecording, Deepgram `sample_rate`, encoder
// `-ar`, PitchAccumulator) must agree.
const SAMPLE_RATE = 48000;
const CHANNELS = 1;
const BYTES_PER_SAMPLE = 2; // 16-bit little-endian
const BYTES_PER_SEC = SAMPLE_RATE * CHANNELS * BYTES_PER_SAMPLE;

// When silence-trimming the persisted audio, keep a small cushion of the
// surrounding mic frames on each side of every utterance so the transition
// into/out of speech doesn't clip harshly. Clipped at `gap/2` for adjacent
// utterances so padded regions never overlap (no duplicated audio).
const TRIM_PAD_SEC = 0.15;

// Short linear fade at each splice boundary to eliminate clicks/pops where
// PCM byte-ranges are concatenated. 8ms fade regardless of sample rate.
const SPLICE_FADE_SAMPLES = Math.round(0.008 * SAMPLE_RATE);

/**
 * Return a COPY of `src` with a linear fade-in on the first `SPLICE_FADE_SAMPLES`
 * samples and a linear fade-out on the last `SPLICE_FADE_SAMPLES` samples.
 * Operates on 16-bit little-endian mono PCM. The buffer is copied so the
 * caller's source (typically a subarray view of the whole PCM file) is not
 * mutated.
 */
function applyEdgeFadesInPlace(src: Buffer): Buffer {
  const out = Buffer.from(src); // copy — don't mutate pcmBuffer views
  const sampleCount = Math.floor(out.length / 2);
  if (sampleCount < 4) return out;
  const n = Math.min(SPLICE_FADE_SAMPLES, Math.floor(sampleCount / 2));
  if (n <= 0) return out;
  // Fade in
  for (let i = 0; i < n; i++) {
    const gain = i / n; // 0 → ~1
    const off = i * 2;
    const s = out.readInt16LE(off);
    out.writeInt16LE(Math.round(s * gain), off);
  }
  // Fade out
  for (let i = 0; i < n; i++) {
    const gain = i / n; // 0 → ~1 (mirrored from tail)
    const off = (sampleCount - 1 - i) * 2;
    const s = out.readInt16LE(off);
    out.writeInt16LE(Math.round(s * gain), off);
  }
  return out;
}

interface UtteranceTrimSegment {
  dgStart: number;
  dgEnd: number;
  leadingPadSec: number;
  trailingPadSec: number;
}

/**
 * Given utterances sorted by startTime, compute a per-utterance trim segment
 * with padding clipped to half the gap to the previous/next utterance (and to
 * the PCM start/end for the first/last utterance). Used by BOTH the PCM
 * byte-range trim AND the trim-time coordinate map so the persisted audio and
 * client-facing timestamps stay in perfect sync.
 */
function computeUtteranceTrimSegments(
  sortedUtts: UtteranceMetadata[],
  pcmDurationSec: number,
  padSec: number,
): UtteranceTrimSegment[] {
  return sortedUtts.map((u, i) => {
    const prevEnd = i > 0 ? sortedUtts[i - 1].endTime : 0;
    const nextStart = i < sortedUtts.length - 1 ? sortedUtts[i + 1].startTime : pcmDurationSec;
    const gapBefore = Math.max(0, u.startTime - prevEnd);
    const gapAfter = Math.max(0, nextStart - u.endTime);
    return {
      dgStart: u.startTime,
      dgEnd: u.endTime,
      leadingPadSec: Math.min(padSec, gapBefore / 2),
      trailingPadSec: Math.min(padSec, gapAfter / 2),
    };
  });
}

export type SessionState = 'idle' | 'listening' | 'thinking' | 'speaking';

export class VoiceSession {
  sessionId: string;
  ws: WebSocket;
  state: SessionState = 'idle';
  transcriptBuffer: string[] = [];
  conversationHistory: ConversationMessage[] = [];
  currentUtteranceBuffer = '';
  private currentUtteranceWords: WordWithConfidence[] = [];
  private currentUtteranceTimedWords: WordTimingData[] = [];
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

  // Speech metadata collection
  private utteranceMetadata: UtteranceMetadata[] = [];
  private audioMetrics: Array<{ ts: number; rms: number; dBFS: number }> = [];
  // Each sample records BOTH the wall-clock timestamp (for matching against
  // audioMetrics, which is also wall-clock) AND the dg-time (= position in
  // the persisted PCM file in seconds; = Deepgram stream time, since we
  // forward exactly the bytes we persist). dgTime is what lets us remap
  // samples into the silence-trimmed output coordinate system.
  private pitchData: Array<{ ts: number; dgTime: number; f0: number | null }> = [];
  private pitchAccumulator = new PitchAccumulator(SAMPLE_RATE);
  private lastSpeechStartedAt = 0;

  // Running count of PCM bytes persisted. At SAMPLE_RATE × 2 bytes/sample mono,
  // `pcmBytesWritten / BYTES_PER_SEC` is the current dg-time in seconds.
  private pcmBytesWritten = 0;

  // Raw PCM capture for post-session audio persistence (Phase 2 Pitch Ribbon playback)
  private pcmWriteStream: WriteStream | null = null;
  private pcmTempPath: string | null = null;

  private deepgram: DeepgramClient | null = null;
  private tts: CartesiaTTS | null = null;
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
  private mode: string | null;

  constructor(ws: WebSocket, userId: number, handler: AgentTypeHandler, agentConfig: AgentConfig | null, mode: string | null, formContext?: Record<string, unknown> | null) {
    this.sessionId = crypto.randomUUID();
    this.ws = ws;
    this.userId = userId;
    this.handler = handler;
    this.agentConfig = agentConfig;
    this.mode = mode;
    this.formContext = formContext ?? null;
  }

  async start() {
    this.startTime = Date.now();
    this.state = 'listening';

    // Open temp PCM file for audio capture (Pitch Ribbon playback).
    // Only kept while session runs; encoded + moved to final storage at session end.
    try {
      const dir = join(tmpdir(), 'reflexa-audio');
      await mkdir(dir, { recursive: true });
      this.pcmTempPath = join(dir, `${this.sessionId}.pcm`);
      this.pcmWriteStream = createWriteStream(this.pcmTempPath);
    } catch (err) {
      console.warn(`[voice-session] Failed to open PCM capture file:`, err);
      this.pcmTempPath = null;
      this.pcmWriteStream = null;
    }

    // --- Parallel setup: fetch user context + greeting, connect Deepgram + Cartesia ---
    const deepgramKey = process.env.DEEPGRAM_API_KEY;
    const cartesiaKey = process.env.CARTESIA_API_KEY;
    const voiceId = this.agentConfig?.voiceId
      || (this.mode && SYSTEM_MODE_VOICES[this.mode])
      || DEFAULT_VOICE_ID;

    const strategy = this.handler.greetingStrategy;
    const greetingMode = this.handler instanceof FillerCoachHandler ? 'filler-coach' : 'conversation';

    const greetingPromise = strategy === 'pregenerated'
      ? fetchGreeting(this.userId, this.agentConfig?.id ?? null, greetingMode).catch(err => {
          console.error('[voice-session] Failed to fetch greeting:', err);
          return null;
        })
      : Promise.resolve(null);

    const userContextPromise = (async () => {
      if (!this.handler.needsUserContext) return undefined;
      try {
        const [userResult] = await db.select({
          displayName: users.displayName,
          context: users.context,
          goals: users.goals,
          contextNotes: users.contextNotes,
        }).from(users).where(eq(users.id, this.userId));
        if (userResult) {
          return {
            displayName: userResult.displayName,
            context: userResult.context,
            goals: userResult.goals as string[] | null,
            contextNotes: userResult.contextNotes as FullUserContext['contextNotes'],
          } as FullUserContext;
        }
      } catch (err) {
        console.error('[voice-session] Failed to fetch user profile:', err);
      }
      return undefined;
    })();

    const deepgramPromise = (async () => {
      if (!deepgramKey) {
        console.warn('[voice-session] No DEEPGRAM_API_KEY, STT disabled');
        return;
      }
      this.deepgram = new DeepgramClient(deepgramKey, {
        onTranscript: (result) => this.onTranscript(result),
        onUtteranceEnd: (lastWordEnd) => this.onUtteranceEnd(lastWordEnd),
        onSpeechStarted: (timestamp) => {
          this.lastSpeechStartedAt = Date.now();
        },
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
      if (!cartesiaKey || !voiceId) {
        console.warn('[voice-session] No CARTESIA_API_KEY/VOICE_ID, TTS disabled');
        return;
      }
      this.tts = new CartesiaTTS(cartesiaKey, voiceId, {
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
        console.log(`[voice-session] Cartesia connected for session ${this.sessionId}`);
      } catch (err) {
        console.error(`[voice-session] Failed to connect Cartesia:`, err);
        this.tts = null;
      }
    })();

    // Wait for all parallel setup to complete
    const [preGeneratedGreeting, userContext] = await Promise.all([
      greetingPromise,
      userContextPromise,
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

    if (strategy === 'pregenerated' && preGeneratedGreeting) {
      console.log(`[DEBUG] Using pre-generated greeting: "${preGeneratedGreeting}"`);
      await this.sendGreetingDirectly(preGeneratedGreeting);
    } else if (strategy === 'none') {
      console.log(`[DEBUG] Handler strategy=none, using Claude for first message`);
      await this.generateAndSendResponse();
    } else {
      // Safety net — should never happen if system works correctly
      console.error('[greeting] MISSING greeting for pregenerated handler — falling back to Claude');
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
    if (this.isSpeaking || (this.speakingEndedAt && Date.now() - this.speakingEndedAt < 500)) {
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

      // Compute RMS volume and pitch on user audio
      const samples = new Int16Array(buffer.buffer, buffer.byteOffset, buffer.length / 2);
      if (samples.length > 0) {
        let sumSq = 0;
        for (let i = 0; i < samples.length; i++) sumSq += samples[i] * samples[i];
        const rms = Math.sqrt(sumSq / samples.length);
        const dBFS = rms > 0 ? 20 * Math.log10(rms / 32768) : -96;
        this.audioMetrics.push({ ts: Date.now() - this.startTime, rms, dBFS });

        const pitchResult = this.pitchAccumulator.addChunk(buffer);
        if (pitchResult) {
          // Record dg-time at the END of this chunk, so the sample
          // corresponds to audio ending at dgTime.
          const dgTime = (this.pcmBytesWritten + buffer.length) / BYTES_PER_SEC;
          this.pitchData.push({
            ts: Date.now() - this.startTime,
            dgTime,
            f0: pitchResult.f0,
          });
        }
      }

      // Persist raw PCM for post-session audio playback (filtered: only user speech,
      // no greeting/echo chunks — those were dropped above).
      if (this.pcmWriteStream && !this.pcmWriteStream.destroyed) {
        this.pcmWriteStream.write(buffer);
        this.pcmBytesWritten += buffer.length;
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
        this.currentUtteranceTimedWords.push({
          word: w.word,
          start: w.start,
          end: w.end,
          confidence: w.confidence,
        });
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
    const timedWords = this.currentUtteranceTimedWords;
    this.currentUtteranceBuffer = '';
    this.currentUtteranceWords = [];
    this.currentUtteranceTimedWords = [];

    if (!utterance) return;

    // Build per-utterance metadata from timed word data
    if (timedWords.length > 0) {
      const startTime = timedWords[0].start;
      const endTime = timedWords[timedWords.length - 1].end;
      const durationSec = endTime - startTime;
      const durationMs = durationSec * 1000;
      const wpm = durationSec > 0 ? Math.round((timedWords.length / durationSec) * 60) : 0;
      const avgConf = timedWords.reduce((s, w) => s + w.confidence, 0) / timedWords.length;
      const lowConf = timedWords.filter(w => w.confidence < 0.80).map(w => w.word);
      const responseLatencyMs = this.speakingEndedAt > 0
        ? Math.max(0, (this.lastSpeechStartedAt || Date.now()) - this.speakingEndedAt)
        : 0;

      this.utteranceMetadata.push({
        text: utterance,
        words: [...timedWords],
        startTime,
        endTime,
        durationMs,
        wpm,
        avgConfidence: Math.round(avgConf * 1000) / 1000,
        lowConfidenceWords: lowConf,
        responseLatencyMs,
      });
      // Diagnostic: expose the relationship between Deepgram stream-time
      // (word timings) and PCM byte-time (what we persist).
      const pcmBytesAtEnd = this.pcmBytesWritten;
      const pcmSecAtEnd = pcmBytesAtEnd / BYTES_PER_SEC;
      const dgLagSec = pcmSecAtEnd - endTime;
      console.log(
        `[voice-session] utt pushed: dg-time=[${startTime.toFixed(2)}, ${endTime.toFixed(2)}]s, ` +
        `pcmBytesWritten=${pcmBytesAtEnd} (${pcmSecAtEnd.toFixed(2)}s at event time), ` +
        `invariant-drift=${dgLagSec.toFixed(2)}s ` +
        `${Math.abs(dgLagSec) > 1 ? '⚠️ DG-TIME ≠ PCM-TIME' : '✓'}`,
      );
    }

    // Fire-and-forget transcript correction — don't block response generation
    if (words.length > 0 && hasLowConfidenceWords(words)) {
      const lowWords = words.filter(w => w.confidence < 0.80);
      console.log(`[transcript-correction] Low-confidence words detected: ${lowWords.map(w => `"${w.word}"(${(w.confidence * 100).toFixed(0)}%)`).join(', ')}`);
      const originalUtterance = utterance;
      correctTranscript(originalUtterance, words, this.conversationHistory)
        .then(corrected => {
          if (corrected !== originalUtterance) {
            console.log(`[transcript-correction] Corrected: "${originalUtterance}" → "${corrected}"`);
            const entry = this.conversationHistory.find(
              m => m.role === 'user' && m.content.includes(originalUtterance)
            );
            if (entry) entry.content = entry.content.replace(originalUtterance, corrected);
          } else {
            console.log(`[transcript-correction] No changes needed`);
          }
        })
        .catch(err => console.error(`[transcript-correction] Failed:`, err));
    }

    console.log(`[voice-session] Speech final, utterance: "${utterance}"`);
    this.transcriptBuffer.push(utterance);

    // Prepend elapsed time for handlers that need it (e.g. filler coach pacing)
    let messageContent = utterance;
    if (this.handler.includeElapsedTime) {
      const elapsedSec = Math.round((Date.now() - this.startTime) / 1000);
      const mins = Math.floor(elapsedSec / 60);
      const secs = elapsedSec % 60;
      messageContent = `[${mins}:${secs.toString().padStart(2, '0')} elapsed] ${utterance}`;
    }

    // Merge consecutive user messages to maintain role alternation (required by Anthropic API)
    const lastMsg = this.conversationHistory[this.conversationHistory.length - 1];
    if (lastMsg?.role === 'user') {
      lastMsg.content += ' ' + messageContent;
    } else {
      this.conversationHistory.push({ role: 'user', content: messageContent });
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
      const maxTokens = this.handler.maxCompletionTokens
        ? (tools.length > 0 ? this.handler.maxCompletionTokens.withTools : this.handler.maxCompletionTokens.withoutTools)
        : undefined;

      const responseGen = generateResponse(
        this.conversationHistory,
        abortController.signal,
        this.systemPrompt,
        tools.length > 0 ? tools : undefined,
        meta,
        maxTokens,
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

      // If an end tool was called, skip TTS flush/wait for immediate session end
      const hasEndTool = meta.toolCalls.includes('end_session') || meta.toolCalls.includes('end_onboarding');

      if (!hasEndTool) {
        // Normal flow: flush TTS and wait for all audio to be delivered
        if (!abortController.signal.aborted && this.tts) {
          console.log(`[DEBUG] Flushing TTS (EOS signal)`);
          this.tts.flush();
          console.log(`[DEBUG] Waiting for TTS completion...`);
          await this.tts.waitForCompletion();
          console.log(`[DEBUG] TTS complete, ${this.turnAudioBytes} audio bytes sent`);
        }
      } else {
        console.log(`[voice-session] End tool detected in stream, skipping TTS wait for immediate session end`);
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

  private onUtteranceEnd(_lastWordEnd: number | null) {
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
      this.currentUtteranceTimedWords = [];
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
      const remaining = this.currentUtteranceBuffer.trim();
      this.transcriptBuffer.push(remaining);

      // Build metadata for the final utterance
      if (this.currentUtteranceTimedWords.length > 0) {
        const tw = this.currentUtteranceTimedWords;
        const startTime = tw[0].start;
        const endTime = tw[tw.length - 1].end;
        const durationSec = endTime - startTime;
        const avgConf = tw.reduce((s, w) => s + w.confidence, 0) / tw.length;
        this.utteranceMetadata.push({
          text: remaining,
          words: [...tw],
          startTime,
          endTime,
          durationMs: durationSec * 1000,
          wpm: durationSec > 0 ? Math.round((tw.length / durationSec) * 60) : 0,
          avgConfidence: Math.round(avgConf * 1000) / 1000,
          lowConfidenceWords: tw.filter(w => w.confidence < 0.80).map(w => w.word),
          responseLatencyMs: 0,
        });
      }

      this.currentUtteranceBuffer = '';
      this.currentUtteranceWords = [];
      this.currentUtteranceTimedWords = [];
    }

    const durationSeconds = Math.round((Date.now() - this.startTime) / 1000);
    const speechTimeline = this.computeSpeechTimeline(durationSeconds);

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

        const onInsightsReady = (payload: any, dbSessionId: number) => {
          this.sendToClient({
            type: 'insights_ready',
            dbSessionId,
            data: {
              // Legacy alias (kept for one release)
              score: payload.score,
              deliveryScore: payload.deliveryScore ?? null,
              languageScore: payload.languageScore ?? null,
              insights: payload.insights,
              fillerWords: payload.fillerWords,
              fillerPositions: payload.fillerPositions,
              metrics: payload.metrics,
              speechTimeline,
            },
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
            onInsightsReady,
            speechTimeline,
          );

          // Send analysis_complete with remaining data (corrections, final insights)
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
              // Legacy alias (kept for one release)
              score: result.score,
              deliveryScore: result.deliveryScore ?? null,
              languageScore: result.languageScore ?? null,
              correctionIds: result.correctionIds ?? [],
            },
          });

          // Fire-and-forget: encode PCM → Ogg Opus, store, update sessions.audio_path
          if (result.dbSessionId && this.pcmTempPath) {
            this.persistSessionAudio(result.dbSessionId).catch(err =>
              console.error('[voice-session] Audio persistence failed:', err)
            );
          }
        } catch (streamErr) {
          console.warn(`[voice-session] Streaming analysis failed, falling back to non-streaming:`, streamErr);
          await this.handleSessionEndFallback(durationSeconds, speechTimeline);
        }
      } else {
        await this.handleSessionEndFallback(durationSeconds, speechTimeline);
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
  private async handleSessionEndFallback(durationSeconds: number, speechTimeline?: SpeechTimeline) {
    const result = await this.handler.onSessionEnd(
      this.userId,
      this.agentConfig,
      this.transcriptBuffer,
      this.conversationHistory,
      durationSeconds,
      this.formContext,
      speechTimeline,
    );

    switch (result.type) {
      case 'analysis':
      case 'filler-practice':
        this.sendToClient({
          type: 'session_end',
          sessionId: this.sessionId,
          dbSessionId: result.dbSessionId ?? null,
          agentId: this.agentConfig?.id ?? null,
          agentName: this.agentConfig?.name ?? null,
          results: result.analysisResults,
        });
        if (result.dbSessionId && this.pcmTempPath) {
          this.persistSessionAudio(result.dbSessionId).catch(err =>
            console.error('[voice-session] Audio persistence failed:', err)
          );
        }
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

    // Close PCM capture stream. Encoding is already kicked off before cleanup
    // runs (from the session-end flow). If the session ended abnormally before
    // a dbSessionId was assigned, the temp file is orphaned — harmless, it's in tmpdir.
    if (this.pcmWriteStream && !this.pcmWriteStream.destroyed) {
      this.pcmWriteStream.end();
    }

    // Always regenerate greetings for pregenerated handlers so the next session
    // has a fresh greeting ready — regardless of whether this session's greeting played.
    if (this.handler.greetingStrategy === 'pregenerated') {
      regenerateAllGreetings(this.userId)
        .then(() => console.log(`[greeting] Post-session regen complete for user ${this.userId}`))
        .catch(err => console.error('[greeting] Cleanup regen failed:', err));
    }

    console.log(`[voice-session] Session ${this.sessionId} cleaned up`);
  }

  /**
   * Post-session audio pipeline (Phase 2 Pitch Ribbon playback).
   * Runs fire-and-forget after the handler assigns a dbSessionId:
   *   1. Wait for PCM write stream to finish flushing
   *   2. Encode PCM → Ogg Opus via ffmpeg (~32kbps, voip profile)
   *   3. Move OGG into audio storage under {userId}/{sessionId}.ogg
   *   4. Update sessions.audio_path
   *   5. Delete temp PCM
   */
  private async persistSessionAudio(dbSessionId: number): Promise<void> {
    const pcmPath = this.pcmTempPath;
    if (!pcmPath) return;

    // Ensure the write stream is closed before ffmpeg reads the file.
    await new Promise<void>((resolvePromise) => {
      if (!this.pcmWriteStream || this.pcmWriteStream.destroyed) {
        resolvePromise();
      } else {
        this.pcmWriteStream.end(() => resolvePromise());
      }
    });

    const relativePath = buildSessionAudioPath(this.userId, dbSessionId);
    const tempOggPath = pcmPath.replace(/\.pcm$/, '.ogg');
    const trimmedPcmPath = pcmPath.replace(/\.pcm$/, '.trimmed.pcm');

    // Silence-trim: build a PCM containing ONLY the byte ranges covered by
    // user utterances. The capture filter in `handleAudio` already dropped
    // AI-speech frames, so the raw PCM = user-mic-active bytes; this second
    // trim also removes the user's between-utterance silences (thinking
    // pauses) so the audio file is pure user-speech. Deepgram stream time
    // equals PCM byte offset (we forward exactly the bytes we persist), so
    // utterance.startTime/endTime map directly to byte offsets at
    // BYTES_PER_SEC (16-bit @ SAMPLE_RATE mono).
    //
    // All client-facing timestamps are remapped below to the trim-time
    // coordinate system so the ribbon axis matches playback byte-for-byte.
    let inputForEncoding = pcmPath;
    try {
      const sortedUtts = [...this.utteranceMetadata].sort((a, b) => a.startTime - b.startTime);
      if (sortedUtts.length > 0) {
        const pcmBuffer = await readFile(pcmPath);
        const pcmBytesFinal = this.pcmBytesWritten;
        const pcmDurationSec = pcmBuffer.length / BYTES_PER_SEC;
        const maxDgTime = sortedUtts[sortedUtts.length - 1].endTime;
        console.log(
          `[voice-session] PCM trim diagnostics: pcmBuffer.length=${pcmBuffer.length} ` +
          `(${pcmDurationSec.toFixed(2)}s), pcmBytesWritten=${pcmBytesFinal} ` +
          `(${(pcmBytesFinal / BYTES_PER_SEC).toFixed(2)}s), utterances=${sortedUtts.length}, ` +
          `maxUtteranceEndTime=${maxDgTime.toFixed(2)}s`,
        );

        // Invariant check: if Deepgram's max utterance end time is wildly
        // outside the PCM duration, the time→byte conversion will produce
        // garbage byte ranges. Fall back to encoding the full PCM so the
        // user at least hears everything they said (silences included).
        const invariantDriftSec = Math.abs(pcmDurationSec - maxDgTime);
        if (invariantDriftSec > 2.0 && maxDgTime > pcmDurationSec + 2.0) {
          console.warn(
            `[voice-session] ⚠️ INVARIANT BROKEN: max dg-time (${maxDgTime.toFixed(2)}s) ` +
            `exceeds PCM duration (${pcmDurationSec.toFixed(2)}s) by ${invariantDriftSec.toFixed(2)}s. ` +
            `Falling back to full PCM — trim would produce corrupted audio.`,
          );
          // Skip trim; inputForEncoding stays = pcmPath.
        } else {
          const trimSegs = computeUtteranceTrimSegments(sortedUtts, pcmDurationSec, TRIM_PAD_SEC);
          const chunks: Buffer[] = [];
          let totalTrimBytes = 0;
          let outOfBoundsCount = 0;
          sortedUtts.forEach((u, i) => {
            const seg = trimSegs[i];
            const rawStart = (u.startTime - seg.leadingPadSec) * BYTES_PER_SEC;
            const rawEnd = (u.endTime + seg.trailingPadSec) * BYTES_PER_SEC;
            let startByte = Math.max(0, Math.floor(rawStart));
            let endByte = Math.min(pcmBuffer.length, Math.ceil(rawEnd));
            // Ensure 16-bit frame alignment (even-byte boundaries).
            if (startByte % 2 !== 0) startByte -= 1;
            if (endByte % 2 !== 0) endByte -= 1;
            const outOfBounds = rawEnd > pcmBuffer.length || rawStart > pcmBuffer.length;
            if (outOfBounds) outOfBoundsCount++;
            console.log(
              `[voice-session] utt[${i}] dg-time=[${u.startTime.toFixed(2)}s, ${u.endTime.toFixed(2)}s] ` +
              `pad=[+${seg.leadingPadSec.toFixed(3)}s, +${seg.trailingPadSec.toFixed(3)}s] ` +
              `→ bytes=[${startByte}, ${endByte}] (${(endByte - startByte)} bytes = ` +
              `${((endByte - startByte) / BYTES_PER_SEC).toFixed(2)}s)` +
              `${outOfBounds ? ' ⚠️ OUT OF BOUNDS' : ''} text="${u.text.slice(0, 40)}..."`,
            );
            if (endByte > startByte) {
              // Apply short linear fades to both edges so concatenation
              // boundaries don't produce audible clicks. Also copies the
              // buffer so we never mutate the source pcmBuffer view.
              chunks.push(applyEdgeFadesInPlace(pcmBuffer.subarray(startByte, endByte)));
              totalTrimBytes += endByte - startByte;
            }
          });
          if (chunks.length > 0) {
            const trimmed = Buffer.concat(chunks);
            await writeFile(trimmedPcmPath, trimmed);
            inputForEncoding = trimmedPcmPath;
            console.log(
              `[voice-session] Silence-trimmed PCM: ${pcmBuffer.length} → ${trimmed.length} bytes ` +
              `(${pcmDurationSec.toFixed(2)}s → ${(totalTrimBytes / BYTES_PER_SEC).toFixed(2)}s, ` +
              `${sortedUtts.length} utterances, ${outOfBoundsCount} OOB)`,
            );
          }
        }
      }
    } catch (trimErr) {
      // Fall back to encoding the full PCM — user still gets playable audio,
      // visual axis will just be longer than the audio.
      console.warn(`[voice-session] PCM trim failed, encoding full PCM:`, trimErr);
      inputForEncoding = pcmPath;
    }

    try {
      await encodePcmToOpus({
        inputPcmPath: inputForEncoding,
        outputOggPath: tempOggPath,
        sampleRate: SAMPLE_RATE,
        // bitrate omitted — uses encoder default (64k, -application audio).
        // 16kHz capture caps audio bandwidth at 8kHz anyway, so 64k is
        // effectively transparent for voice; going higher is pure waste.
      });
      await audioStorage.save(tempOggPath, relativePath);

      // Only write if no hi-fi upload has won the race yet. 'hifi' > 'pcm'.
      // Uses WHERE (audio_source IS NULL OR audio_source = 'pcm') so a client-
      // uploaded M4A already encoded into audio_path is NOT overwritten.
      const updateResult = await db.update(sessionsTable)
        .set({ audioPath: relativePath, audioSource: 'pcm' })
        .where(and(
          eq(sessionsTable.id, dbSessionId),
          or(isNull(sessionsTable.audioSource), eq(sessionsTable.audioSource, 'pcm')),
        ));

      console.log(`[voice-session] Audio persisted (PCM) for session ${dbSessionId} at ${relativePath} (updated=${(updateResult as { rowCount?: number }).rowCount ?? '?'})`);
    } catch (err) {
      console.error(`[voice-session] Audio encode/persist failed for session ${dbSessionId}:`, err);
      await unlink(tempOggPath).catch(() => {});
    } finally {
      await unlink(pcmPath).catch(() => {});
      await unlink(trimmedPcmPath).catch(() => {});
      this.pcmTempPath = null;
      this.pcmWriteStream = null;
    }
  }

  private computeSpeechTimeline(durationSeconds: number): SpeechTimeline | undefined {
    const utterances = this.utteranceMetadata;
    if (utterances.length === 0) return undefined;

    // Aggregate WPM
    const totalWords = utterances.reduce((s, u) => s + u.words.length, 0);
    const totalSpeechSec = utterances.reduce((s, u) => s + u.durationMs / 1000, 0);
    const overallWpm = totalSpeechSec > 0 ? Math.round((totalWords / totalSpeechSec) * 60) : 0;

    // Pace variability (coefficient of variation)
    const wpmValues = utterances.map(u => u.wpm).filter(w => w > 0);
    const meanWpm = wpmValues.length > 0 ? wpmValues.reduce((s, v) => s + v, 0) / wpmValues.length : 0;
    const wpmStdDev = wpmValues.length > 1
      ? Math.sqrt(wpmValues.reduce((s, v) => s + (v - meanWpm) ** 2, 0) / wpmValues.length)
      : 0;
    const paceVariability = meanWpm > 0 ? Math.round((wpmStdDev / meanWpm) * 100) / 100 : 0;

    // Response latency
    const latencies = utterances.map(u => u.responseLatencyMs).filter(l => l > 0);
    const avgResponseLatencyMs = latencies.length > 0
      ? Math.round(latencies.reduce((s, v) => s + v, 0) / latencies.length)
      : 0;

    // Confidence
    const avgConfidence = Math.round(
      (utterances.reduce((s, u) => s + u.avgConfidence, 0) / utterances.length) * 1000
    ) / 1000;

    // Pauses (gaps between consecutive utterances)
    const pauses: number[] = [];
    for (let i = 1; i < utterances.length; i++) {
      const gap = (utterances[i].startTime - utterances[i - 1].endTime) * 1000;
      if (gap > 200) pauses.push(gap); // Only count gaps > 200ms as pauses
    }
    const totalPauses = pauses.length;
    const avgPauseDurationMs = pauses.length > 0
      ? Math.round(pauses.reduce((s, v) => s + v, 0) / pauses.length)
      : 0;
    const longestPauseMs = pauses.length > 0 ? Math.round(Math.max(...pauses)) : 0;

    // Speech-to-silence ratio (wall-clock denominator: fraction of the full
    // session during which the user was speaking).
    const totalSpeechMs = totalSpeechSec * 1000;
    const totalSessionMs = durationSeconds * 1000;
    const speechToSilenceRatio = totalSessionMs > 0
      ? Math.round((totalSpeechMs / totalSessionMs) * 100) / 100
      : 0;

    // Volume metrics (from audioMetrics during speech)
    let volumeConsistency = 1;
    let volumeTrend: SpeechTimeline['volumeTrend'] = 'steady';
    const rmsValues = this.audioMetrics.map(m => m.rms).filter(v => v > 0);
    if (rmsValues.length > 2) {
      const meanRms = rmsValues.reduce((s, v) => s + v, 0) / rmsValues.length;
      const stdRms = Math.sqrt(rmsValues.reduce((s, v) => s + (v - meanRms) ** 2, 0) / rmsValues.length);
      volumeConsistency = meanRms > 0 ? Math.round(Math.max(0, 1 - stdRms / meanRms) * 100) / 100 : 0;

      // Trend: compare first-half mean vs second-half mean
      const mid = Math.floor(rmsValues.length / 2);
      const firstHalf = rmsValues.slice(0, mid);
      const secondHalf = rmsValues.slice(mid);
      const firstMean = firstHalf.reduce((s, v) => s + v, 0) / firstHalf.length;
      const secondMean = secondHalf.reduce((s, v) => s + v, 0) / secondHalf.length;
      const ratio = firstMean > 0 ? secondMean / firstMean : 1;
      if (ratio < 0.75) volumeTrend = 'declining';
      else if (ratio > 1.3) volumeTrend = 'rising';
      else if (volumeConsistency < 0.5) volumeTrend = 'erratic';
      else volumeTrend = 'steady';
    }

    // Pitch metrics
    const f0Values = this.pitchData.map(p => p.f0).filter((v): v is number => v !== null);
    let pitchVariation = 0;
    let pitchAssessment: SpeechTimeline['pitchAssessment'] = 'limited';
    let avgPitchHz = 0;
    if (f0Values.length > 2) {
      avgPitchHz = Math.round(f0Values.reduce((s, v) => s + v, 0) / f0Values.length);
      const pitchStdDev = Math.sqrt(
        f0Values.reduce((s, v) => s + (v - avgPitchHz) ** 2, 0) / f0Values.length
      );
      pitchVariation = Math.round(pitchStdDev * 10) / 10;

      // Classify based on coefficient of variation of pitch
      const cv = avgPitchHz > 0 ? pitchStdDev / avgPitchHz : 0;
      if (cv < 0.05) pitchAssessment = 'monotone';
      else if (cv < 0.12) pitchAssessment = 'limited';
      else if (cv < 0.25) pitchAssessment = 'varied';
      else pitchAssessment = 'expressive';
    }

    // -----------------------------------------------------------------
    // Build a TRIM-TIME map from utterances.
    //
    // Every client-facing timestamp (utterance bounds, word timings, prosody
    // samples, filler positions) is remapped into "trim-time seconds" — the
    // position in the silence-trimmed audio file that `persistSessionAudio`
    // produces. Trim-time = cumulative sum of utterance durations.
    //
    // Utterances are already in Deepgram stream time, which equals the
    // PCM-byte offset (dg-time) because we forward the same bytes we
    // persist. Samples carry `dgTime` explicitly.
    // -----------------------------------------------------------------
    const sortedUtts = [...utterances].sort((a, b) => a.startTime - b.startTime);
    const pcmDurationSec = this.pcmBytesWritten / BYTES_PER_SEC;
    const paddedSegs = computeUtteranceTrimSegments(sortedUtts, pcmDurationSec, TRIM_PAD_SEC);
    const trimSegs: Array<{ dgStart: number; dgEnd: number; trimStart: number; trimEnd: number }> = [];
    let trimCursor = 0;
    for (let i = 0; i < sortedUtts.length; i++) {
      const u = sortedUtts[i];
      const pad = paddedSegs[i];
      const dur = Math.max(0, u.endTime - u.startTime);
      if (dur <= 0) continue;
      // Advance the cursor across the leading silence first — the utterance's
      // speech sits AFTER that in the trimmed file. Then advance past speech
      // plus the trailing silence cushion.
      trimCursor += pad.leadingPadSec;
      trimSegs.push({
        dgStart: u.startTime,
        dgEnd: u.endTime,
        trimStart: trimCursor,
        trimEnd: trimCursor + dur,
      });
      trimCursor += dur + pad.trailingPadSec;
    }

    const dgToTrim = (dg: number): number | null => {
      for (const seg of trimSegs) {
        if (dg >= seg.dgStart && dg <= seg.dgEnd) {
          return seg.trimStart + (dg - seg.dgStart);
        }
      }
      return null;
    };

    // Remap utterances → trim-time (startTime/endTime AND word timings).
    // The metadata (wpm, durationMs, confidence, responseLatencyMs) is
    // duration-based and independent of absolute time, so it stays intact.
    // Pauses metric was already computed above from the original Deepgram times.
    const remappedUtterances: UtteranceMetadata[] = trimSegs.map((seg, i) => {
      const u = sortedUtts[i];
      return {
        ...u,
        startTime: Math.round(seg.trimStart * 1000) / 1000,
        endTime: Math.round(seg.trimEnd * 1000) / 1000,
        words: u.words.map(w => ({
          ...w,
          start: Math.round((seg.trimStart + (w.start - seg.dgStart)) * 1000) / 1000,
          end: Math.round((seg.trimStart + (w.end - seg.dgStart)) * 1000) / 1000,
        })),
      };
    });

    // Build prosody samples, REMAPPED to trim-time. Samples falling outside
    // any utterance (silence between utterances or leading/trailing ambient)
    // are dropped — those moments don't exist in the trimmed audio.
    const prosodySamples: import('./speech-types.js').ProsodySample[] = [];
    let dropped = 0;
    for (const pitchEntry of this.pitchData) {
      const trimT = dgToTrim(pitchEntry.dgTime);
      if (trimT === null) {
        dropped++;
        continue;
      }

      // Volume correlation still uses wall-clock (audioMetrics is wall-clock).
      let closestVolume = 0;
      let bestDelta = Infinity;
      for (const m of this.audioMetrics) {
        const delta = Math.abs(m.ts - pitchEntry.ts);
        if (delta < bestDelta && delta <= 150) {
          bestDelta = delta;
          closestVolume = Math.max(0, Math.min(1, (m.dBFS + 60) / 60));
        }
      }

      prosodySamples.push({
        t: Math.round(trimT * 1000) / 1000,
        pitchHz: pitchEntry.f0,
        volume: Math.round(closestVolume * 1000) / 1000,
      });
    }

    const timeline: SpeechTimeline = {
      utterances: remappedUtterances,
      overallWpm,
      paceVariability,
      avgResponseLatencyMs,
      avgConfidence,
      totalPauses,
      avgPauseDurationMs,
      longestPauseMs,
      speechToSilenceRatio,
      volumeConsistency,
      volumeTrend,
      pitchVariation,
      pitchAssessment,
      avgPitchHz,
      prosodySamples,
    };

    console.log(`[voice-session] Speech timeline computed (trim-time axis): ${remappedUtterances.length} utterances, total ${trimCursor.toFixed(2)}s, ${overallWpm} wpm, ${totalPauses} pauses, pitch=${pitchAssessment}, prosodySamples=${prosodySamples.length} (dropped ${dropped} outside utterances)`);
    return timeline;
  }

  private sendToClient(message: Record<string, unknown>) {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }
}
