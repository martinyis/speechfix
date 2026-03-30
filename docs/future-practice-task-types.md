# Future Practice Task Types

Ideas for practice task types beyond the MVP ("Say It Right" + "Use It Naturally").
All voice-based — always force the user to speak.

## Conversation Drill

Short 2-3 turn voice conversation engineered to require the specific pattern the user keeps getting wrong. AI steers the conversation so the user naturally has to use the problematic construction.

**Example:** User misuses prepositions with time expressions. The coach asks: "Tell me about your daily routine — when do you wake up, what do you do in the morning, at lunch..." — forcing preposition+time usage.

**Why it's powerful:** Practice in context, not isolation. Closest to real speech. Scoped (2-3 turns, not open-ended). Uses existing voice session infrastructure.

**Engineering cost:** Medium-high. It's a mini voice session — needs WebSocket, TTS, multi-turn. But the infrastructure already exists.

## Teach It Back

User has to explain out loud, in English, why the original sentence was wrong and what the rule is. Forces metacognition + speaking.

**Example:** "You said 'I go to store.' Explain why this needs a correction." User speaks: "In English, you need the article 'the' before specific nouns..."

**Why it's powerful:** Teaching forces deep processing. Combines grammar understanding with speaking practice. Research-backed learning technique.

**Risk:** Might feel academic/boring for some users. Best suited for advanced learners who want to understand the "why."

## Say It Better

User sees a sentence that's grammatically correct but sounds non-native (severity: `improvement` or `polish`). They have to say a more natural version.

**Example:** "I am having a big interest in this topic" → User should say something like "I'm really interested in this topic."

**Why it's powerful:** Targets improvement/polish corrections specifically. Different muscle than fixing errors — it's about sounding natural, not just correct. Good for intermediate+ users.

## Rapid Fire

AI gives quick prompts in succession and user has to respond using the correct pattern quickly. Speed builds automaticity. Timer-based, 5 prompts in 60 seconds.

**Example (articles):** "Describe: cat" → "The cat is sleeping." "Describe: office" → "I work in an office." Rapid pace forces pattern internalization.

**Why it's powerful:** Speed drills build automatic/unconscious usage. Gamification-friendly (beat your time). Fun, high-energy.

**Engineering cost:** Higher — needs rapid prompt generation, continuous recording, real-time evaluation between prompts.

## Fill the Gap (Text-Based, Deferred)

Based on a correction type that appears frequently, generate 3-5 quick sentences with the problematic pattern. User picks the correct version (tap-based, not voice).

**Why deferred:** Feels too Duolingo. Text-based doesn't align with "always speak" philosophy. Could work as a warm-up before voice tasks.
