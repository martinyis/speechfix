import OpenAI from 'openai';
import fs from 'fs';
import { execSync } from 'child_process';
import path from 'path';
import { randomUUID } from 'crypto';

const openai = new OpenAI();

/**
 * Strip leading and trailing silence from audio using ffmpeg.
 * Keeps natural pauses between speech intact.
 * Falls back to original file if ffmpeg fails.
 */
export function stripSilence(inputPath: string): string {
  const outputPath = path.join('/tmp', `${randomUUID()}_stripped.m4a`);

  try {
    execSync(
      `ffmpeg -i "${inputPath}" -af "silenceremove=start_periods=1:start_duration=0.5:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_duration=0.5:start_threshold=-50dB,areverse" -y "${outputPath}"`,
      { stdio: 'pipe' }
    );
    return outputPath;
  } catch (err) {
    console.warn('[transcription] ffmpeg silence stripping failed, using original file:', err);
    return inputPath;
  }
}

/**
 * Transcribe audio using OpenAI Whisper with filler word preservation.
 * Strips silence first, then sends to Whisper with a filler-heavy prompt
 * to encourage preserving disfluencies (um, uh, like, you know, etc.).
 */
export async function transcribe(
  audioPath: string
): Promise<{ text: string; sentences: string[] }> {
  const processedAudioPath = stripSilence(audioPath);

  // Check if file exists and has content after silence stripping
  try {
    const stats = fs.statSync(processedAudioPath);
    if (stats.size === 0) {
      return { text: '', sentences: [] };
    }
  } catch {
    return { text: '', sentences: [] };
  }

  try {
    const fileStream = fs.createReadStream(processedAudioPath);

    const response = await openai.audio.transcriptions.create({
      model: 'gpt-4o-mini-transcribe',
      file: fileStream,
      language: 'en',
      prompt:
        "Umm, let me think like, hmm... Okay, here's what I'm, like, thinking. You know, it's, uh, sort of like, basically, I mean, right, so, actually, I was gonna say something. Um, uh, like, you know, so, basically, actually, right, I mean.",
      response_format: 'text',
    });

    // response is the text string when response_format is 'text'
    const fullText = (typeof response === 'string' ? response : String(response)).trim();

    // Handle silence-only recordings that might produce empty or whitespace-only output
    if (!fullText) {
      return { text: '', sentences: [] };
    }

    // Split into sentences, preserving punctuation with the preceding sentence
    const sentenceArray = fullText
      .split(/(?<=[.?!])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    return { text: fullText, sentences: sentenceArray };
  } finally {
    // Clean up the stripped temp file (only if it's different from input)
    if (processedAudioPath !== audioPath) {
      fs.unlink(processedAudioPath, () => {});
    }
  }
}
