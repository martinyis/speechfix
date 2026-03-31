import 'dotenv/config';
import { db } from '../src/db/index.js';
import { sessions, corrections, fillerWords } from '../src/db/schema.js';
import { GrammarAnalyzer } from '../src/analysis/analyzers/grammar.js';
import { FillerAnalyzer } from '../src/analysis/analyzers/fillers.js';
import type { AnalysisResult } from '../src/analysis/types.js';

const grammarAnalyzer = new GrammarAnalyzer();
const fillerAnalyzer = new FillerAnalyzer();

async function analyzeSpeech(sentences: string[]): Promise<AnalysisResult> {
  const input = { sentences, mode: 'recording' as const };
  const [grammar, fillers] = await Promise.all([
    grammarAnalyzer.analyze(input),
    fillerAnalyzer.analyze(input),
  ]);
  return {
    corrections: grammar.corrections,
    fillerWords: fillers.fillerWords,
    fillerPositions: fillers.fillerPositions,
    sessionInsights: grammar.sessionInsights,
  };
}

const TEST_TEXTS = [
  // Session 1
  `Need to improve task, personalization planner agent on a personal level because right now what I gave it a list of tasks and I didn't ask a single question. It's like generate me lanes of work, which I really wanted, but the tasks were misunderstood and not properly configured, and like this description of task for a very short, not the scripture like we need to make agent better to ma. Ask me questions if it doesn't understand 100% the problem, but I'm trying to solve specifically the task I'm trying to do right and then on the output side I need better description of the task and that I'm trying to do so I can just copy paste it to different agent who will be able to do it right away but in order for us to have a better description of the task, the agent that itself has to have better understanding of the task which you didn't have because it didn't ask me a question for some reason when I provided a list of task I needed to finish.`,

  // Session 2
  `Is it possible to have here in this current session agent team where I'm gonna have a discussed agent I'm going to discuss with him changes to the prompt analysis prompt for the speech to make it better. I better I'm way more concise then we're gonna have execution agent who's going to execute the changes I have discussed with discussion agent and then then we're gonna have evolution agent who's going to Adelaide the quality of of our new changes so basically inflation agents is going to Adelaide, but I really wanna achieve. I wanna have a no that's it. I wanna have an agent team here right and I want to be able to talk to each agent individually to give them as many details as possible, and then they have also ability to communicate with this organization agent basically what I'm trying to do here is to test out the agent team feature in cloud code.`,

  // Session 3
  `On the promised performance is, I think it's very poor like it. Let's say I had a dialogue with like five different things I said and it doesn't didn't catch a lot of mistakes I had. I had said it just just gave me like only one hour for some reason, you can look at look it up yourself. I'll give you access to look up last 33 session sessions. I haven't database and take a look at it and understand if it was right or wrong so you have a freedom to do that I think we don't need to say that I'm that it's Ukraine one in France I mean like I'm Ukraine myself but maybe yeah maybe we don't need that because this might be used by Mexican speakers or I know French people German people so we might get rid of it as well yeah I think error suggestion work well do you have other ideas maybe something better I can think of like push me back and give me different ideas and try to cover the areas that I haven't covered that I might have forgotten about and I have not concerned about because this is this version is very very raw I think and there is a lot of things I'm missing. It's a lot of things I don't know about right I think social insights are right. I mean the whole barbershop obsession that because later on we're gonna have pattern recognition, but as of right now, it works well so if we can keep it, I think.`,

  // Session 4
  `I think the short serve it tear assured severity tear as a good idea so we can do it. I think we could flag the whole sentence online like when they like the whole center is a super wrong but again there might be a very long sentence and there's different parts in the sentence that might be how I have mistakes right so we can flag that and shove them separate as we do right now but if like the full sentence is wrong and then yes, we can show the full sentence and how to say it correctly again we have to be smart about it because there might be a sentence where beginning is wrong the middle is OK and then the ending is wrong so I wanna show beginning and ending error separately but then there might be where the full sentence is completely completely wrong and we wanna show the full sentence. Have to share it properly so we have to be smart about it to be honest I have I have an idea of Kevin. I'm gonna threshold so like I don't know maybe some kind of value let's say I'm a user right and I want to be a strict as possible that I'm going to have stress hold of 100 and it's going to be super super super strict like every single error which is like super bad it's going to defy but then I'm I might pass number 80 or 60 so actually I hope this is a very cool idea to have it to be able to modify it right like dynamic word the username there is under their account will be able to pass this volume for now let's let's make it like pretty strict like I would say 85% strictness later I'm going to implement a feature to be able to modify strictness that this is a very good point well Done`,

  // Session 5
  `Can you clear our database with sessions because there's so many sessions which are pretty useless and I want to create a few new new ones so just clear it out`,
];

// Simple sentence splitter (same approach the transcription service uses)
function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|(?<=\w)\s*\n+\s*/)
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

async function seedSessions() {
  console.log(`Seeding ${TEST_TEXTS.length} test sessions...\n`);

  for (let i = 0; i < TEST_TEXTS.length; i++) {
    const text = TEST_TEXTS[i];
    const sentences = splitSentences(text);
    const estimatedDuration = Math.round(text.split(/\s+/).length / 2.5); // ~2.5 words/sec

    console.log(`\n=== Session ${i + 1} ===`);
    console.log(`Text: ${text.substring(0, 80)}...`);
    console.log(`Sentences: ${sentences.length}`);
    console.log(`Estimated duration: ${estimatedDuration}s`);
    console.log(`Running Claude analysis...`);

    const analysisResult = await analyzeSpeech(sentences);

    console.log(`Corrections: ${analysisResult.corrections.length}`);
    console.log(`Filler words: ${analysisResult.fillerWords.length}`);
    console.log(`Session insights: ${analysisResult.sessionInsights.length}`);

    // Insert session
    const [session] = await db
      .insert(sessions)
      .values({
        transcription: text,
        durationSeconds: estimatedDuration,
        analysis: {
          sentences,
          fillerPositions: analysisResult.fillerPositions,
          sessionInsights: analysisResult.sessionInsights,
        },
      })
      .returning();

    // Insert corrections
    if (analysisResult.corrections.length > 0) {
      await db.insert(corrections).values(
        analysisResult.corrections.map(c => ({
          sessionId: session.id,
          originalText: c.originalText,
          correctedText: c.correctedText,
          explanation: c.explanation || null,
          correctionType: c.correctionType || 'other',
          sentenceIndex: c.sentenceIndex,
          severity: c.severity,
          contextSnippet: c.contextSnippet || null,
        }))
      );
    }

    // Insert filler words
    if (analysisResult.fillerWords.length > 0) {
      await db.insert(fillerWords).values(
        analysisResult.fillerWords.map(f => ({
          sessionId: session.id,
          word: f.word,
          count: f.count,
        }))
      );
    }

    console.log(`Session ${i + 1} saved with ID ${session.id}`);
  }

  console.log('\nDone! All sessions seeded.');
  process.exit(0);
}

seedSessions().catch(err => {
  console.error('Error seeding sessions:', err);
  process.exit(1);
});
