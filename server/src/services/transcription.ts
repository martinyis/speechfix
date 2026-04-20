import fs from 'fs';

/**
 * Send audio to Deepgram and return transcript.
 */
async function callDeepgram(
  audioBuffer: Buffer,
  contentType: string,
  extraParams?: Record<string, string>,
): Promise<{ text: string; sentences: string[] }> {
  const params = new URLSearchParams({
    model: 'nova-3',
    language: 'en',
    smart_format: 'true',
    filler_words: 'true',
    punctuate: 'true',
    ...extraParams,
  });

  const response = await fetch(
    `https://api.deepgram.com/v1/listen?${params}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`,
        'Content-Type': contentType,
      },
      body: audioBuffer,
    }
  );

  if (!response.ok) {
    throw new Error(`Deepgram API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const fullText = (data.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? '').trim();

  if (!fullText) {
    return { text: '', sentences: [] };
  }

  const sentenceArray = fullText
    .split(/(?<=[.?!])\s+/)
    .map((s: string) => s.trim())
    .filter((s: string) => s.length > 0);

  return { text: fullText, sentences: sentenceArray };
}

/**
 * Transcribe raw PCM audio (16-bit LE, 16kHz, mono).
 * Sends directly to Deepgram without silence stripping — designed for
 * short practice recordings where silence removal is destructive.
 */
export async function transcribeRawPCM(
  audioPath: string,
): Promise<{ text: string; sentences: string[] }> {
  try {
    const stats = fs.statSync(audioPath);
    console.log(`[transcription] transcribeRawPCM — file size: ${stats.size} bytes, duration est: ${(stats.size / 32000).toFixed(2)}s`);
    if (stats.size === 0) {
      return { text: '', sentences: [] };
    }
  } catch {
    return { text: '', sentences: [] };
  }

  const audioBuffer = fs.readFileSync(audioPath);
  return await callDeepgram(audioBuffer, 'audio/l16;rate=16000', {
    channels: '1',
    encoding: 'linear16',
    sample_rate: '16000',
  });
}
