-- Add reframe exercise columns for Category B patterns (hedging, noncommittal, negative framing)
ALTER TABLE pattern_exercises
  ADD COLUMN highlight_phrases jsonb,
  ADD COLUMN suggested_reframe text;

-- Make target_word nullable (Category B exercises don't have one)
ALTER TABLE pattern_exercises
  ALTER COLUMN target_word DROP NOT NULL;

-- Default alternatives to empty array (Category B exercises don't use alternatives)
ALTER TABLE pattern_exercises
  ALTER COLUMN alternatives SET DEFAULT '[]'::jsonb;
