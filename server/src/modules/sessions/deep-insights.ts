import Anthropic from '@anthropic-ai/sdk';
import { eq } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { sessions, users } from '../../db/schema.js';
import type { SpeechTimeline } from '../voice/speech-types.js';
import { buildUserProfileBlock, type UserProfileInput } from '../shared/user-profile-prompt.js';

export interface DeepInsightAnchor {
  /** "point" → single moment (a word, a short phrase). "range" → utterance or topic span. */
  kind: 'point' | 'range';
  /** Absolute seconds from session start. For point anchors, end_seconds may equal start_seconds. */
  start_seconds: number;
  end_seconds: number;
  /** 0-indexed utterance this anchor sits inside (optional cross-reference). */
  utterance_index?: number;
  /** Short verbatim phrase from the transcript that identifies the moment (optional). */
  quoted_text?: string;
}

export interface DeepInsight {
  type: 'overall' | 'specific';
  headline: string;
  unpack: string;
  signals_used: string[];
  /** Required for specific insights. Absent for overall insights. */
  anchor?: DeepInsightAnchor;
}

export interface DeepInsightsInput {
  speechTimeline: SpeechTimeline;
  conversationTranscript: Array<{ role: 'ai' | 'user'; text: string }>;
  corrections: Array<{
    originalText: string;
    correctedText: string;
    correctionType: string;
    severity: string;
  }>;
  fillerWords: Array<{ word: string; count: number }>;
  fillerPositions?: Array<{ word: string; sentenceIndex: number; time?: number | null }>;
  topicCategory?: string | null;
  sessionTitle?: string | null;
  durationSeconds: number;
  userProfile?: UserProfileInput | null;
}

export interface DeepInsightsResult {
  insights: DeepInsight[];
  raw: string;
  model: string;
  promptTokens?: number;
  completionTokens?: number;
  durationMs: number;
  systemPrompt: string;
  userPrompt: string;
}

const DEFAULT_MODEL = 'claude-opus-4-6';

/**
 * Resolve the model used for the deep-insights generator.
 *
 * Configurable via `DEEP_INSIGHTS_MODEL` env var so we can A/B against Sonnet
 * (or anything else) without shipping code. Falls back to Opus 4.6, which
 * matches the prompt's calibration and keeps the quality bar that was verified
 * against real sessions.
 */
function resolveModel(): string {
  return process.env.DEEP_INSIGHTS_MODEL?.trim() || DEFAULT_MODEL;
}

const SYSTEM_PROMPT = `You are a premium speech coach analyzing dense speech data from one conversation. Your job: surface 0–5 tight, direct observations a listener would miss.

You produce TWO types of insights:

1. "overall" — a pattern across the whole session (how the speaker behaves). No anchor.
2. "specific" — a causal moment inside the session ("after X, Y happened"). Names the trigger and the effect. MUST include a time anchor.

══════════════════════════════════════
VOICE RULES (NON-NEGOTIABLE)
══════════════════════════════════════

- BE DIRECT. No "as if", "as though", "suggesting that", "revealing a pattern of". State the observation plainly.
- TERSE. Unpack must be ONE short sentence, ~8–15 words. If you need more words, the insight isn't sharp enough — drop it.
- INSIGHT DENSITY. Every word must carry weight. No filler phrases, no poetic wrapping, no throat-clearing.
- HEADLINE: 3–6 words. Direct. Memorable. Not clinical, not poetic — just punchy.
- SPECIFIC insights use causal structure: "After [X], [Y]" / "When [topic/word], [effect]" / "On [moment], [shift]". Name the actual trigger.
- OVERALL insights name the behavior in one clear line. No layered interpretation.

══════════════════════════════════════
STRICT CONTENT RULES
══════════════════════════════════════

1. NO RAW NUMBERS. Never "140 WPM", "70%", "4.2s". Use words: "slower", "faster", "flat", "dropped".
2. NO GRAMMAR/ERROR CORRELATION. Error patterns are handled elsewhere. Do not produce them.
3. NO GENERIC OBSERVATIONS. Skip: "you paused often", "you had filler words", "you varied pace". A single listener would notice these.
4. NO HALLUCINATION. Every insight must be grounded in provided signals (pitch, volume, pace, pauses, self-repair, word choice, topic shift, filler position, confidence).
5. PERMISSION TO RETURN NOTHING. If nothing non-obvious emerges, return an empty array. Fewer, sharper insights beat a padded list.
6. SPECIFIC insights must name a real element from the transcript/signals — a word, a topic, a turn. Not "in one part of the session" — name what happened.

7. ANCHOR RULES for specific insights (required, enforced):
   - "kind": "point" for a single word or very brief moment (≤1s); "range" for an utterance, topic span, or multi-second pattern.
   - "start_seconds" and "end_seconds" come from the data provided (utterance start/end times, filler positions, prosody sample times). Use the actual numbers from the prompt — do NOT invent times.
   - For a "point" anchor, end_seconds may equal start_seconds or be ≤0.5s later.
   - "utterance_index" is 0-indexed; include it when the anchor sits inside one specific utterance.
   - "quoted_text" is a short verbatim phrase (≤8 words) from the transcript that identifies the moment. Include it for point anchors whenever possible.
   - If a specific insight would require a timestamp you cannot derive from the data, drop the insight — do not guess.

══════════════════════════════════════
CALIBRATION EXAMPLES
══════════════════════════════════════

OVERALL (session-level behavior, direct, single-line):

- { type: "overall", headline: "Silent planner.", unpack: "You plan in silence, then deliver in a rush." }
- { type: "overall", headline: "Quieter when it matters.", unpack: "Your volume drops on the topics you care about most." }
- { type: "overall", headline: "Pushback sharpens you.", unpack: "You speak more clearly when you're disagreeing than when you're sharing." }
- { type: "overall", headline: "Two speeds, one plan.", unpack: "Normal, then a rush whenever sentences run longer than you planned." }
- { type: "overall", headline: "Silence is your coil.", unpack: "You pause not to think but to build pressure for what's next." }

SPECIFIC (moment-level, causal, names the trigger, INCLUDES anchor):

- { type: "specific", headline: "Graduation slowed you down.", unpack: "When graduation plans came up, your pace dropped and pitch fell.", anchor: { kind: "range", start_seconds: 12.4, end_seconds: 18.1, utterance_index: 2 } }
- { type: "specific", headline: "'Love' tripped you.", unpack: "You lost confidence on the word 'love' — the verb carries the weight.", anchor: { kind: "point", start_seconds: 44.6, end_seconds: 44.9, utterance_index: 3, quoted_text: "love" } }
- { type: "specific", headline: "'Well' opens every turn.", unpack: "Both responses started with 'well' after a long pause.", anchor: { kind: "point", start_seconds: 8.2, end_seconds: 8.6, utterance_index: 0, quoted_text: "well" } }
- { type: "specific", headline: "Work topic flattened you.", unpack: "After work came up, your pitch went monotone and volume dropped.", anchor: { kind: "range", start_seconds: 22.0, end_seconds: 40.3, utterance_index: 1 } }
- { type: "specific", headline: "Deflecting quickens you.", unpack: "When you turned the question back on the AI, your pace spiked.", anchor: { kind: "range", start_seconds: 35.4, end_seconds: 42.0, utterance_index: 2, quoted_text: "what about you" } }

══════════════════════════════════════
OUTPUT FORMAT
══════════════════════════════════════

Return ONLY valid JSON. No markdown. No commentary.

{
  "insights": [
    {
      "type": "overall" | "specific",
      "headline": "3–6 words. Ends in period.",
      "unpack": "One short sentence, 8–15 words. Direct. No fluff.",
      "signals_used": ["pitch", "topic", "pace", "volume", "pauses", "self_repair", "word_choice", "hedging", "confidence", "filler"],
      "anchor": {
        "kind": "point" | "range",
        "start_seconds": <number from data>,
        "end_seconds": <number from data>,
        "utterance_index": <0-indexed>,
        "quoted_text": "<optional short phrase>"
      }
    }
  ]
}

The "anchor" field is REQUIRED for type="specific" and OMITTED (or null) for type="overall".

Return 0–5 insights. Mix both types when possible. Order by strength (strongest first).`;

function buildUserPrompt(input: DeepInsightsInput): string {
  const { speechTimeline, conversationTranscript, fillerWords, fillerPositions, topicCategory, sessionTitle, durationSeconds } = input;
  const parts: string[] = [];

  parts.push('# Session context');
  if (sessionTitle) parts.push(`- Title: ${sessionTitle}`);
  if (topicCategory) parts.push(`- Topic category: ${topicCategory}`);
  parts.push(`- Duration: ${durationSeconds}s`);
  parts.push('');

  parts.push('# Conversation transcript (AI + user, in order)');
  for (const turn of conversationTranscript) {
    parts.push(`- ${turn.role.toUpperCase()}: ${turn.text}`);
  }
  parts.push('');

  parts.push('# Session-level speech signals');
  parts.push(`- Overall pace descriptor: ${describePace(speechTimeline.overallWpm)}`);
  parts.push(`- Pace variability: ${describeVariability(speechTimeline.paceVariability)}`);
  parts.push(`- Average word confidence: ${describeConfidence(speechTimeline.avgConfidence)}`);
  parts.push(`- Pitch assessment: ${speechTimeline.pitchAssessment}`);
  parts.push(`- Volume trend across session: ${speechTimeline.volumeTrend}`);
  parts.push(`- Volume consistency: ${describeConsistency(speechTimeline.volumeConsistency)}`);
  parts.push(`- Speech-to-silence ratio: ${describeRatio(speechTimeline.speechToSilenceRatio)}`);
  parts.push(`- Total pauses: ${speechTimeline.totalPauses}, longest pause: ${describePauseLength(speechTimeline.longestPauseMs)}`);
  parts.push(`- Average response latency: ${describeLatency(speechTimeline.avgResponseLatencyMs)}`);
  parts.push('');

  parts.push('# Per-utterance breakdown (each user turn, in order)');
  parts.push('Use these start/end seconds when populating "anchor" on specific insights.');
  const overallWpm = speechTimeline.overallWpm;
  for (let i = 0; i < speechTimeline.utterances.length; i++) {
    const u = speechTimeline.utterances[i];
    const relPace = relativePace(u.wpm, overallWpm);
    const confDesc = describeConfidence(u.avgConfidence);
    const lowConf = u.lowConfidenceWords.length > 0 ? ` low-confidence words: [${u.lowConfidenceWords.join(', ')}]` : '';
    const latencyDesc = u.responseLatencyMs > 0 ? `, began ${describeLatency(u.responseLatencyMs)} after AI finished` : '';
    parts.push(
      `- Utterance index=${i} [${u.startTime.toFixed(2)}s → ${u.endTime.toFixed(2)}s]: "${u.text}"` +
        `\n    pace: ${relPace}, duration ${describeDuration(u.durationMs)}${latencyDesc}, clarity ${confDesc}${lowConf}`,
    );
    // Include per-word timing so AI can anchor "point" insights to exact words
    if (u.words.length > 0 && u.words.length <= 40) {
      const wordLine = u.words
        .map((w) => `${w.word}@${w.start.toFixed(2)}`)
        .join(' ');
      parts.push(`    words: ${wordLine}`);
    } else if (u.words.length > 40) {
      // Long utterance — include just first 20 + last 10 word timings
      const head = u.words.slice(0, 20).map((w) => `${w.word}@${w.start.toFixed(2)}`).join(' ');
      const tail = u.words.slice(-10).map((w) => `${w.word}@${w.start.toFixed(2)}`).join(' ');
      parts.push(`    words (first 20): ${head}`);
      parts.push(`    words (last 10):  ${tail}`);
    }
  }
  parts.push('');

  parts.push('# Prosody contour (pitch + volume over time, ~200ms resolution)');
  if (speechTimeline.prosodySamples.length === 0) {
    parts.push('- (no prosody samples available for this session)');
  } else {
    const contour = describeProsodyContour(speechTimeline.prosodySamples, speechTimeline.utterances);
    parts.push(contour);
  }
  parts.push('');

  if (fillerWords.length > 0) {
    parts.push('# Filler words');
    for (const f of fillerWords) parts.push(`- "${f.word}": ${f.count}x`);
    if (fillerPositions && fillerPositions.length > 0) {
      parts.push('  Positions (sentence index):');
      for (const p of fillerPositions.slice(0, 20)) {
        parts.push(`  - "${p.word}" in utterance ${p.sentenceIndex + 1}${p.time != null ? ` at ~${p.time.toFixed(1)}s` : ''}`);
      }
    }
    parts.push('');
  }

  parts.push('# Your task');
  parts.push('Analyze the data above and return 0–5 deep, interpretive insights as JSON. Follow every rule in the system prompt. If nothing rises to the quality bar, return an empty array.');

  return parts.join('\n');
}

// ─── Descriptive helpers (turn numbers into natural language) ───────────────

function describePace(wpm: number): string {
  if (wpm < 100) return 'slow';
  if (wpm < 130) return 'relaxed';
  if (wpm < 160) return 'moderate';
  if (wpm < 190) return 'quick';
  return 'rushed';
}

function relativePace(utteranceWpm: number, sessionWpm: number): string {
  if (sessionWpm === 0) return describePace(utteranceWpm);
  const ratio = utteranceWpm / sessionWpm;
  if (ratio < 0.75) return `notably slower than session avg (${describePace(utteranceWpm)})`;
  if (ratio < 0.9) return `slower than session avg (${describePace(utteranceWpm)})`;
  if (ratio <= 1.1) return `near session avg (${describePace(utteranceWpm)})`;
  if (ratio <= 1.25) return `faster than session avg (${describePace(utteranceWpm)})`;
  return `notably faster than session avg (${describePace(utteranceWpm)})`;
}

function describeVariability(cv: number): string {
  if (cv < 0.1) return 'very even';
  if (cv < 0.2) return 'steady';
  if (cv < 0.35) return 'uneven';
  return 'highly erratic';
}

function describeConfidence(c: number): string {
  if (c >= 0.95) return 'crisp';
  if (c >= 0.88) return 'clear';
  if (c >= 0.8) return 'mostly clear';
  if (c >= 0.7) return 'mumbled in places';
  return 'heavily mumbled';
}

function describeConsistency(c: number): string {
  if (c >= 0.85) return 'very consistent';
  if (c >= 0.7) return 'mostly consistent';
  if (c >= 0.5) return 'uneven';
  return 'erratic';
}

function describeRatio(r: number): string {
  if (r >= 0.85) return 'almost no silence';
  if (r >= 0.7) return 'minimal silence';
  if (r >= 0.55) return 'balanced speaking/silence';
  if (r >= 0.4) return 'a lot of silence';
  return 'silence-heavy';
}

function describePauseLength(ms: number): string {
  if (ms < 500) return 'brief';
  if (ms < 1000) return 'noticeable';
  if (ms < 2000) return 'long';
  return 'very long';
}

function describeLatency(ms: number): string {
  if (ms < 150) return 'almost instantly';
  if (ms < 400) return 'quickly';
  if (ms < 800) return 'with a brief beat';
  if (ms < 1500) return 'after a clear pause';
  return 'after a long pause';
}

function describeDuration(ms: number): string {
  const s = ms / 1000;
  if (s < 2) return 'brief (under 2s)';
  if (s < 5) return `${s.toFixed(1)}s`;
  if (s < 10) return `${s.toFixed(0)}s`;
  return `${s.toFixed(0)}s (long)`;
}

/**
 * Compact the prosody sample array into a human-readable contour.
 * Describes how pitch and volume move over time in qualitative segments.
 */
function describeProsodyContour(
  samples: Array<{ t: number; pitchHz: number | null; volume: number }>,
  utterances: SpeechTimeline['utterances'],
): string {
  const out: string[] = [];
  // Anchor each utterance to the prosody samples that fall within its time range
  for (let i = 0; i < utterances.length; i++) {
    const u = utterances[i];
    const inRange = samples.filter((s) => s.t >= u.startTime && s.t <= u.endTime);
    if (inRange.length === 0) continue;

    const pitchVals = inRange.map((s) => s.pitchHz).filter((p): p is number => p != null);
    const volVals = inRange.map((s) => s.volume);

    const pitchDesc = pitchVals.length > 0 ? describeContourShape(pitchVals, 'pitch') : 'no voiced pitch detected';
    const volDesc = describeContourShape(volVals, 'volume');

    out.push(`  - Utterance ${i + 1} (${u.startTime.toFixed(1)}s → ${u.endTime.toFixed(1)}s):`);
    out.push(`      pitch contour: ${pitchDesc}`);
    out.push(`      volume contour: ${volDesc}`);
  }
  return out.join('\n');
}

function describeContourShape(vals: number[], kind: 'pitch' | 'volume'): string {
  if (vals.length < 2) return 'flat (too few samples)';
  const mean = vals.reduce((s, v) => s + v, 0) / vals.length;
  const stddev = Math.sqrt(vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length);
  const range = Math.max(...vals) - Math.min(...vals);

  // Trend: compare first third vs last third
  const third = Math.max(1, Math.floor(vals.length / 3));
  const early = vals.slice(0, third).reduce((s, v) => s + v, 0) / third;
  const late = vals.slice(-third).reduce((s, v) => s + v, 0) / third;
  const drift = late - early;

  let shape = '';
  if (kind === 'pitch') {
    const relCv = mean > 0 ? stddev / mean : 0;
    if (relCv < 0.05) shape = 'nearly flat / monotone';
    else if (relCv < 0.1) shape = 'limited movement';
    else if (relCv < 0.18) shape = 'varied';
    else shape = 'highly expressive';

    if (drift / mean > 0.08) shape += ', rising overall';
    else if (drift / mean < -0.08) shape += ', falling overall';
  } else {
    // volume — normalized 0-1
    if (stddev < 0.05) shape = 'steady';
    else if (stddev < 0.12) shape = 'moderately varied';
    else shape = 'swung widely';

    if (drift > 0.1) shape += ', growing louder';
    else if (drift < -0.1) shape += ', dropping off';
  }
  void range;
  return shape;
}

// ─── Main entrypoint ────────────────────────────────────────────────────────

export async function generateDeepInsights(
  input: DeepInsightsInput,
  options: { model?: string } = {},
): Promise<DeepInsightsResult> {
  const model = options.model ?? resolveModel();
  const userPrompt = buildUserPrompt(input);
  const profileBlock = buildUserProfileBlock(input.userProfile);
  const systemPrompt = profileBlock ? `${profileBlock}\n\n${SYSTEM_PROMPT}` : SYSTEM_PROMPT;
  const started = Date.now();

  const client = new Anthropic();
  const response = await client.messages.create({
    model,
    max_tokens: 2048,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const durationMs = Date.now() - started;
  const raw = response.content
    .filter((block) => block.type === 'text')
    .map((block) => (block as { type: 'text'; text: string }).text)
    .join('\n')
    .trim();

  let insights: DeepInsight[] = [];
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed?.insights)) {
        insights = parsed.insights
          .filter(
            (x: unknown): x is DeepInsight =>
              typeof x === 'object' &&
              x != null &&
              typeof (x as DeepInsight).headline === 'string' &&
              typeof (x as DeepInsight).unpack === 'string',
          )
          .map((x: DeepInsight) => {
            const type = x.type === 'specific' ? 'specific' : 'overall';
            const result: DeepInsight = {
              type,
              headline: x.headline,
              unpack: x.unpack,
              signals_used: Array.isArray(x.signals_used) ? x.signals_used : [],
            };
            if (type === 'specific' && x.anchor && typeof x.anchor === 'object') {
              const a = x.anchor;
              if (typeof a.start_seconds === 'number' && typeof a.end_seconds === 'number') {
                result.anchor = {
                  kind: a.kind === 'point' ? 'point' : 'range',
                  start_seconds: a.start_seconds,
                  end_seconds: a.end_seconds,
                  utterance_index: typeof a.utterance_index === 'number' ? a.utterance_index : undefined,
                  quoted_text: typeof a.quoted_text === 'string' ? a.quoted_text : undefined,
                };
              }
            }
            return result;
          });
      }
    }
  } catch (err) {
    console.error('[deep-insights] JSON parse failed:', err);
  }

  return {
    insights,
    raw,
    model,
    promptTokens: response.usage?.input_tokens,
    completionTokens: response.usage?.output_tokens,
    durationMs,
    systemPrompt,
    userPrompt,
  };
}

/**
 * Run the generator and persist the resulting insights to
 * `sessions.deep_insights`. Returns the insight array on success, or `null` if
 * the generator threw. On failure the column is explicitly set to `null` so
 * the caller / the on-demand backfill route can retry later.
 *
 * Distinct from "generated but empty": an empty array is persisted as `[]`,
 * meaning the model ran and chose silence.
 */
export async function generateAndPersistDeepInsights(
  dbSessionId: number,
  input: DeepInsightsInput,
): Promise<DeepInsight[] | null> {
  try {
    let userProfile = input.userProfile;
    if (userProfile === undefined) {
      const [row] = await db
        .select({ context: users.context, goals: users.goals, userId: sessions.userId })
        .from(sessions)
        .innerJoin(users, eq(users.id, sessions.userId))
        .where(eq(sessions.id, dbSessionId));
      userProfile = row
        ? { context: row.context ?? null, goals: (row.goals as string[] | null) ?? null }
        : null;
    }
    const result = await generateDeepInsights({ ...input, userProfile });
    await db.update(sessions)
      .set({ deepInsights: result.insights })
      .where(eq(sessions.id, dbSessionId));
    console.log(
      `[deep-insights] generated ${result.insights.length} insights for session ${dbSessionId} in ${result.durationMs}ms (model=${result.model})`,
    );
    return result.insights;
  } catch (err) {
    console.error(`[deep-insights] Failed for session ${dbSessionId}:`, err);
    try {
      await db.update(sessions)
        .set({ deepInsights: null })
        .where(eq(sessions.id, dbSessionId));
    } catch {
      // swallow — DB update failure after generator failure isn't actionable
    }
    return null;
  }
}
