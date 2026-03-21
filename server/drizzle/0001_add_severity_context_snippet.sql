ALTER TABLE corrections ADD COLUMN severity TEXT NOT NULL DEFAULT 'error';
ALTER TABLE corrections ADD COLUMN context_snippet TEXT;
