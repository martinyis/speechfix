-- Add queue system columns to speech_patterns
ALTER TABLE speech_patterns
  ADD COLUMN status text NOT NULL DEFAULT 'queued',
  ADD COLUMN queue_position integer,
  ADD COLUMN completed_at timestamp,
  ADD COLUMN is_returning boolean NOT NULL DEFAULT false;

-- Promote the first (oldest) pattern per user to active
UPDATE speech_patterns sp SET status = 'active'
WHERE sp.id = (
  SELECT sp2.id FROM speech_patterns sp2
  WHERE sp2.user_id = sp.user_id
  ORDER BY sp2.id LIMIT 1
);
