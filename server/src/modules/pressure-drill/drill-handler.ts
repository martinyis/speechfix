import type { WebSocket } from 'ws';
import { DeepgramClient, type TranscriptResult } from '../voice/deepgram.js';
import { RealtimeFillerDetector } from './realtime-filler-detector.js';
import { generatePromptBatch, PromptEngineError } from './prompt-engine.js';
import { FillerAnalyzer } from '../../analysis/analyzers/fillers.js';
import type {
  ScenarioSlug,
  DurationPreset,
  ShownPrompt,
  WithinSessionTrend,
  PressureDrillFillerData,
} from './types.js';
import { db } from '../../db/index.js';
import { pressureDrillSessions, users } from '../../db/schema.js';
import { eq } from 'drizzle-orm';

const fillerAnalyzer = new FillerAnalyzer();

// Spec-locked timings.
const AUTO_PROMPT_TICK_MS = 45_000;
const PAUSE_THRESHOLD_MS = 3_000;
const PAUSE_COOLDOWN_MS = 20_000;
const SERVER_TICK_MS = 1_000;
const TRANSCRIPT_WINDOW_SECONDS = 30;

interface DrillSessionConfig {
  userId: number;
  socket: WebSocket;
  scenarioSlug: ScenarioSlug;
  durationPreset: DurationPreset;
}

interface SpeechFinalEvent {
  text: string;
  endSecondsFromSessionStart: number;
}

export class PressureDrillSession {
  private readonly sessionId: string;
  private readonly userId: number;
  private readonly socket: WebSocket;
  private readonly scenarioSlug: ScenarioSlug;
  private readonly durationPreset: DurationPreset;

  private startedAtMs = 0;
  private deepgram: DeepgramClient | null = null;
  private fillerDetector!: RealtimeFillerDetector;

  // Cache of prompts the client holds. Server tracks this so `auto_prompt` at
  // tick/pause can re-use cached prompts instead of regenerating.
  private pendingPromptCache: string[] = [];
  private previouslyShownPrompts: string[] = [];
  private recordedPromptsShown: ShownPrompt[] = [];

  // For auto-prompt scheduling.
  private tickTimer: NodeJS.Timeout | null = null;
  private nextAutoPromptAtMs = 0;
  private lastPromptSurfacedAtMs = 0;

  // Transcript state.
  private transcriptWindow: SpeechFinalEvent[] = [];
  private allSentences: string[] = [];
  private finalTranscriptText = '';
  private lastSpeechEndMs = 0;

  // For clean-streak + trend computation.
  private fillerTimestampsSeconds: number[] = [];

  // Session hard-cap. Uses durationPreset — if mobile misbehaves and doesn't
  // send `stop`, server stops on its own at this time.
  private hardCapTimer: NodeJS.Timeout | null = null;

  private ended = false;

  // [pd-debug] forensic counters — remove after diagnosis
  private audioChunksReceived = 0;
  private transcriptsReceived = 0;
  private finalTranscriptsReceived = 0;
  private lastTickLogAtMs = 0;

  constructor(cfg: DrillSessionConfig) {
    this.sessionId = `pd_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
    this.userId = cfg.userId;
    this.socket = cfg.socket;
    this.scenarioSlug = cfg.scenarioSlug;
    this.durationPreset = cfg.durationPreset;
  }

  get id(): string {
    return this.sessionId;
  }

  async start(): Promise<void> {
    this.startedAtMs = Date.now();
    this.lastSpeechEndMs = this.startedAtMs;

    this.fillerDetector = new RealtimeFillerDetector({
      // 1500ms throttle — 3s felt broken when user said "um um" back-to-back
      // (second got throttled). 1.5s lets rapid fillers buzz separately while
      // still preventing 10-hz haptic spam.
      hapticThrottleMs: 1500,
      getElapsedSeconds: () => this.elapsedSeconds(),
      onDetection: (d) => {
        if (!d.throttled) this.fillerTimestampsSeconds.push(d.atSeconds);
        console.log(
          `[pd-debug:${this.sessionId}] FILLER DETECTED word="${d.word}" throttled=${d.throttled} atSec=${d.atSeconds.toFixed(2)} conf=${d.confidence}`,
        );
        this.safeSend({
          type: 'filler_detected',
          word: d.word,
          confidence: d.confidence,
          atSeconds: d.atSeconds,
          throttled: d.throttled,
        });
      },
    });

    const apiKey = process.env.DEEPGRAM_API_KEY;
    if (!apiKey) {
      this.safeSend({ type: 'error', message: 'Server misconfigured: no Deepgram API key' });
      this.socket.close();
      return;
    }

    this.deepgram = new DeepgramClient(apiKey, {
      onTranscript: (r) => this.onTranscript(r),
      onUtteranceEnd: () => {},
      onSpeechStarted: () => {},
      onError: (err) => {
        console.error(`[pressure-drill:${this.sessionId}] Deepgram error:`, err);
        this.safeSend({ type: 'error', message: 'Transcription error' });
      },
      onClose: () => {},
    });

    try {
      await this.deepgram.connect();
      console.log(`[pd-debug:${this.sessionId}] Deepgram CONNECTED scenario=${this.scenarioSlug} duration=${this.durationPreset}s`);
    } catch (err) {
      console.error(`[pressure-drill:${this.sessionId}] Deepgram connect failed:`, err);
      this.safeSend({ type: 'error', message: 'Could not connect to transcription service' });
      this.socket.close();
      return;
    }

    this.safeSend({ type: 'ready' });
    console.log(`[pd-debug:${this.sessionId}] Sent 'ready' to client`);
    this.scheduleNextAutoPrompt('start');

    // 1-second server tick loop.
    this.tickTimer = setInterval(() => this.onServerTick(), SERVER_TICK_MS);

    // Hard cap — end the session if mobile never sends stop.
    this.hardCapTimer = setTimeout(() => {
      if (!this.ended) {
        console.log(`[pressure-drill:${this.sessionId}] Hard cap reached`);
        void this.finish();
      }
    }, (this.durationPreset + 5) * 1000);
  }

  handleMessage(raw: string): void {
    let msg: any;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }

    switch (msg.type) {
      case 'audio':
        // Base64 PCM frame → Deepgram.
        if (typeof msg.data === 'string' && this.deepgram) {
          const buf = Buffer.from(msg.data, 'base64');
          this.deepgram.sendAudio(buf);
          this.audioChunksReceived += 1;
          if (this.audioChunksReceived === 1 || this.audioChunksReceived % 50 === 0) {
            console.log(
              `[pd-debug:${this.sessionId}] audio chunks received=${this.audioChunksReceived} lastChunkBytes=${buf.length}`,
            );
          }
        } else if (!this.deepgram) {
          console.warn(`[pd-debug:${this.sessionId}] audio received but Deepgram client is null`);
        }
        break;

      case 'request_prompt_batch':
        void this.handlePromptBatchRequest(
          typeof msg.elapsedSeconds === 'number' ? msg.elapsedSeconds : this.elapsedSeconds(),
          typeof msg.lastTranscriptWindow === 'string' ? msg.lastTranscriptWindow : this.buildTranscriptWindow(),
          Array.isArray(msg.previouslyShownPrompts) ? msg.previouslyShownPrompts : this.previouslyShownPrompts,
        );
        break;

      case 'prompt_shown':
        if (typeof msg.prompt === 'string') {
          this.recordedPromptsShown.push({
            prompt: msg.prompt,
            shownAtSeconds: typeof msg.shownAtSeconds === 'number' ? msg.shownAtSeconds : this.elapsedSeconds(),
            wasSwap: !!msg.wasSwap,
          });
          if (!this.previouslyShownPrompts.includes(msg.prompt)) {
            this.previouslyShownPrompts.push(msg.prompt);
          }
        }
        break;

      case 'stop':
        void this.finish();
        break;

      case 'mute':
      case 'unmute':
        // No AI-speaking to mute/unmute — accepted but ignored.
        break;

      default:
        // Unknown types log+drop per handler contract.
        console.warn(`[pressure-drill:${this.sessionId}] Unknown message type: ${String(msg?.type)}`);
        break;
    }
  }

  cleanup(): void {
    if (this.tickTimer) { clearInterval(this.tickTimer); this.tickTimer = null; }
    if (this.hardCapTimer) { clearTimeout(this.hardCapTimer); this.hardCapTimer = null; }
    this.deepgram?.close();
    this.deepgram = null;
  }

  // ─── Transcript handling ───────────────────────────────────────────────

  private onTranscript(r: TranscriptResult): void {
    this.transcriptsReceived += 1;
    // [pd-debug] log EVERY transcript (interim + final) so we can see the full feed
    console.log(
      `[pd-debug:${this.sessionId}] transcript isFinal=${r.isFinal} speechFinal=${r.speechFinal} text="${r.text}" wordCount=${r.words?.length ?? 0}`,
    );
    if (r.words?.length) {
      console.log(
        `[pd-debug:${this.sessionId}]   words=${JSON.stringify(r.words.map((w) => ({ w: w.word, s: w.start, c: w.confidence })))}`,
      );
    }

    // Feed filler detector on BOTH interim and final. Deepgram's nova-3 model
    // strips short fillers (um/uh) between interim → final even with
    // `filler_words: true`, so finals-only missed almost every filler in
    // real-world testing. Detector dedupes by word `start` timestamp so the
    // same word arriving in interim then final is a no-op.
    this.fillerDetector.processFinalWords(r.words);

    if (!r.isFinal) return;
    this.finalTranscriptsReceived += 1;

    // Accumulate the transcript sentence buffer for post-hoc analysis.
    if (r.text.trim()) {
      const elapsed = this.elapsedSeconds();
      this.transcriptWindow.push({ text: r.text, endSecondsFromSessionStart: elapsed });
      this.allSentences.push(r.text);
      this.finalTranscriptText += (this.finalTranscriptText ? ' ' : '') + r.text;
      this.lastSpeechEndMs = Date.now();

      // Keep transcript window to last ~30s.
      const cutoff = elapsed - TRANSCRIPT_WINDOW_SECONDS;
      this.transcriptWindow = this.transcriptWindow.filter(
        (e) => e.endSecondsFromSessionStart >= cutoff,
      );
    }
  }

  private buildTranscriptWindow(): string {
    return this.transcriptWindow.map((e) => e.text).join(' ').trim();
  }

  // ─── Auto-prompt scheduling ────────────────────────────────────────────

  private onServerTick(): void {
    if (this.ended) return;
    const elapsed = this.elapsedSeconds();

    // Broadcast tick to client.
    this.safeSend({ type: 'drill_tick', elapsedSeconds: elapsed });

    const nowMs = Date.now();
    const silentForMs = nowMs - this.lastSpeechEndMs;
    const cooldownPassed = nowMs - this.lastPromptSurfacedAtMs >= PAUSE_COOLDOWN_MS;

    // [pd-debug] log tick state every 5s so we can see if pause detection is gated
    if (nowMs - this.lastTickLogAtMs >= 5000) {
      this.lastTickLogAtMs = nowMs;
      console.log(
        `[pd-debug:${this.sessionId}] tick elapsed=${elapsed.toFixed(1)}s audio=${this.audioChunksReceived} ` +
          `transcripts(all/final)=${this.transcriptsReceived}/${this.finalTranscriptsReceived} ` +
          `finalTxtLen=${this.finalTranscriptText.length} silentMs=${silentForMs} cooldownPassed=${cooldownPassed}`,
      );
    }

    // 45-second tick prompt.
    if (nowMs >= this.nextAutoPromptAtMs && cooldownPassed) {
      console.log(`[pd-debug:${this.sessionId}] TICK PROMPT firing (elapsed=${elapsed.toFixed(1)}s)`);
      void this.surfaceAutoPrompt('tick');
      return;
    }

    // 3-second pause prompt (after a non-zero amount of speech).
    if (
      this.finalTranscriptText.length > 0 &&
      silentForMs >= PAUSE_THRESHOLD_MS &&
      cooldownPassed
    ) {
      console.log(
        `[pd-debug:${this.sessionId}] PAUSE PROMPT firing (silentMs=${silentForMs}, elapsed=${elapsed.toFixed(1)}s)`,
      );
      void this.surfaceAutoPrompt('pause');
    }
  }

  private scheduleNextAutoPrompt(reason: 'start' | 'tick' | 'pause'): void {
    this.nextAutoPromptAtMs = Date.now() + AUTO_PROMPT_TICK_MS;
    if (reason === 'start') {
      // On start, do a first prompt surface right away (don't wait 45s).
      void this.surfaceAutoPrompt('start');
    }
  }

  private async surfaceAutoPrompt(reason: 'start' | 'tick' | 'pause'): Promise<void> {
    if (this.ended) return;
    // Pull next from cache; if empty, generate a batch (server-side).
    if (this.pendingPromptCache.length === 0) {
      try {
        const batch = await generatePromptBatch({
          scenarioSlug: this.scenarioSlug,
          durationPreset: this.durationPreset,
          elapsedSeconds: this.elapsedSeconds(),
          lastTranscriptWindow: this.buildTranscriptWindow(),
          previouslyShownPrompts: this.previouslyShownPrompts,
        });
        this.pendingPromptCache = [...batch.prompts];
        this.safeSend({
          type: 'prompt_batch',
          prompts: batch.prompts,
          generatedAt: Date.now(),
          batchId: `${this.sessionId}_${Date.now()}`,
        });
      } catch (err) {
        // Seed fallback (server-side) — six generic prompts for the scenario.
        const fallback = FALLBACK_SEED[this.scenarioSlug];
        if (fallback) {
          this.pendingPromptCache = [...fallback];
        }
        const kind = err instanceof PromptEngineError ? err.kind : 'unknown';
        console.warn(
          `[pressure-drill:${this.sessionId}] Prompt engine fallback: ${kind}`,
        );
      }
    }

    const next = this.pendingPromptCache.shift();
    if (!next) return;

    this.previouslyShownPrompts.push(next);
    this.recordedPromptsShown.push({
      prompt: next,
      shownAtSeconds: this.elapsedSeconds(),
      wasSwap: false,
    });
    this.lastPromptSurfacedAtMs = Date.now();
    this.nextAutoPromptAtMs = this.lastPromptSurfacedAtMs + AUTO_PROMPT_TICK_MS;

    this.safeSend({ type: 'auto_prompt', prompt: next, reason });
  }

  private async handlePromptBatchRequest(
    elapsedSeconds: number,
    lastTranscriptWindow: string,
    previouslyShownPrompts: string[],
  ): Promise<void> {
    try {
      const batch = await generatePromptBatch({
        scenarioSlug: this.scenarioSlug,
        durationPreset: this.durationPreset,
        elapsedSeconds,
        lastTranscriptWindow,
        previouslyShownPrompts,
      });
      // Replace the client's view of the cache; track on server too.
      this.pendingPromptCache = [...batch.prompts];
      this.safeSend({
        type: 'prompt_batch',
        prompts: batch.prompts,
        generatedAt: Date.now(),
        batchId: `${this.sessionId}_${Date.now()}`,
      });
    } catch (err) {
      console.warn(`[pressure-drill:${this.sessionId}] Prompt engine error on request:`, err);
      // Don't send prompt_batch; client falls back to its seed prompts.
      this.safeSend({
        type: 'error',
        message: 'Prompt generation failed; using local fallback prompts.',
      });
    }
  }

  // ─── Finish / post-hoc analysis / DB insert ────────────────────────────

  private async finish(): Promise<void> {
    if (this.ended) return;
    this.ended = true;

    const actualDurationSec = Math.max(1, Math.round(this.elapsedSeconds()));

    // Signal Deepgram we're done + give it a beat to flush final.
    await new Promise((r) => setTimeout(r, 300));

    // Build post-hoc input.
    const sentences = this.allSentences.length > 0
      ? this.allSentences
      : [this.finalTranscriptText].filter((s) => s.trim());

    let postHocFillerData: PressureDrillFillerData = {
      fillerWords: [],
      fillerPositions: [],
      sentences,
      source: 'posthoc',
    };

    if (sentences.length > 0) {
      try {
        const [userRow] = await db
          .select({ context: users.context, goals: users.goals })
          .from(users)
          .where(eq(users.id, this.userId));
        const result = await fillerAnalyzer.analyze({
          sentences,
          mode: 'conversation',
          conversationHistory: [],
          userProfile: {
            context: userRow?.context ?? null,
            goals: (userRow?.goals as string[] | null) ?? null,
          },
        });
        postHocFillerData = {
          fillerWords: result.fillerWords,
          fillerPositions: result.fillerPositions,
          sentences,
          source: 'posthoc',
        };
      } catch (err) {
        console.error(`[pressure-drill:${this.sessionId}] Post-hoc filler analysis failed:`, err);
      }
    }

    const totalFillerCount = postHocFillerData.fillerWords.reduce((s, fw) => s + fw.count, 0);
    const longestCleanStreakSeconds = this.computeLongestCleanStreak(actualDurationSec);
    const withinSessionTrend = this.computeWithinSessionTrend(actualDurationSec, postHocFillerData);

    try {
      const [row] = await db
        .insert(pressureDrillSessions)
        .values({
          userId: this.userId,
          durationSeconds: actualDurationSec,
          totalFillerCount,
          fillerData: postHocFillerData,
          scenarioSlug: this.scenarioSlug,
          durationSelectedSeconds: this.durationPreset,
          promptsShown: this.recordedPromptsShown,
          longestCleanStreakSeconds,
          withinSessionTrend,
        })
        .returning();

      this.safeSend({
        type: 'drill_ended',
        sessionId: row.id,
        scenarioSlug: this.scenarioSlug,
        durationSeconds: actualDurationSec,
        durationSelectedSeconds: this.durationPreset,
        promptsShown: this.recordedPromptsShown,
        longestCleanStreakSeconds,
        withinSessionTrend,
      });
    } catch (err) {
      console.error(`[pressure-drill:${this.sessionId}] DB insert failed:`, err);
      this.safeSend({ type: 'error', message: 'Failed to save session.' });
    } finally {
      this.cleanup();
    }
  }

  // ─── Metric computation ────────────────────────────────────────────────

  /** Longest span of time in seconds where no realtime-detected filler fired. */
  private computeLongestCleanStreak(actualDurationSec: number): number {
    const sorted = [...this.fillerTimestampsSeconds].sort((a, b) => a - b);
    let longest = 0;
    let prev = 0;
    for (const t of sorted) {
      longest = Math.max(longest, t - prev);
      prev = t;
    }
    longest = Math.max(longest, actualDurationSec - prev);
    return Math.round(longest);
  }

  /** Per-third filler rates (fillers/min) using post-hoc total count prorated by timestamp distribution. */
  private computeWithinSessionTrend(
    actualDurationSec: number,
    postHoc: PressureDrillFillerData,
  ): WithinSessionTrend {
    // If we have realtime timestamps, use those for bucketing — they give the
    // most accurate distribution. Otherwise, fall back to evenly-distributed.
    const third = actualDurationSec / 3;
    const tsBuckets = [0, 0, 0];
    for (const t of this.fillerTimestampsSeconds) {
      if (t < third) tsBuckets[0]++;
      else if (t < 2 * third) tsBuckets[1]++;
      else tsBuckets[2]++;
    }

    // Scale to fillers/min.
    const minutesPerThird = third / 60;
    const toRate = (n: number) => (minutesPerThird > 0 ? n / minutesPerThird : 0);

    // If realtime detected none but post-hoc found some, spread post-hoc evenly.
    const realtimeTotal = tsBuckets.reduce((a, b) => a + b, 0);
    const posthocTotal = postHoc.fillerWords.reduce((s, fw) => s + fw.count, 0);

    if (realtimeTotal === 0 && posthocTotal > 0) {
      const per = posthocTotal / 3;
      return {
        firstThirdRate: Number(toRate(per).toFixed(2)),
        middleThirdRate: Number(toRate(per).toFixed(2)),
        lastThirdRate: Number(toRate(per).toFixed(2)),
      };
    }

    return {
      firstThirdRate: Number(toRate(tsBuckets[0]).toFixed(2)),
      middleThirdRate: Number(toRate(tsBuckets[1]).toFixed(2)),
      lastThirdRate: Number(toRate(tsBuckets[2]).toFixed(2)),
    };
  }

  // ─── Utilities ─────────────────────────────────────────────────────────

  private elapsedSeconds(): number {
    return Math.max(0, (Date.now() - this.startedAtMs) / 1000);
  }

  private safeSend(obj: unknown): void {
    if (this.socket.readyState === this.socket.OPEN) {
      this.socket.send(JSON.stringify(obj));
    }
  }
}

// Server-side seed fallback. Mobile has its own copy too (Phase 0). Kept
// duplicated on purpose: if Haiku fails on the first batch (before any client
// cache exists), the server still has something to hand back.
const FALLBACK_SEED: Record<ScenarioSlug, readonly string[]> = {
  pitch_idea: [
    'Name the hardest trade-off.',
    'Who is the first paying user?',
    'What kills this in 6 months?',
    'Why now — why not 2 years ago?',
    'What does a skeptic get wrong?',
    'What would you do with $10M?',
  ],
  explain_job: [
    'Walk through yesterday, hour by hour.',
    'What do you actually produce?',
    'Who judges your work?',
    'Name the hardest part nobody sees.',
    'What metric defines success?',
    'Who uses what you make?',
  ],
  teach_concept: [
    'Give me a one-sentence analogy.',
    'Where does the concept break?',
    'What do beginners get wrong first?',
    'Explain it to a 12-year-old.',
    'Why does this matter in practice?',
    'Name a real-world example.',
  ],
  tell_about_yourself: [
    'What would a peer say about you?',
    'Name your biggest failure so far.',
    'Why this path and not another?',
    'What do you want next?',
    'Describe a turning point.',
    'What bores you?',
  ],
  defend_opinion: [
    'State the strongest counter-argument.',
    'What evidence do you rest on?',
    'What would change your mind?',
    'Cost of being wrong here?',
    'Name the minimum you would retreat to.',
    'Who agrees with you — and why?',
  ],
  formative_story: [
    'What did you believe before?',
    'Who else was there?',
    'What did you see — literally?',
    'What would you tell your past self?',
    'What did you stop doing afterward?',
    'Was there a single moment?',
  ],
};
