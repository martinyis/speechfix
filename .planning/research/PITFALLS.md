# Domain Pitfalls

**Domain:** Speech recording + AI analysis mobile app (non-native English speaker improvement)
**Researched:** 2026-03-19

## Critical Pitfalls

Mistakes that cause rewrites, broken core features, or fundamental trust loss.

### Pitfall 1: Whisper Silently Corrects Grammar Errors Before They Reach Claude

**What goes wrong:** Whisper's training data includes heavily "cleaned" transcriptions from professional services. The model has a built-in normalizer that auto-corrects grammar toward standard English. When a non-native speaker says "He don't like it" or "I go there yesterday," Whisper may transcribe it as "He doesn't like it" or "I went there yesterday." The grammar error -- the entire thing this app exists to catch -- gets silently erased before Claude ever sees it.

**Why it happens:** Whisper was trained on ~680,000 hours of web-collected audio with normalized transcripts. Professional transcription services charge extra for verbatim output, so most training data was pre-cleaned. There is no parameter to disable this behavior. A GitHub discussion confirms: "there's a built-in normalizer that you can't do much about without probably forking the project."

**Consequences:** The app's core value proposition breaks silently. Users speak incorrectly, get back "no errors found," and conclude the app is useless. Worse, they never know why -- the pipeline looks like it's working. Research on spoken grammar assessment with Whisper shows it produced assessment errors of 20 points vs only 3 for custom language models, specifically because of this grammar-correction bias.

**Prevention:**
- Accept this limitation upfront and design around it. Whisper will catch pronunciation-level errors poorly but still captures structural issues (word order, missing articles, preposition errors) more reliably than conjugation fixes.
- Use the Whisper API `prompt` parameter with text like "Transcribe exactly as spoken, including grammatical errors, broken sentences, and non-standard usage." This steers the model but does not guarantee verbatim output.
- Consider testing Whisper's `gpt-4o-transcribe` model (newer, may have different behavior) against the standard `whisper-1` model.
- Design Claude's analysis prompt to work with "partially corrected" transcriptions -- focus on structural patterns (filler words, sentence structure, vocabulary variety) that Whisper preserves rather than conjugation errors it may fix.
- Be transparent with users: "Some grammar corrections may not appear because the transcription system normalizes speech."

**Detection:** Compare a recording where you deliberately make grammar errors against the transcription output. If errors disappear, the pipeline is silently correcting.

**Phase:** Must be addressed in Phase 1 (core pipeline). This is an architectural constraint, not a bug to fix later.

**Confidence:** HIGH -- confirmed by OpenAI GitHub discussions, academic research (Spoken Grammar Assessment Using LLM, arXiv:2410.01579), and multiple community reports.

---

### Pitfall 2: Whisper Strips Filler Words by Default

**What goes wrong:** Filler word detection ("um," "uh," "like," "you know," "so") is a core feature listed in the requirements. Whisper deliberately removes these from transcriptions. The model "tends to filter out disfluencies and filler words by default" as part of its text standardization process. Your filler word counter will show zero for every session.

**Why it happens:** Whisper was trained to produce clean, readable transcriptions. Filler words are treated as noise to remove, not signal to preserve. This is the opposite of what a speech improvement app needs.

**Consequences:** The filler word analysis feature produces no results. Users who say "like" every third word get a clean bill of health.

**Prevention:**
- Use the Whisper API `prompt` parameter with filler-word-heavy example text: "Umm, let me think like, hmm... Okay, here's what I'm, like, thinking. You know, it's, uh, sort of complicated." This steers Whisper to preserve fillers in output.
- Long prompts are more reliable at steering Whisper than short ones.
- Validate this works before building the filler analysis feature. Record test audio with deliberate filler words and verify they appear in transcription.
- Have a fallback plan: if Whisper's prompt trick is insufficient, consider CrisperWhisper (open source fork specifically built for verbatim transcription with filler detection) or a two-pass approach (Whisper for grammar, a VAD/filler detection model for disfluencies).

**Detection:** Record yourself saying "So, um, like, I was thinking, you know, that maybe, uh, we should..." and check the transcription. If fillers are missing, the prompt approach needs tuning.

**Phase:** Must be validated in Phase 1 before building the filler word analysis feature.

**Confidence:** HIGH -- confirmed by Whisper documentation, HuggingFace discussions, CrisperWhisper research (arXiv:2408.16589), and OpenAI community forums.

---

### Pitfall 3: Claude Over-Corrects Spoken English to Written English Standards

**What goes wrong:** Spoken English has different grammar rules than written English. Contractions, sentence fragments, starting sentences with "And" or "But," ending with prepositions, split infinitives -- all perfectly acceptable in speech. If Claude flags these as errors, users get flooded with false corrections that are technically "right" by written standards but wrong for spoken feedback. False positives destroy trust faster than false negatives.

**Why it happens:** LLMs are trained overwhelmingly on written text. They default to written grammar standards. Without explicit instruction, Claude will "correct" natural speech patterns into formal writing. Research shows overcorrection is especially common for advanced learners, and prompt engineering contributes "less than 1% of explained variance" in addressing this -- meaning the prompt must be very precisely crafted, not casually written.

**Consequences:** The PROJECT.md states: "flagging correct speech kills trust." If users see corrections for "Who did you talk to?" (perfectly fine in speech, "incorrect" preposition ending in writing), they lose confidence in all corrections, including legitimate ones.

**Prevention:**
- The Claude analysis prompt is the single most important piece of code in the app. Invest heavily in it.
- Explicitly instruct Claude to evaluate against spoken English norms, not written. Provide examples of what NOT to flag: contractions, sentence fragments, preposition endings, informal register.
- Use a structured output format (JSON) so corrections are parseable and categorizable. Include a confidence field for each correction.
- Include negative examples in the prompt: "Do NOT flag: 'Who did you talk to?' -- ending prepositions are normal in speech."
- Build a manual review step in V1. Review Claude's corrections yourself for the first ~10 sessions. Tune the prompt based on false positives you see.
- Consider a two-pass approach: Claude identifies potential issues, then a second Claude call validates each one with explicit spoken-English criteria.

**Detection:** Use the app yourself. If you see corrections that feel wrong or pedantic, the prompt is miscalibrated. Track false positive rate per session.

**Phase:** Phase 1, but expect iterative refinement across all phases. The prompt will need tuning after real usage.

**Confidence:** HIGH -- well-documented LLM overcorrection behavior, confirmed by research and the project's own requirements.

---

### Pitfall 4: Whisper Hallucinations on Silence and Background Noise

**What goes wrong:** When audio contains silence, very quiet speech, or background noise, Whisper generates fabricated text. This is not occasional -- research indicates hallucinations affect 8 out of 10 transcriptions to some degree. Common hallucinations include repetitive phrases, foreign language text, or complete fabricated sentences. One documented case: silent audio produced "Legenda Adriana Zanotto" repeated for every 30-second interval.

**Why it happens:** Whisper processes audio in 30-second chunks. When a chunk has no speech, the model still tries to generate text. It gets stuck in loops or produces training-data artifacts.

**Consequences:** Claude receives fabricated text, analyzes it seriously, and presents corrections for sentences the user never said. This is confusing and erodes trust in the entire system.

**Prevention:**
- Preprocess audio before sending to Whisper: trim silence from start/end, and detect silent segments.
- Use ffmpeg's `silenceremove` filter or a Voice Activity Detection (VAD) library to strip silence.
- On the backend, if the Whisper response contains suspicious patterns (repeated phrases, very short segments with lots of text, non-English text), flag or discard them.
- Set a minimum audio duration threshold -- don't send recordings under 2-3 seconds.
- Consider using Whisper's `timestamp_granularities` parameter to get word-level timestamps, which helps identify hallucinated segments (they often have unusual timing patterns).

**Detection:** Record 5 seconds of silence and send it through the pipeline. If you get text back, you have a hallucination problem.

**Phase:** Phase 1 -- must be handled in the core recording/upload pipeline.

**Confidence:** HIGH -- extensively documented in OpenAI GitHub (discussions #679, #1606), community forums, and academic research.

---

### Pitfall 5: The 25MB Whisper API File Size Limit

**What goes wrong:** The Whisper API has a hard 25MB file size limit. With expo-audio's HIGH_QUALITY preset (AAC, 128kbps, stereo), a recording generates roughly 1MB per minute. That gives ~25 minutes per upload. But if the recording codec produces larger files (WAV, or if Android uses a different format), a 3-minute recording could hit the limit. The LOW_QUALITY preset on Android has a documented bug producing 10MB per minute recordings.

**Why it happens:** Whisper API enforces this server-side. There is no way around it except splitting files or compressing before upload.

**Consequences:** Long recordings fail silently or with an opaque API error. Users record a 30-minute practice session and get nothing back.

**Prevention:**
- Always use AAC encoding in an M4A container (the HIGH_QUALITY preset default). This gives ~1MB/min, allowing ~25 minutes per recording.
- Implement file size checking before upload. If over 20MB (leaving margin), split the audio into chunks.
- Use ffmpeg or a backend audio processing library to split and rejoin audio at silence boundaries if needed.
- For the MVP, consider capping recording length at 10 minutes and showing a clear indicator. The PROJECT.md target is 3-minute recordings with under 15-second processing, so this may not be an immediate issue.
- Test on both iOS AND Android -- they use different codecs and the file sizes differ.

**Detection:** Record 5 minutes on each platform. Check actual file sizes. If Android produces unexpectedly large files, the codec configuration needs adjustment.

**Phase:** Phase 1 -- part of the recording implementation.

**Confidence:** HIGH -- confirmed by OpenAI documentation, Expo GitHub issues (#24257), and community reports.

---

## Moderate Pitfalls

### Pitfall 6: expo-audio Android vs iOS Recording Format Incompatibility

**What goes wrong:** expo-audio's HIGH_QUALITY preset produces M4A (AAC) on both platforms, but LOW_QUALITY defaults to .3gp with AMR-NB on Android. If you use custom configurations, recorded audio on Android may not play on iOS and vice versa. Even with the same preset, subtle codec differences can cause playback issues.

**Prevention:**
- Stick to the HIGH_QUALITY preset with explicit M4A/AAC configuration on both platforms. Do not use LOW_QUALITY.
- Test recording AND playback on both platforms early.
- Since audio goes to Whisper (which accepts M4A), format consistency is more important for storage/playback than for transcription.
- expo-av is deprecated and being removed in SDK 54. Use expo-audio (the newer library) from the start.

**Phase:** Phase 1 -- foundational recording setup.

**Confidence:** HIGH -- confirmed by Expo documentation and multiple GitHub issues (#11952, #31309).

---

### Pitfall 7: Pipeline Latency Exceeding the 15-Second Target

**What goes wrong:** The PROJECT.md requires "under 15 seconds for a 3-minute recording." The pipeline has three sequential network calls: (1) upload audio to backend, (2) backend sends to Whisper API, (3) backend sends transcription to Claude API. Each step adds latency. Audio upload over mobile networks can be slow. Whisper processing time scales with audio length. Claude analysis adds 2-5 seconds.

**Why it happens:** Three sequential API calls with a file upload over a mobile connection. Typical breakdown for a 3-minute recording:
- Audio upload (3MB over mobile): 1-3 seconds
- Whisper API processing: 5-10 seconds (varies with load)
- Claude API processing: 2-5 seconds
- Total: 8-18 seconds, often exceeding the target.

**Prevention:**
- Start uploading audio to the backend immediately when recording stops -- don't wait for UI transitions.
- Use streaming/chunked upload if the audio file is large.
- On the backend, fire the Whisper request immediately upon receiving the audio. Don't add unnecessary processing steps between upload receipt and Whisper call.
- Consider showing partial results: display transcription first (after Whisper returns), then show corrections when Claude responds. This makes the wait feel shorter even if total time is the same.
- Use Claude's streaming API to show corrections as they arrive rather than waiting for the full response.
- Cache the Claude system prompt (use the system prompt caching feature) to reduce latency on the Claude call.
- Monitor and log each pipeline stage's latency independently so you can identify bottlenecks.

**Detection:** Time each stage independently. If any single stage takes >5 seconds, investigate.

**Phase:** Phase 1 architecture decision, optimized in Phase 2.

**Confidence:** MEDIUM -- latency numbers are estimates based on typical API performance. Actual numbers depend on network conditions and API load.

---

### Pitfall 8: Pattern Analysis Across Sessions Hitting Context Window Limits

**What goes wrong:** The app needs to analyze patterns across accumulated sessions. Naively dumping all session transcriptions + corrections into a single Claude API call will hit token limits quickly. Even with Claude's 200K context window, 50+ sessions of speech data with corrections is a lot of tokens, and the model's attention degrades for information "in the middle" of long contexts (the "lost in the middle" problem).

**Why it happens:** Each session might produce 500-2000 tokens of transcription plus corrections. 50 sessions = 25K-100K tokens just for data, plus the analysis prompt. Quality degrades before you hit the hard limit.

**Prevention:**
- Do NOT send raw transcriptions to pattern analysis. Instead, store a structured summary per session: error types, error counts by category, filler word counts, vocabulary metrics. Send the summaries.
- Use a pre-processing step: for each session, extract a compact "error fingerprint" (e.g., "article errors: 3, verb tense: 2, filler 'like': 15"). Send fingerprints for pattern analysis.
- Implement a sliding window: analyze the last N sessions (e.g., 10-20) rather than all sessions.
- For long-term trend analysis, use database queries (aggregate error counts over time) rather than LLM analysis. Save Claude for qualitative insights on recent sessions.
- Consider a two-tier approach: database-level aggregation for quantitative trends ("your article errors decreased 30% over 2 weeks"), Claude for qualitative analysis of recent sessions ("you consistently confuse 'in' and 'on' with time expressions").

**Detection:** If pattern analysis starts returning generic advice instead of specific patterns, the context is too long and the model is losing focus.

**Phase:** Phase 2 or 3 (after initial sessions are accumulated). Design the data model for this in Phase 1.

**Confidence:** MEDIUM -- the "lost in the middle" problem is well-documented, but the exact session count threshold depends on session length and Claude model used.

---

### Pitfall 9: ASR Errors Cascading Into Grammar Analysis

**What goes wrong:** Whisper mishears a word, the transcription contains the wrong word, and Claude "corrects" it to something the user never said. Example: user says "chemist," Whisper transcribes "I missed," Claude flags a grammar issue. The user sees a correction for a sentence they never spoke. This is different from Pitfall 1 (grammar normalization) -- this is straight-up mishearing, especially common with accented speakers.

**Why it happens:** Whisper's word error rate for non-native English accents is significantly higher than for native speakers. Research shows native American English gets the highest accuracy, with non-native accents performing worse. The errors compound when Claude treats the mistranscription as authoritative.

**Prevention:**
- Show the transcription to the user BEFORE showing corrections. Let them see what Whisper heard. If the transcription is wrong, corrections are meaningless.
- Allow users to edit the transcription before triggering analysis. This is important for V1 validation: it tells you how often Whisper gets it wrong.
- Include a "this doesn't look right" flag on transcriptions so users can report mishearing.
- Use Whisper's `language: "en"` parameter to avoid language detection overhead and improve English accuracy.
- Consider providing the Whisper API `prompt` parameter with domain context about the speaker's likely topics.

**Detection:** Use the app yourself with your accent. Count how many words per session are misheared. If it is more than 1-2 per minute, accuracy is a problem.

**Phase:** Phase 1 -- UI design decision (show transcription first vs corrections first).

**Confidence:** HIGH -- ASR accuracy disparity across accents is well-documented in academic literature (AIP Publishing evaluation of Whisper across accents).

---

### Pitfall 10: Recording Interruptions and Lost Audio

**What goes wrong:** Phone calls, notifications, app backgrounding, or audio session conflicts (e.g., music playing) interrupt the recording without clear user feedback. The recording silently stops, produces a truncated file, or produces silence from the interruption point onward. User finishes a 5-minute speech session but only 2 minutes were captured.

**Why it happens:** Mobile OS audio session management is complex. iOS and Android handle audio interruptions differently. expo-audio requires specific configuration for handling interruptions, and the default behavior may not be what you expect. There are documented issues with expo-audio not properly detecting recording interruptions when the app goes to background (GitHub issue #30792).

**Prevention:**
- Configure the audio session explicitly: set `interruptionMode` appropriately, handle interruption events.
- Show a recording indicator (timer, waveform) so users can see if recording is active.
- When an interruption is detected, save whatever audio was captured and notify the user.
- Disable notifications during recording if possible, or at minimum handle the audio session reconfiguration after an interruption.
- Test recording with: incoming phone call, switching apps, lock screen, notification sounds.

**Detection:** Try recording while triggering a phone call or backgrounding the app. Check if the recording survives.

**Phase:** Phase 1 -- recording implementation.

**Confidence:** MEDIUM -- documented in Expo GitHub issues but behavior may vary by OS version and device.

---

## Minor Pitfalls

### Pitfall 11: Whisper API Cost Accumulation

**What goes wrong:** Whisper API costs $0.006/minute. For personal use, this seems negligible. But if you're testing frequently (10 sessions/day at 3 minutes each), that is ~$0.18/day or ~$5.40/month just for transcription. Add Claude API costs for analysis (varies by prompt length and model), and monthly costs can surprise you.

**Prevention:**
- Log API costs per session in the database. Track spending over time.
- Use shorter test recordings during development.
- Consider local Whisper for development/testing (whisper.cpp or similar) to avoid API costs during prompt iteration.
- For Claude, use prompt caching to reduce costs on the system prompt portion.

**Phase:** Across all phases. Set up cost tracking in Phase 1.

**Confidence:** HIGH -- pricing is publicly documented.

---

### Pitfall 12: Structured JSON Output Parsing Failures from Claude

**What goes wrong:** Claude returns grammar corrections in a format the frontend cannot parse. JSON might be wrapped in markdown code blocks, contain trailing commas, or have inconsistent field names between calls. One malformed response breaks the UI.

**Prevention:**
- Use Claude's structured output / tool-use feature to enforce a JSON schema rather than asking for JSON in the prompt.
- Always validate Claude's response against the expected schema before passing to the frontend.
- Implement a fallback UI for unparseable responses ("Analysis complete but could not be displayed -- raw text: [...]").
- Test with diverse inputs: very short recordings, very long recordings, recordings with no errors, recordings that are all errors.

**Phase:** Phase 1 -- API integration.

**Confidence:** HIGH -- well-known LLM output reliability issue.

---

### Pitfall 13: Database Schema Not Designed for Pattern Analysis

**What goes wrong:** You store sessions with raw transcription and raw Claude response as text blobs. When it is time for pattern analysis, you have no structured data to query. You cannot answer "how many article errors did I make this week?" without re-parsing every stored response.

**Prevention:**
- Design the schema from day one to support pattern analysis. Store structured error data per session: error type, error category, original text, corrected text, filler word counts, session duration, word count.
- Store Claude's structured response (JSON) as a JSONB column in PostgreSQL, enabling SQL queries against error categories.
- Create aggregate views/queries for common pattern analysis needs.
- Do not only store the text blob -- extract and store the structured fields.

**Phase:** Phase 1 -- database design. This is cheap to do right initially and expensive to retrofit.

**Confidence:** HIGH -- standard data modeling advice, directly relevant to the pattern analysis requirement.

---

### Pitfall 14: Expo Development Build vs Expo Go Audio Limitations

**What goes wrong:** expo-audio requires a development build (custom native code). Developers start with Expo Go for convenience, discover audio recording does not work or works differently, and have to switch mid-development. This wastes time and can require project restructuring.

**Prevention:**
- Start with a development build from day one. Do not use Expo Go for this project.
- Run `npx expo prebuild` early and test audio recording on a physical device (not simulator -- simulators have limited microphone support).
- Use EAS Build for development builds if local builds are problematic.

**Phase:** Phase 1 -- project setup.

**Confidence:** MEDIUM -- based on Expo documentation about native module requirements. The exact limitations of expo-audio in Expo Go need verification.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Recording setup (Phase 1) | Android format/codec producing large or incompatible files | Use HIGH_QUALITY preset with explicit AAC/M4A config; test on both platforms day one |
| Whisper integration (Phase 1) | Filler words stripped, grammar auto-corrected | Validate with deliberate test recordings containing fillers and errors BEFORE building analysis features |
| Claude analysis prompt (Phase 1) | Over-correction of spoken English to written standards | Invest heavily in prompt; include negative examples; manual review first 10 sessions |
| Pipeline latency (Phase 1-2) | Exceeding 15-second target for 3-minute recordings | Show transcription immediately, stream corrections; measure each stage independently |
| Pattern analysis (Phase 2-3) | Context window limits, lost-in-the-middle degradation | Store structured error summaries per session; use DB aggregation for trends, Claude for qualitative analysis |
| Session history (Phase 2) | Schema not supporting structured queries | Design for pattern analysis from Phase 1; store parsed error categories, not just text blobs |
| Long recordings (Phase 2) | 25MB Whisper file size limit | Cap recording length or implement chunked upload; test actual file sizes on both platforms |

## Sources

- [Removing automatic grammar correction in Whisper - GitHub Discussion #1631](https://github.com/openai/whisper/discussions/1631)
- [Spoken Grammar Assessment Using LLM - arXiv:2410.01579](https://arxiv.org/html/2410.01579)
- [Whisper hallucination on silent audio - GitHub Discussion #1606](https://github.com/openai/whisper/discussions/1606)
- [How to avoid hallucinations in Whisper - OpenAI Community](https://community.openai.com/t/how-to-avoid-hallucinations-in-whisper-transcriptions/125300)
- [Whisper filler word detection - HuggingFace Discussion](https://huggingface.co/spaces/openai/whisper/discussions/30)
- [CrisperWhisper verbatim transcription - arXiv:2408.16589](https://arxiv.org/html/2408.16589v1)
- [Evaluating Whisper ASR across accents - AIP Publishing](https://pubs.aip.org/asa/jel/article/4/2/025206/3267247/Evaluating-OpenAI-s-Whisper-ASR-Performance)
- [expo-audio documentation](https://docs.expo.dev/versions/latest/sdk/audio/)
- [expo-av LOW_QUALITY 10MB/min bug - GitHub Issue #24257](https://github.com/expo/expo/issues/24257)
- [expo-av cross-platform audio format issues - GitHub Issue #11952](https://github.com/expo/expo/issues/11952)
- [Audio recording interruption detection - GitHub Issue #30792](https://github.com/expo/expo/issues/30792)
- [Whisper API file size limit - OpenAI Community](https://community.openai.com/t/whisper-api-increase-file-limit-25-mb/566754)
- [Whisper prompting guide - OpenAI Cookbook](https://cookbook.openai.com/examples/whisper_prompting_guide)
- [LLM grammar correction overcorrection challenges](https://palospublishing.com/using-llms-to-detect-and-correct-grammar-mistakes/)
- [Context window management for LLM apps](https://redis.io/blog/context-window-management-llm-apps-developer-guide/)
- [expo-audio vs expo-av migration - GitHub Issue #38061](https://github.com/expo/expo/issues/38061)
- [expo-av deprecation and removal in SDK 54 - GitHub Issue #37259](https://github.com/expo/expo/issues/37259)
