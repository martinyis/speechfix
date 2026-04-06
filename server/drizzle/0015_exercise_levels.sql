-- Add level and order_index columns to pattern_exercises
ALTER TABLE pattern_exercises
  ADD COLUMN level integer NOT NULL DEFAULT 1,
  ADD COLUMN order_index integer NOT NULL DEFAULT 0;
