-- Add last pattern analysis timestamp to users for debouncing
ALTER TABLE users ADD COLUMN last_pattern_analysis_at timestamp;
