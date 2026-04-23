-- Migration 0024: Add onboarding_analysis JSONB column on users.
-- Stores the raw SpeechSignals payload produced by analyzeOnboardingProfile
-- at the end of the onboarding voice session (native-speaker confidence,
-- grammar error count, filler word count, user word count, reasoning, version).
-- Null for users who onboarded before this migration or whose analyzer run
-- returned { ok: false }.
ALTER TABLE "users" ADD COLUMN "onboarding_analysis" jsonb;
