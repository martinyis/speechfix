# Reflexa — Speech Problems Catalog

**Purpose**: Complete catalog of speech problems the app can detect and help fix. Each entry includes detection method, practice approaches, and how it fits into the app architecture. This document serves as the design foundation for the analysis engine, pattern worker, and practice task system.

---

## How This App Works (Architecture Overview)

### Three-Layer System

```
LAYER 1: COLLECTION
  Voice sessions with AI agents → raw speech transcripts

LAYER 2: ANALYSIS (two speeds)
  Per-Session Analysis (immediate, after each session):
    - Grammar errors, naturalness issues, filler words
    - Single-session insights (hedging, repetitive words, discourse habits)
    - Clarity score, correction cards

  Cross-Session Pattern Worker (runs after session, analyzes all sessions):
    - Recurring correction types across sessions
    - Vocabulary range / overused words
    - Crutch phrases and verbal tics
    - Hedging trends over time
    - Stalled corrections (not improving despite practice)
    - Progress tracking (what's getting better, what's not)

LAYER 3: PRACTICE (AI-prescribed, not user-selected)
  The system identifies what the user needs to work on.
  Practice tasks are generated from actual speech data.
  Only relevant task types are surfaced to each user.
  User can also request focus on specific areas.
```

### Detection Types

- **S** = Single-session detectable (can flag from one transcript)
- **X** = Cross-session required (needs pattern analysis across 5+ sessions)
- **S+X** = Detectable in single session but significantly better with cross-session data

### Severity Levels

- **Critical** = Directly blocks career advancement, immediately noticeable
- **High** = Significantly impacts professional perception
- **Medium** = Noticeable, contributes to "sounds non-native" or "sounds unprofessional"
- **Low** = Polish issue, separates good from excellent communicators

---

## PART 1: NON-NATIVE SPEAKER PROBLEMS

### Category A: Grammar Errors

---

#### A1. Article Misuse (a / an / the / zero article)

**Detection**: S | **Severity**: High | **Affects**: Speakers from Chinese, Japanese, Korean, Russian, Hindi, Slavic, Arabic backgrounds

**What it is**: Missing, extra, or wrong articles. Research shows article errors occur in ~1 out of every 8 noun phrases. Core problem is knowing *when* an article is needed, not *which* one.

**Examples**:
- "I had meeting with client yesterday" → "I had **a** meeting with **a** client yesterday"
- "The life is short" → "Life is short"
- "She is best engineer on team" → "She is **the** best engineer on **the** team"

**How to detect**: AI flags noun phrases lacking expected articles or having unnecessary ones by analyzing syntactic context. Look for: bare nouns where context demands determiners, "the" before abstract/generic concepts, missing "a/an" before first-mention singular countable nouns.

**Practice approaches**:
- Focused drills tied to noun type (countable vs uncountable, specific vs generic, first mention vs known)
- Describing scenes and processes with explicit article attention
- Collocational chunks: memorize "at the office," "in a meeting," "on the phone"

**Practice task type**: Say It Right (correction-based), Use It Naturally (scenario-based)

---

#### A2. Preposition Errors

**Detection**: S | **Severity**: High | **Affects**: All non-native speakers (prepositions rarely translate 1:1)

**What it is**: Wrong preposition after verbs, missing prepositions, or unnecessary prepositions. Idiomatic — often no logical rule for why "interested in" is correct but "interested on" is not.

**Examples**:
- "It depends of the situation" → "It depends **on** the situation"
- "I'm interested for this project" → "I'm interested **in** this project"
- "We discussed about the proposal" → "We discussed the proposal"
- "She arrived to the office" → "She arrived **at** the office"

**How to detect**: AI checks verb + preposition combinations against standard collocations. Cross-session reveals which prepositions the user systematically struggles with (often correlates with L1).

**Practice approaches**:
- Learn prepositions in collocational chunks ("depend on," "focus on," "interested in")
- Verb-preposition drills organized by professional vocabulary

**Practice task type**: Say It Right, Use It Naturally

---

#### A3. Verb Tense Confusion

**Detection**: S | **Severity**: High | **Affects**: Especially speakers from languages lacking present perfect (Chinese, Arabic) or using it differently (German, French)

**What it is**: Wrong tense choice, especially present perfect vs simple past, continuous vs simple, tense shifting mid-narrative. "I have finished it yesterday" is the classic example.

**Examples**:
- "I have finished the report yesterday" → "I **finished** the report yesterday"
- "I work here since 2019" → "I **have worked** here since 2019"
- "If we will have time, we will do it" → "If we **have** time, we will do it"
- "He is knowing the answer" → "He **knows** the answer"

**How to detect**: AI looks for temporal markers (yesterday, since, for, already) paired with wrong tenses, stative verbs in continuous form, tense shifts within same narrative, "will" in if-clauses.

**Practice approaches**:
- Timeline exercises distinguishing present perfect from simple past
- "Time signal" awareness: train recognition of words that demand specific tenses
- Narrative retelling with coach tracking tense consistency

**Practice task type**: Say It Right, Use It Naturally

---

#### A4. Subject-Verb Agreement

**Detection**: S | **Severity**: Medium | **Affects**: Speakers from Chinese, Japanese, Malay (no agreement in L1), also fossilized errors in many B2-C1 speakers

**What it is**: Verb doesn't match subject in number. Accounts for ~12% of errors in advanced ESL. Worst with long sentences, collective nouns, "there is/are" constructions.

**Examples**:
- "The list of items are on the table" → "The list of items **is** on the table"
- "Everyone need to submit their reports" → "Everyone **needs** to submit their reports"
- "There is many reasons for this" → "There **are** many reasons for this"

**How to detect**: AI checks subject-verb pairs for number agreement, especially in complex sentences. Signals: third-person singular missing -s, plural verb with singular subject, "there is" + plural noun.

**Practice task type**: Say It Right

---

#### A5. Countable/Uncountable Noun Confusion

**Detection**: S | **Severity**: Medium | **Affects**: Speakers from languages without this distinction (most non-Germanic/Romance languages)

**What it is**: Pluralizing uncountable nouns, wrong determiners/quantifiers. English's countable/uncountable system is arbitrary ("luggage" uncountable, "suitcase" countable).

**Examples**:
- "I need some informations" → "I need some **information**"
- "She gave me good advices" → "She gave me good **advice**"
- "We bought new equipments" → "We bought new **equipment**"

**How to detect**: AI flags pluralized uncountable nouns, "a/an" before uncountable nouns, wrong quantifiers (many + uncountable).

**Practice task type**: Say It Right

---

#### A6. Gerund/Infinitive Confusion

**Detection**: S | **Severity**: Medium | **Affects**: All non-native speakers (arbitrary system)

**What it is**: Wrong form after verbs — "enjoy to do" instead of "enjoy doing." Highly fossilizable because meaning is still conveyed.

**Examples**:
- "I enjoy to work with this team" → "I enjoy **working** with this team"
- "She suggested to postpone the meeting" → "She suggested **postponing** the meeting"
- "I look forward to hear from you" → "I look forward to **hearing** from you"

**How to detect**: AI checks verb + gerund/infinitive patterns against known rules.

**Practice task type**: Say It Right, Use It Naturally

---

#### A7. Conditional Structure Errors

**Detection**: S | **Severity**: Medium | **Affects**: Speakers from German, Dutch, Portuguese, Spanish, Slavic languages

**What it is**: Placing "would" or "will" in the if-clause. Deeply ingrained because many languages use future/conditional in both clauses.

**Examples**:
- "If I would have more time, I would help" → "If I **had** more time, I would help"
- "If we will finish early, we can leave" → "If we **finish** early, we can leave"

**How to detect**: AI looks for "if" + "would"/"will" constructions. Very regular pattern, easy to flag.

**Practice task type**: Say It Right, Use It Naturally

---

### Category B: Naturalness & Idiom Issues

---

#### B1. Unnatural Collocations

**Detection**: S+X | **Severity**: High | **Affects**: All non-native speakers

**What it is**: Word combinations that are grammatically correct but sound wrong. One of the strongest markers of non-native speech. Research shows ~51% error rate in verb-noun collocations for advanced learners.

**Examples**:
- "I need to do a decision" → "I need to **make** a decision"
- "There was a strong rain" → "There was **heavy** rain"
- "I want to make a question" → "I want to **ask** a question"
- "Can you open the light?" → "Can you **turn on** the light?"

**How to detect**: AI compares word combinations against collocation frequency databases. Flags statistically unusual verb+noun and adjective+noun pairings. Cross-session analysis reveals the user's systematic collocation blind spots.

**Practice approaches**:
- Learn word families: "decision" always goes with "make," not "do"
- Collocation replacement drills focused on make/do, get/take, heavy/strong/high

**Practice task type**: Say It Better (show the unnatural collocation, user produces natural version)

---

#### B2. Literal Translation / Calques

**Detection**: S (with L1 knowledge) | **Severity**: Medium-High | **Affects**: All non-native speakers, patterns vary by L1

**What it is**: Word-for-word translations from L1 that produce idiomatically alien phrases. Grammatically correct but instantly reveal the speaker's native language.

**Examples**:
- German: "It doesn't play a role" → "It **doesn't matter**"
- Spanish: "I have 30 years" → "I **am** 30 years old"
- Russian: "I feel myself well" → "I **feel** well"
- Hindi: "I am having a doubt" → "I **have a question**"

**How to detect**: AI flags known calque patterns from major L1 backgrounds (if user's L1 is known from onboarding). Without L1 info, detection is harder because calques are often grammatically correct. Cross-session analysis helps identify recurring patterns.

**Practice approaches**:
- L1-specific calque awareness lists
- "How would a native say this?" reformulation exercises

**Practice task type**: Say It Better

---

#### B3. Register Mismatch (Too Formal / Too Informal)

**Detection**: S | **Severity**: Medium-High | **Affects**: All non-native speakers (vocabulary acquired from mixed sources)

**What it is**: Mixing formality levels inappropriately. Using academic vocabulary in casual speech, or slang in formal contexts. Hallmark of non-native speech: "The aforementioned dude was super helpful."

**Examples**:
- Too formal: "I wish to inform you that the deliverables are forthcoming" (in a Slack message) → "The deliverables are coming soon"
- Mixed register: "The aforementioned dude was super helpful" → pick one register
- Overly stiff: "I would like to request whether you could possibly..." → "Could you..."

**How to detect**: AI flags Latinate/academic vocabulary in casual conversational context, or very informal language where context suggests formality. Signals: "utilize" in casual speech, "kinda" in formal context, register mixing within same utterance.

**Practice approaches**:
- Register awareness training: categorize vocabulary into formal/neutral/informal
- "Same message, three ways" exercises at different formality levels

**Practice task type**: Say It Better (reformulate at appropriate register)

---

#### B4. Phrasal Verb Avoidance

**Detection**: X | **Severity**: Medium | **Affects**: All non-native speakers except Germanic L1

**What it is**: Systematically avoiding phrasal verbs, substituting formal single-word alternatives. "Investigate" instead of "look into," "tolerate" instead of "put up with." Sounds bookish and stiff in conversation.

**Examples**:
- "We need to investigate this issue" → "We need to **look into** this"
- "I cannot tolerate this behavior" → "I can't **put up with** this"
- "The project was terminated" → "The project was **shut down**"

**How to detect**: Cross-session analysis measuring ratio of phrasal verbs to single-word Latinate alternatives against native speaker baselines. Single session may not have enough data.

**Practice approaches**:
- Learn phrasal verbs by professional topic (meetings: bring up, follow up, wrap up)
- "Say it more naturally" exercises replacing formal words

**Practice task type**: Say It Better

---

#### B5. False Friends (Cognate Confusion)

**Detection**: S (with L1 knowledge) | **Severity**: Medium-High | **Affects**: Romance and Germanic language speakers

**What it is**: Words that look/sound similar across languages but mean different things. Delivered with confidence, making them more impactful.

**Examples**:
- "Actually" used as "currently" (French/German/Polish) → "**Currently**, I am working on..."
- "Eventually" used as "possibly" (French/German) → "We could **possibly** postpone..."
- "Sensible" used as "sensitive" (Spanish/French) → "He's very **sensitive** about criticism"
- "Assist" used as "attend" (Spanish/French) → "I will **attend** the meeting"

**How to detect**: AI analyzes context to determine if word usage matches English meaning or a false-friend meaning from speaker's L1. Cross-session confirms systematic misuse.

**Practice task type**: Say It Right (word replacement in context)

---

### Category C: Discourse & Organization

---

#### C1. Burying the Lead / Indirect Organization

**Detection**: S+X | **Severity**: Critical | **Affects**: East Asian, Arabic, Romance language speakers (cultural rhetoric patterns)

**What it is**: Providing extensive context and background before reaching the point. Different cultures organize ideas differently — English professional communication expects conclusion first (deductive), many cultures build to the conclusion (inductive).

**Examples**:
- Indirect: "So I was looking at the data, and there were patterns, and Maria noticed something too, and we compared notes, and basically... sales are down 20%."
- Direct: "Sales are down 20%. Here's what Maria and I found."

**How to detect**: AI analyzes position of key claims/recommendations in speech turns (early = good, late = burying). Measures words-before-point ratio, detects narrative build-up patterns ("First I did X, then I found Y..."), flags delayed action items appearing in final 20% of a turn. Cross-session analysis reveals consistency.

**Practice approaches**:
- BLUF (Bottom Line Up Front) training
- Inverted pyramid: conclusion → evidence → details
- "Elevator pitch" exercises (make your point in 30 seconds)
- PREP framework: Point, Reason, Example, Point

**Practice task type**: Structure It (new task type — user gets a topic, must deliver a BLUF-style response)

---

#### C2. Over-Explanation / Lack of Conciseness

**Detection**: S+X | **Severity**: High | **Affects**: All non-native speakers (compensation for perceived language limitations + cultural elaboration patterns)

**What it is**: Saying the same thing multiple ways, adding unnecessary caveats, providing excessive background. Root causes: uncertainty about being understood, L1 cultures valuing thorough elaboration, compensating for language limitations with more words.

**Examples**:
- "What I mean to say is, basically, the point I'm trying to make, in other words, what I'm getting at is that we should launch sooner." → "We should launch sooner."
- Restating the same point three different ways in one turn

**How to detect**: AI measures ratio of unique information to total words, detects semantic repetition (same idea stated differently), flags reformulation markers ("what I mean is," "in other words," "basically"). Cross-session tracks whether verbosity is improving.

**Practice approaches**:
- "One sentence answer" drills
- Compression exercises: reduce 100-word response to 50 words
- "Headline first" technique: deliver key message, then stop

**Practice task type**: Tighten It (new task type — user sees their verbose response, must re-say it in half the words)

---

#### C3. Discourse Marker Misuse

**Detection**: S | **Severity**: Medium | **Affects**: All non-native speakers

**What it is**: Overusing additive markers ("moreover," "furthermore," "in addition") creating an unnaturally academic tone, while underusing contrastive/causal markers ("however," "as a result"). Also using markers incorrectly ("meanwhile" for contrast instead of simultaneity).

**Examples**:
- Overuse: "Moreover, I want to add that furthermore, in addition..." → "We should also consider..."
- Misuse: "We reduced costs. Meanwhile, profits went up." → "We reduced costs. **As a result**, profits went up."
- Academic in speech: "Furthermore, I would like to posit that..." → "Also, I think..."

**How to detect**: AI counts discourse marker frequency, checks markers against logical function in context, measures ratio of additive to contrastive to causal markers.

**Practice task type**: Say It Better

---

#### C4. Pragmatic Failure (Politeness Miscalibration)

**Detection**: S+X | **Severity**: High | **Affects**: Varies by L1 culture (East Asian → too indirect, Eastern European → too direct)

**What it is**: Being too direct (appearing rude) or too indirect (appearing weak) for the context. Involves how to make requests, disagree, decline, and give feedback. Transfer of L1 politeness strategies creates real interpersonal friction.

**Examples**:
- Too direct: "Send me the report." → "**Could you send** me the report when you get a chance?"
- Too indirect: "I was maybe wondering if perhaps it might be possible..." → "Could you send me the report by Friday?"
- Missing softener: "You're wrong about the timeline." → "I see it differently — I think the timeline might be tighter."

**How to detect**: AI analyzes presence/absence of politeness markers in requests, directness level of disagreements, frequency of apologetic language. Cross-session reveals systematic patterns.

**Practice approaches**:
- Speech act instruction: how to request, refuse, disagree in professional English
- Role-play scenarios with calibrated politeness levels

**Practice task type**: Conversation Drill (mini voice session targeting specific speech acts)

---

### Category D: Vocabulary & Fluency

---

#### D1. Basic/Generic Vocabulary Overuse

**Detection**: S+X | **Severity**: High | **Affects**: All non-native speakers at B2-C1 plateau

**What it is**: Relying on "safe" high-frequency words instead of precise alternatives. Research shows non-native speakers have lower lexical diversity and higher word repetition. "Good," "nice," "thing," "get," "make," "very" dominate.

**Examples**:
- "It was a very good presentation" → "It was a **compelling** presentation"
- "We need to get more customers" → "We need to **acquire** more customers"
- "The thing is we don't have time" → "The **challenge** is we don't have time"

**How to detect**: AI measures type-token ratio (lexical diversity), frequency of generic words vs precise alternatives, vocabulary sophistication scores. Cross-session analysis reveals vocabulary growth or stagnation over time.

**Practice approaches**:
- Vocabulary upgrade exercises: sentence with basic words → find 3 precise alternatives
- "Word banning": avoid "very," "good," "thing" for a week
- Precision upgrade: replace vague words with specific ones

**Practice task type**: Word Swap (show sentence with generic word highlighted, user re-says with better alternative)

---

#### D2. Intensifier Overuse ("very," "really," "so")

**Detection**: S | **Severity**: Medium | **Affects**: All non-native speakers

**What it is**: Overusing basic intensifiers instead of stronger standalone adjectives. "Very very important" instead of "crucial." Reveals vocabulary gap.

**Examples**:
- "This is very very important" → "This is **crucial**"
- "The results were really really good" → "The results were **outstanding**"
- "We had a very big problem" → "We had a **significant** problem"

**How to detect**: AI counts intensifier frequency, identifies "very + adjective" pairs that have single-word alternatives.

**Practice task type**: Word Swap

---

#### D3. Repetitive Sentence Starters

**Detection**: S+X | **Severity**: Low-Medium | **Affects**: All non-native speakers (limited syntactic flexibility)

**What it is**: Starting most sentences the same way — "I think...," "We need to...," "It is..." Creates monotonous, predictable speech.

**Examples**:
- "I think we should start. I think the budget works. I think the team is ready. I think we can launch." → Vary with "The budget works," "Our team is ready," "A launch next month seems feasible."

**How to detect**: AI tracks sentence-opening patterns and diversity. Signals: >40% of sentences starting with same word/phrase.

**Practice task type**: Rephrase It (show monotonous paragraph, user re-delivers with varied starters)

---

#### D4. Passive Voice & Nominalization Overuse

**Detection**: S | **Severity**: Medium | **Affects**: Speakers trained in academic English

**What it is**: Overusing passive voice and nominalizations ("implementation" instead of "implement"). Creates dense, impersonal, bureaucratic speech.

**Examples**:
- "The implementation of the new system was completed by the team" → "The team **implemented** the new system"
- "A decision was made to postpone" → "**We decided** to postpone"

**How to detect**: AI measures passive voice ratio, nominalization density, agent deletion rate.

**Practice task type**: Say It Direct (convert passive/nominalized speech to active)

---

## PART 2: NATIVE SPEAKER PROBLEMS (also affects advanced non-native speakers)

### Category E: Filler Words & Verbal Tics

---

#### E1. Filler Word Overuse

**Detection**: S | **Severity**: High | **Affects**: Everyone

**What it is**: Sounds/words inserted as vocal placeholders. Average speaker uses ~5 fillers per minute. Above 1 per minute begins to erode perceived competence. Each person has a "fingerprint" of preferred fillers.

**Types**:
- Vocal: um, uh, er, ah, hmm
- Word: like, so, well, basically, actually, literally, really, right, okay, totally, honestly
- Phrase: you know, I mean, you know what I mean, sort of, kind of, or something, and stuff

**Examples**:
- "So, um, basically what we found is that, like, the conversion rate is, you know, actually down about, like, fifteen percent." → "The conversion rate dropped fifteen percent."

**How to detect**: AI counts occurrences of each filler, computes rate per 100 words, tracks which fillers are most overused, measures density across session (more fillers when discussing unfamiliar topics?), distinguishes strategic discourse markers from habitual fillers.

**Practice approaches**:
- Replace fillers with deliberate pauses (silence reads as confidence)
- Target one specific filler at a time for graduated elimination
- Self-recording review (hearing your own fillers is the most effective awareness tool)

**Practice task type**: Clean Rephrase (play back filler-heavy sentence, user re-says without fillers)

---

#### E2. Crutch Phrases

**Detection**: S+X | **Severity**: Medium-High | **Affects**: Everyone

**What it is**: Multi-word expressions that become unconscious verbal habits. Unlike simple fillers, they masquerade as meaningful discourse. Everyone develops 2-5 go-to crutch phrases.

**Common examples**: "To be honest," "At the end of the day," "The thing is," "Here's the thing," "Having said that," "For what it's worth," "Does that make sense?", "If that makes sense?"

**Examples**:
- "So, the thing is, at the end of the day, we need to be honest about our runway. To be fair, the numbers don't lie, right?" → "We need to be honest about our runway. The numbers are clear."

**How to detect**: AI builds dictionary of known crutch phrases, counts frequency per session, identifies sentence-initial patterns and tag questions. Cross-session is crucial — a phrase used 2x in one session might be nothing, but 15x across 5 sessions is a crutch.

**Practice approaches**:
- Phrase banning: eliminate your top crutch phrase for one week
- Substitution with silence
- "Why" test: "To be honest" implies everything else was dishonest — when you see they add nothing, dropping them is easier

**Practice task type**: Clean Rephrase, Conversation Drill (practice speaking without the crutch in a mini-conversation)

---

### Category F: Confidence & Authority

---

#### F1. Hedging / Weak Language

**Detection**: S | **Severity**: Critical | **Affects**: Everyone (but non-native speakers compound it with language uncertainty)

**What it is**: Stacking qualifiers that reduce statement strength. "I think maybe we could possibly consider..." The most career-damaging speech pattern. Research shows it correlates with lower performance reviews and reduced leadership opportunities.

**Examples**:
- "I think maybe we should possibly consider sort of shifting our strategy a little bit, but I could be wrong." → "We should shift our strategy toward enterprise. Here's why."
- "I feel like perhaps we might want to kind of rethink the pricing? I'm not sure but it seems like it could maybe be too high." → "Our pricing is too high. Competitors are 20% lower."

**How to detect**: AI counts hedging words per sentence, detects qualifier stacking (3+ hedging elements), measures ratio of assertive vs hedged statements, flags self-undermining disclaimers before substantive points.

**Practice approaches**:
- "Delete and test": remove all qualifiers, read direct version — if it's more accurate to your belief, use it
- Commit to first sentence being a declarative with zero hedges
- Replace "I think" with evidence: "I think the market is shifting" → "The market is shifting — three competitors launched enterprise products this quarter"
- PREP framework forces direct assertion at start

**Practice task type**: Say It Direct (show hedged statement, user delivers it with confidence)

---

#### F2. Apologetic / Self-Undermining Language

**Detection**: S | **Severity**: High | **Affects**: Everyone (women 3-4x more likely)

**What it is**: Prefacing contributions with apologies, disclaimers, or self-diminishing language. "Sorry, but..." "This might be wrong, but..." "I just wanted to..." "Does that make sense?"

**Examples**:
- "Sorry, I don't want to take up time, but I just had a thought — and it might be wrong — but maybe we could look at the data? Sorry, does that make sense?" → "I recommend we analyze the customer data. It could reveal why churn spiked."
- "This is probably a dumb question, but has anyone thought about security?" → "Have we completed a security review?"

**How to detect**: AI counts "sorry" where no offense occurred, tracks minimizing "just," detects self-diminishing preambles, flags permission-seeking closers ("does that make sense?").

**Practice approaches**:
- Delete "sorry" when you've done nothing wrong
- Remove every minimizing "just" — the sentence is always stronger
- Convert "Does that make sense?" to "Let me know if you have questions"

**Practice task type**: Say It Direct

---

#### F3. Non-Committal Language

**Detection**: S+X | **Severity**: High | **Affects**: Everyone

**What it is**: Avoiding definitive positions, concrete commitments, or clear decisions. "I'll try to..." "We'll see..." "It depends..." Without stating a position.

**Examples**:
- "I'll try to get that report done, maybe by end of week, but we'll see." → "I'll deliver the report by Friday at 5pm."
- "There are pros and cons to both, it's complicated, we'll have to see." → "I recommend Approach A. Higher upfront cost but 40% less maintenance long-term."

**How to detect**: AI tracks conditional verbs ("try," "might," "maybe"), detects responses to direct questions that contain no commitment, identifies position avoidance ("on the other hand" without arriving at a recommendation), flags timeline vagueness ("soon," "at some point").

**Practice task type**: Say It Direct

---

### Category G: Structure & Clarity

---

#### G1. Rambling / Lack of Conciseness

**Detection**: S | **Severity**: Critical | **Affects**: Everyone

**What it is**: Long, winding explanations without clear structure, burying the message under context and tangents. Signals lack of clarity of thought. "When you ramble, people question whether you've thought through the issue."

**Examples**:
- "So I was looking at the data from last quarter, and it was interesting because the quarter before that had a pattern, and I spoke with marketing and they agreed it was concerning, though there were external factors, but anyway, I think we should increase ad spend." → "We should increase ad spend by 20%. Last quarter's data shows declining ROI from underspending."

**How to detect**: AI measures words-to-point ratio (how many words before main assertion), information density (meaningful words vs total), detects tangent patterns, circular references (same concept restated), excessive scene-setting.

**Practice approaches**:
- BLUF: state conclusion in first sentence
- "One breath" test: if you can't say your key message in one breath, it's too long
- "30-second rule": deliver core message in 30 seconds, then expand
- Sentence count limit: practice answering in 3 sentences (Point. Evidence. Implication.)

**Practice task type**: Tighten It, Structure It

---

#### G2. Vague / Imprecise Language

**Detection**: S | **Severity**: Medium-High | **Affects**: Everyone

**What it is**: Using non-specific words where precision would serve better. "Stuff," "things," "a lot," "some," "interesting," "deal with it." Leads to misunderstandings and wasted time.

**Examples**:
- "There are some issues with the thing we're working on, and we need to deal with a bunch of stuff before next week." → "There are three bugs in the checkout flow we need to fix before the Thursday launch."
- "The results were interesting. A lot of people said various things." → "78% of respondents rated the feature as 'hard to use.'"

**How to detect**: AI tracks vague word frequency, calculates precision score (specific vs generic language ratio), detects unquantified claims ("a lot" instead of numbers), flags vague action items ("look into it").

**Practice task type**: Sharpen It (new task type — show vague statement from user's speech, user re-says with precision)

---

#### G3. Negative Framing Bias

**Detection**: X | **Severity**: Medium-High | **Affects**: Everyone (habitual pattern)

**What it is**: Consistently presenting information as problems/losses/limitations rather than opportunities/solutions. "The problem is we can't..." instead of "Here's what we can do..."

**Examples**:
- "The problem is we don't have enough budget and we can't hire who we need." → "We're working with a tight budget, so I've identified the three highest-impact hires to get us back on track."

**How to detect**: Cross-session analysis counting negative vs positive framing markers ("can't/won't/don't" vs "can/will/should"), detecting problem statements not followed by solutions. Need multiple sessions to distinguish negative situation from negative communicator.

**Practice task type**: Reframe It (new task type — show negative-framed statement, user delivers solution-framed version)

---

#### G4. Passive Voice / Accountability Avoidance

**Detection**: S | **Severity**: Medium | **Affects**: Everyone (especially in problem discussions)

**What it is**: Removing the agent from statements to avoid accountability. "Mistakes were made" vs "I made a mistake." "The deadline was missed" vs "We missed the deadline."

**Examples**:
- "The quarterly targets were not met and the strategy was not executed as planned." → "We didn't meet quarterly targets. I underestimated the time needed for the migration."

**How to detect**: AI identifies passive constructions (forms of "to be" + past participle without agent), calculates passive voice ratio, flags agentless passives in contexts where ownership matters.

**Practice task type**: Say It Direct

---

#### G5. Poor Discourse Coherence / Missing Transitions

**Detection**: S+X | **Severity**: Medium | **Affects**: Everyone

**What it is**: Jumping between ideas without signaling relationships. Missing "however," "therefore," "as a result." Listener must do cognitive work of connecting ideas.

**Examples**:
- "Revenue is down 10%. The engineering team shipped three features. We need more salespeople. The competitor launched." → "Revenue is down 10%, driven by two factors. First, our competitor launched a product taking market share. Second, our sales team is understaffed. On the positive side, engineering shipped three features that position us to win back share."

**How to detect**: AI measures transition/connective word frequency, detects topic shifts without transition language, analyzes semantic coherence between adjacent sentences.

**Practice task type**: Structure It

---

### Category H: Professional Vocabulary

---

#### H1. Jargon Overuse

**Detection**: S | **Severity**: Medium | **Affects**: Everyone in corporate environments

**What it is**: Hiding behind buzzwords and corporate-speak. "Leverage core competencies to drive synergies across the ecosystem." Research: 60% of Gen Z and 65% of millennials want less jargon. People more receptive to jargon actually scored lower on analytic thinking tests.

**Examples**:
- "We need to leverage our core competencies to optimize the value proposition and drive synergies." → "We should use our strengths to improve the product and find efficiencies."

**How to detect**: AI maintains buzzword dictionary, calculates jargon density per 100 words, detects jargon stacking (3+ buzzwords in one sentence).

**Practice task type**: Say It Plain (new task type — show jargon-heavy statement, user re-says in plain language)

---

## PRACTICE TASK TYPES (Complete Library)

### Existing (Built)

| Task Type | Targets | How It Works |
|-----------|---------|-------------|
| **Say It Right** | Grammar errors (A1-A7) | User sees their error, must figure out the correction and speak it. Never shown the answer first |
| **Use It Naturally** | Grammar errors (A1-A7) | User sees the correction, gets a scenario, must respond using the corrected pattern |

### To Build (Tier 1 — for launch)

| Task Type | Targets | How It Works |
|-----------|---------|-------------|
| **Say It Better** | Naturalness (B1-B5), Register (B3) | User sees their grammatically-correct-but-unnatural sentence. Must produce a more natural version. Different muscle than fixing errors |
| **Clean Rephrase** | Fillers (E1), Crutch phrases (E2) | User sees/hears their filler-heavy sentence. Must re-say it cleanly without fillers. Builds pause-instead-of-filler habit |
| **Say It Direct** | Hedging (F1), Apologetic (F2), Non-committal (F3), Passive (G4) | User sees their hedged/weak statement. Must deliver it with confidence and directness |

### To Build (Tier 2 — post-launch, requires pattern worker)

| Task Type | Targets | How It Works |
|-----------|---------|-------------|
| **Word Swap** | Vocabulary (D1, D2), Overused words (pattern-detected) | User sees sentence with overused/generic word highlighted. Must re-say with a better alternative. AI provides 2-3 alternatives after attempt |
| **Conversation Drill** | Crutch phrases (E2), Pragmatics (C4), any pattern | Mini 2-3 turn voice conversation engineered to require speaking without the problematic pattern. Uses existing voice session infrastructure |
| **Structure It** | Burying lead (C1), Rambling (G1), Transitions (G5) | User gets a topic/question. Must deliver a BLUF-style structured response. AI evaluates structure, not just grammar |
| **Tighten It** | Over-explanation (C2), Rambling (G1) | User sees their verbose response from a session. Must re-deliver it in half the words while keeping the meaning |

### To Build (Tier 3 — later)

| Task Type | Targets | How It Works |
|-----------|---------|-------------|
| **Reframe It** | Negative framing (G3) | User sees their negative-framed statement. Must deliver a solution-oriented version |
| **Sharpen It** | Vague language (G2) | User sees their vague statement. Must re-say with specific, precise language |
| **Say It Plain** | Jargon (H1) | User sees jargon-heavy statement. Must re-say in plain, clear language |
| **Rapid Fire** | Any correction type | Timed drills — 5 prompts in 60 seconds. Speed builds automaticity |
| **Teach It Back** | Any grammar rule | User explains why their original sentence was wrong and what the rule is. Forces metacognition |

---

## DETECTION FRAMEWORK SUMMARY

### Per-Session Analysis (immediate, after each session)

| What | Signal | How |
|------|--------|-----|
| Grammar errors | Syntactic rule violations | Rule-based + AI analysis of noun phrases, verb forms, agreement |
| Naturalness issues | Non-standard collocations, register mismatch | AI comparison against frequency databases |
| Filler words | Word frequency counting | Count per 100 words, cluster detection |
| Hedging density | Qualifier stacking | Count hedge words per sentence, detect stacked qualifiers |
| Apologetic language | Unnecessary "sorry," "just," disclaimers | Pattern matching |
| Sentence structure | Passive voice, nominalizations | Syntactic parsing |
| Information density | Words-to-point ratio | AI analysis of content vs filler |
| Discourse markers | Frequency and correctness | Dictionary matching + logical function check |

### Cross-Session Pattern Worker (runs after session, analyzes N previous sessions)

| What | Signal | Why Cross-Session |
|------|--------|-------------------|
| Overused words | Word frequency 3+ SD above normal | One session might not surface it; "super" 3x in one session = normal, 3x in every session = pattern |
| Crutch phrases | Phrase used in 50%+ of sessions | 2x in one session = nothing, 15x across 5 sessions = crutch |
| Recurring correction types | Same error type across sessions | "Article errors in 8 of 10 sessions" — persistent weakness |
| Vocabulary range | Type-token ratio over time | Single session snapshot vs trend |
| Hedging trends | Getting better or worse? | Requires temporal comparison |
| Stalled corrections | Error types not improving despite practice | Compare early vs recent sessions |
| Topic-specific patterns | Hedging only when discussing finance, fillers spike with unfamiliar topics | Need varied session contexts |
| Progress tracking | What's improving, what's not | The core retention feature |

---

## SEVERITY RANKING (Combined, All Users)

### Critical (build first — highest career impact)
1. Hedging / Weak Language (F1)
2. Rambling / Lack of Conciseness (G1)
3. Burying the Lead (C1)

### High (build for launch)
4. Filler Word Overuse (E1)
5. Article Misuse (A1)
6. Unnatural Collocations (B1)
7. Over-Explanation (C2)
8. Basic Vocabulary Overuse (D1)
9. Apologetic Language (F2)
10. Non-Committal Language (F3)
11. Preposition Errors (A2)
12. Verb Tense Confusion (A3)
13. Pragmatic Failure (C4)

### Medium (build post-launch)
14. Crutch Phrases (E2)
15. Register Mismatch (B3)
16. Literal Translation (B2)
17. False Friends (B5)
18. Vague Language (G2)
19. Negative Framing (G3)
20. Subject-Verb Agreement (A4)
21. Conditional Errors (A7)
22. Gerund/Infinitive Confusion (A6)
23. Countable/Uncountable (A5)
24. Passive Voice Overuse (G4)
25. Discourse Marker Misuse (C3)
26. Intensifier Overuse (D2)
27. Jargon Overuse (H1)
28. Word Order (from research)
29. Verbosity/Redundancy (from research)

### Low (polish features)
30. Phrasal Verb Avoidance (B4)
31. Monotonous Sentence Structure (from research)
32. Repetitive Sentence Starters (D3)
33. Poor Discourse Coherence (G5)

---

## WHAT WE ALREADY DETECT vs WHAT NEEDS BUILDING

### Already detected by current analysis engine (analysis.ts)
- Grammar errors: articles, verb_tense, preposition, word_order, subject_verb_agreement, plural_singular, word_choice, sentence_structure, missing_word, collocation, redundancy, other
- Naturalness: naturalness, register, fluency
- Hedging: hedging (as correction type)
- Filler words: full tracking with counts and positions
- Session insights: repetitive_word, hedging_pattern, discourse_pattern

### Needs new detection (per-session enhancements)
- Apologetic/self-undermining language patterns
- Qualifier stacking (hedge density per sentence)
- Information density / words-to-point ratio
- Passive voice ratio
- Sentence starter variety
- Assertive vs hedged statement ratio
- Vague language frequency

### Needs cross-session pattern worker (new system)
- Recurring correction types across sessions
- Overused words (the "super" problem)
- Crutch phrase identification
- Vocabulary range tracking (lexical diversity over time)
- Hedging trends over time
- Stalled corrections
- Topic-specific pattern detection
- Progress tracking for all metrics

---

## ONBOARDING: USER FOCUS PREFERENCES

During onboarding (or accessible from settings), user can optionally indicate focus areas. This biases (but doesn't limit) what gets surfaced:

- "I want to fix my grammar mistakes" → Prioritize Categories A corrections
- "I want to sound more natural" → Prioritize Categories B, D corrections
- "I want to reduce filler words" → Prioritize Category E
- "I want to speak with more confidence" → Prioritize Category F
- "I want to be more concise and structured" → Prioritize Categories C, G

Even without user preference, the AI identifies what matters most from the data and surfaces accordingly.
