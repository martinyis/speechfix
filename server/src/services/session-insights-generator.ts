import Groq from 'groq-sdk';
import type { Correction, FillerWordCount, FillerWordPosition, SessionInsight, PhasedInsightsPayload } from '../analysis/types.js';

const groq = new Groq();
const MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct';

interface SessionBriefInput {
  sentences: string[];
  corrections: Correction[];
  fillerWords: FillerWordCount[];
  durationSeconds: number;
  existingInsights: SessionInsight[];
}

export async function generateSessionBriefInsights(input: SessionBriefInput): Promise<SessionInsight[]> {
  const { sentences, corrections, fillerWords, durationSeconds, existingInsights } = input;
  const insights: SessionInsight[] = [];

  // --- Computed metrics (no LLM) ---
  const totalWords = sentences.join(' ').split(/\s+/).filter(Boolean).length;
  const minutes = durationSeconds / 60;
  const wpm = minutes > 0 ? Math.round(totalWords / minutes) : 0;
  const totalFillers = fillerWords.reduce((sum, f) => sum + f.count, 0);
  const fillersPerMin = minutes > 0 ? +(totalFillers / minutes).toFixed(1) : 0;

  insights.push(
    { type: 'metric', description: 'Words per minute', value: wpm },
    { type: 'metric', description: 'Sentences', value: sentences.length },
    { type: 'metric', description: 'Issues found', value: corrections.length },
    { type: 'metric', description: 'Fillers per minute', value: fillersPerMin },
  );

  // --- LLM-generated qualitative insights ---
  const errorCount = corrections.filter((c) => c.severity === 'error').length;
  const improvementCount = corrections.filter((c) => c.severity === 'improvement').length;
  const polishCount = corrections.filter((c) => c.severity === 'polish').length;
  const fillerSummary = fillerWords.map((f) => `"${f.word}" (${f.count}x)`).join(', ') || 'none';
  const existingPatterns = existingInsights
    .filter((i) => ['repetitive_word', 'hedging_pattern', 'discourse_pattern'].includes(i.type))
    .map((i) => i.description)
    .join('; ') || 'none detected';

  const prompt = `Analyze this speech session and return JSON insights.

Session stats:
- Duration: ${Math.round(durationSeconds)}s, ${totalWords} words, ${sentences.length} sentences
- Corrections: ${errorCount} errors, ${improvementCount} improvements, ${polishCount} polish
- Filler words: ${fillerSummary}
- Speech patterns: ${existingPatterns}

Return ONLY valid JSON array with these objects:
1. One "quality_assessment" — holistic 1-sentence summary of speech quality
2. One or two "strength" — what the speaker did well (be specific)
3. One or two "focus_area" — what to work on (be specific, actionable)

Format: [{"type": "quality_assessment"|"strength"|"focus_area", "description": "..."}]

Keep descriptions concise (under 15 words each). Be encouraging but honest.`;

  try {
    const response = await groq.chat.completions.create({
      model: MODEL,
      messages: [
        { role: 'system', content: 'You are a speech analysis expert. Return only valid JSON.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 512,
    });

    const raw = response.choices[0]?.message?.content?.trim() ?? '[]';
    // Extract JSON array from response (handle markdown code blocks)
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as Array<{ type: string; description: string }>;
      for (const item of parsed) {
        if (['quality_assessment', 'strength', 'focus_area'].includes(item.type) && item.description) {
          insights.push({
            type: item.type as SessionInsight['type'],
            description: item.description,
          });
        }
      }
    }
  } catch (err) {
    console.error('[session-insights] LLM generation failed:', err);
    // Graceful fallback — computed metrics still returned
  }

  return insights;
}

// -- Phased insights: runs BEFORE corrections, uses only fillers + sentences --

interface PhasedInsightsInput {
  sentences: string[];
  fillerWords: FillerWordCount[];
  fillerPositions: FillerWordPosition[];
  durationSeconds: number;
  existingInsights: SessionInsight[];
}

export async function generatePhasedInsights(input: PhasedInsightsInput): Promise<PhasedInsightsPayload> {
  const { sentences, fillerWords, fillerPositions, durationSeconds, existingInsights } = input;

  // --- Computed metrics ---
  const totalWords = sentences.join(' ').split(/\s+/).filter(Boolean).length;
  const minutes = durationSeconds / 60;
  const wpm = minutes > 0 ? Math.round(totalWords / minutes) : 0;
  const totalFillers = fillerWords.reduce((sum, f) => sum + f.count, 0);
  const fillersPerMinute = minutes > 0 ? +(totalFillers / minutes).toFixed(1) : 0;

  const metrics = { wpm, sentenceCount: sentences.length, fillersPerMinute, totalFillers };
  const insights: SessionInsight[] = [];

  // Computed metric insights
  insights.push(
    { type: 'metric', description: 'Words per minute', value: wpm },
    { type: 'metric', description: 'Sentences', value: sentences.length },
    { type: 'metric', description: 'Fillers per minute', value: fillersPerMinute },
  );

  // --- LLM: score + qualitative insights (no corrections needed) ---
  const fillerSummary = fillerWords.map(f => `"${f.word}" (${f.count}x)`).join(', ') || 'none';
  const existingPatterns = existingInsights
    .filter(i => ['repetitive_word', 'hedging_pattern', 'discourse_pattern'].includes(i.type))
    .map(i => i.description)
    .join('; ') || 'none detected';

  const prompt = `Analyze this speech session and return JSON with a score and insights.

Session stats:
- Duration: ${Math.round(durationSeconds)}s, ${totalWords} words, ${sentences.length} sentences
- Filler words: ${fillerSummary}
- Fillers per minute: ${fillersPerMinute}
- Speech patterns: ${existingPatterns}

Note: Grammar corrections are not yet available. Base your score on fluency, vocabulary richness, sentence structure, and filler usage only.

Return ONLY valid JSON with this structure:
{
  "score": <number 0-100>,
  "quality_assessment": "<holistic 1-sentence summary>",
  "strengths": ["<specific strength 1>"],
  "focus_areas": ["<specific actionable area>"]
}

Score guidelines:
- 90-100: Exceptional fluency, minimal fillers, varied vocabulary
- 70-89: Good fluency, occasional fillers or simple structures
- 50-69: Moderate fluency, noticeable filler usage or repetitive patterns
- 30-49: Below average, frequent fillers or limited vocabulary
- 0-29: Significant fluency challenges

Keep text descriptions concise (under 15 words each). Be encouraging but honest.`;

  let score: number | null = null;

  try {
    const response = await groq.chat.completions.create({
      model: MODEL,
      messages: [
        { role: 'system', content: 'You are a speech analysis expert. Return only valid JSON.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 512,
    });

    const raw = response.choices[0]?.message?.content?.trim() ?? '{}';
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);

      if (typeof parsed.score === 'number') {
        score = Math.max(0, Math.min(100, Math.round(parsed.score)));
        insights.push({ type: 'score', description: 'Session score', value: score });
      }

      if (parsed.quality_assessment) {
        insights.push({ type: 'quality_assessment', description: parsed.quality_assessment });
      }

      const strengths = Array.isArray(parsed.strengths) ? parsed.strengths : [];
      for (const s of strengths) {
        if (typeof s === 'string') insights.push({ type: 'strength', description: s });
      }

      const focusAreas = Array.isArray(parsed.focus_areas) ? parsed.focus_areas : [];
      for (const f of focusAreas) {
        if (typeof f === 'string') insights.push({ type: 'focus_area', description: f });
      }
    }
  } catch (err) {
    console.error('[session-insights] Phased LLM generation failed:', err);
    // Graceful fallback — computed metrics still returned, score stays null
  }

  return { score, insights, fillerWords, fillerPositions, metrics };
}
