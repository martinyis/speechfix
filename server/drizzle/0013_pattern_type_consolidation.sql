-- Consolidate pattern types: 7 → 5
-- intensifier_overuse → overused_word
-- hedging_trend → hedging
-- noncommittal_language → hedging

-- Migrate speech_patterns
UPDATE speech_patterns SET type = 'overused_word' WHERE type = 'intensifier_overuse';
UPDATE speech_patterns SET type = 'hedging' WHERE type = 'hedging_trend';
UPDATE speech_patterns SET type = 'hedging' WHERE type = 'noncommittal_language';

-- Migrate pattern_exercises
UPDATE pattern_exercises SET pattern_type = 'overused_word' WHERE pattern_type = 'intensifier_overuse';
UPDATE pattern_exercises SET pattern_type = 'hedging' WHERE pattern_type = 'hedging_trend';
UPDATE pattern_exercises SET pattern_type = 'hedging' WHERE pattern_type = 'noncommittal_language';

-- Remove duplicate hedging patterns per user (keep the one with earliest id)
-- When both hedging_trend and noncommittal_language existed for same user,
-- they're now both 'hedging' with null identifier — keep only one
DELETE FROM speech_patterns sp1
WHERE sp1.type = 'hedging'
  AND sp1.identifier IS NULL
  AND EXISTS (
    SELECT 1 FROM speech_patterns sp2
    WHERE sp2.user_id = sp1.user_id
      AND sp2.type = 'hedging'
      AND sp2.identifier IS NULL
      AND sp2.id < sp1.id
  );
