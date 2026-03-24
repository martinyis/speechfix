# Feature Landscape

**Domain:** Speech improvement / grammar correction tool for non-native English speakers
**Researched:** 2026-03-19

## Competitive Context

The speech improvement space splits into three categories, none of which do exactly what Reflexa does:

1. **Pronunciation coaches** (ELSA Speak, Speechace) -- Focus on phoneme-level pronunciation, accent reduction. Heavily structured. Not relevant to Reflexa.
2. **Public speaking coaches** (Orai, Yoodli, Poised, Cadence) -- Focus on delivery mechanics: pacing, filler words, energy, confidence. Grammar correction is either absent or secondary.
3. **Language learning platforms** (Speak, Talkio, Gliglish) -- Conversational AI partners with grammar feedback baked into structured lessons. Gamified. Not free-form.

Reflexa sits in a gap: **free-form speech recording with grammar/structure correction and long-term pattern tracking**. The closest competitor is Pronounce (getpronounce.com), which records calls and provides grammar/pronunciation feedback, but it lacks cross-session pattern analysis and is oriented toward call recording rather than deliberate practice.

This means most features below are informed by what competitors do well (and poorly), but the core value proposition -- "show me my recurring grammar mistakes over time" -- has no direct competitor doing it well.

---

## Table Stakes

Features users expect. Missing = product feels incomplete or broken.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| One-tap recording | Every speech app has a big mic button. Users expect zero friction to start. | Low | Core UX. Must feel instant. No setup screens before recording. |
| Accurate transcription | If the transcript is wrong, all downstream analysis is worthless. Trust dies immediately. | Low (API call) | Whisper API handles this. Non-native accents are the risk -- Whisper handles them well but not perfectly. Consider showing confidence or letting user edit transcript. |
| Grammar corrections with original vs. corrected | Users need to see what they said wrong next to how to say it right. This is the core feedback loop. | Medium | Side-by-side or inline diff display. ELSA and Pronounce both show corrected versions. Inline highlighting (red original, green correction) is the expected pattern. |
| Filler word detection and counts | Orai, Poised, Yoodli, Cadence all do this. Users expect it in any speech feedback tool. | Low | Count of "um", "uh", "like", "you know", "basically", "so", "right", "actually". Show total count + per-minute rate. Highlight in transcript. |
| Session history / list view | Users expect to see past sessions. Every speech app has this. Without it, there's no sense of progress. | Low | List of sessions with date, duration, mistake count summary. Tap to see full analysis. |
| Fast feedback loop | Pronounce and ELSA provide near-instant feedback. Users will not wait 30+ seconds staring at a spinner. | Medium | PROJECT.md says <15 seconds for 3-minute recording. Show progress states (transcribing... analyzing...) not just a spinner. |
| Clear error categorization | Users need to know what kind of mistake they made. "Grammar error" is not enough -- was it articles, prepositions, verb tense? | Medium | Research shows non-native speakers' most common errors: articles (a/the), prepositions, subject-verb agreement, verb tense, word order. AI prompt must categorize. |

## Differentiators

Features that set Reflexa apart. Not expected by users, but this is where the product thesis lives.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Cross-session pattern analysis | No competitor does this well. Poised tracks meeting scores over time but doesn't surface "you keep making the same article mistake." This is Reflexa's core hypothesis. | High | Requires accumulating session data and running aggregate analysis. Smart context management needed -- can't dump 50 sessions into one API call. Summarize-then-analyze pattern. |
| Recurring mistake identification | "You've used 'depend of' instead of 'depend on' in 4 of your last 7 sessions." Specific, actionable, personalized. | High | Depends on pattern analysis. Needs structured storage of individual mistakes (not just raw text) to compare across sessions. |
| Mistake severity / prioritization | Not all mistakes matter equally. "I goed" is obvious and rare. "I am agree" is subtle and frequent. Surface the mistakes that actually matter. | Medium | AI prompt needs to distinguish between: critical (changes meaning), moderate (sounds unnatural), minor (technically wrong but understood). |
| No-judgment, corrections-only philosophy | Competitors are full of scores, streaks, and badges. Reflexa's deliberate absence of gamification is a differentiator for serious users who find that patronizing. | Low | Not a feature to build -- a feature to NOT build. But the UI tone matters: clinical and respectful, not celebratory. |
| Structural feedback beyond grammar | "Your sentence is grammatically correct but awkward. A native speaker would say..." This goes beyond error correction into naturalness coaching. | Medium | LLMs are uniquely good at this. Most competitors only flag outright errors. Suggesting more natural phrasing is high-value for advanced non-native speakers. |
| Session-over-session progress visibility | "Last month you averaged 12 grammar issues per session. This month: 7." Simple but powerful. Validates the entire product hypothesis. | Medium | Requires consistent, comparable metrics across sessions. Normalize by session length (issues per minute). |
| Vocabulary variety tracking | "You used 'good' 14 times. Consider: effective, solid, strong, appropriate." Tracks vocabulary breadth across sessions. | Medium | Useful for advanced speakers who are grammatically correct but repetitive. Not table stakes -- a later-phase differentiator. |

## Anti-Features

Features to explicitly NOT build. These are deliberate exclusions, not backlog items.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Scores and ratings | Scores create anxiety, feel arbitrary, and shift focus from learning to performing. Every competitor does this (ELSA has an "overall speaking score"). Reflexa's thesis is that honest corrections are more valuable than a number. | Show concrete metrics (mistake count, filler word count, types of errors) without synthesizing them into a single score. Let the user judge their own progress. |
| Gamification (streaks, badges, XP) | Attracts casual users, repels serious ones. Creates obligation instead of motivation. Explicitly excluded in PROJECT.md. | The "reward" is seeing your mistakes decrease over time. The pattern analysis IS the motivation. |
| Pronunciation coaching | Different problem, different technology, different user need. ELSA and Speechace own this space. Mixing it in dilutes focus and massively increases complexity. | Stay focused on grammar, structure, filler words, naturalness. |
| AI conversation mode | Structured back-and-forth conversation with AI. Different product entirely. Requires real-time streaming, TTS, turn-taking logic. Explicitly out of scope in PROJECT.md (v2). | Free-form recording is the input. User talks about whatever they want, whenever they want. |
| Lesson-based curriculum | Structured lessons ("Today: prepositions") are the language-learning-app approach. Reflexa is a mirror, not a teacher. | Feedback is always based on what the user actually said, not what a curriculum prescribed. |
| Social features / sharing | Sharing speech mistakes is deeply personal. Social pressure does not help here. | Single-user tool. No accounts, no sharing, no leaderboards. |
| Real-time correction during speech | Poised does this for meetings. It interrupts flow and creates self-consciousness. The value is in post-speech reflection. | Always analyze after recording is complete. Never interrupt the user while speaking. |
| Multi-language support | English-only per PROJECT.md. Supporting other languages multiplies complexity with no value for the target user (the builder). | Hard-code English. Don't even build the abstraction layer for multi-language. |

## Feature Dependencies

```
Recording (tap to record, stop)
  --> Transcription (Whisper API)
    --> AI Analysis (Claude: grammar, filler words, structure)
      --> Results Display (original vs corrected, categorized errors)
        --> Session Storage (save to PostgreSQL)
          --> Session History (list past sessions)
            --> Pattern Analysis (cross-session recurring mistakes)
              --> Progress Tracking (trends over time)
```

Key dependency insights:
- Everything flows from Recording --> Transcription --> Analysis. This pipeline must work before anything else matters.
- Session Storage is the bridge between "single session tool" and "long-term improvement tool." Must be designed for queryability from the start (structured mistake data, not just blobs of text).
- Pattern Analysis depends on having enough sessions stored (minimum ~5 per PROJECT.md). It's the most complex feature but also the most differentiating.

## MVP Recommendation

**Phase 1 -- Core feedback loop (all table stakes):**
1. One-tap recording with clear start/stop
2. Whisper transcription
3. Claude analysis: grammar corrections, filler word detection, error categorization
4. Results display: original vs corrected, highlighted errors, filler word counts
5. Session storage in PostgreSQL
6. Session history list

**Phase 2 -- Pattern intelligence (core differentiators):**
1. Cross-session pattern analysis
2. Recurring mistake identification
3. Session-over-session progress metrics

**Defer to later:**
- Vocabulary variety tracking: Valuable but not part of the core hypothesis. Add once the feedback loop and pattern tracking are validated.
- Structural/naturalness feedback: Can be added by refining the AI prompt. Low-effort enhancement once the core works.
- Mistake severity prioritization: Refine over time based on real usage. Initial version can treat all mistakes equally.

**Do not build ever (per project philosophy):**
- Scores, gamification, pronunciation, lessons, social features, real-time correction

## Sources

- [Orai - AI-powered speech coaching](https://orai.com/)
- [ELSA Speech Analyzer](https://speechanalyzer.elsaspeak.com/)
- [Poised - AI Communication Coach](https://www.poised.com/)
- [Yoodli - AI Speech Coach](https://yoodli.ai/)
- [Pronounce - English Speech Checker](https://www.getpronounce.com/)
- [Cadence - Public Speaking](https://cadence-ai.app/)
- [Speak - Language Learning App](https://www.speak.com/)
- [Talkio AI - Language Practice](https://www.talkio.ai/blog/best-ai-language-speaking-practice-apps-in-2026)
- [ScreenApp Speech Analyzer](https://screenapp.io/features/speech-analyzer-online)
- [Research on grammatical errors in non-native speech](https://www.researchgate.net/publication/224382233_An_analysis_of_grammatical_errors_in_non-native_speech_in_English)
- [SmallTalk2Me - AI English Practice](https://smalltalk2.me)
- [Gliglish - Language Learning by Speaking](https://gliglish.com/)
