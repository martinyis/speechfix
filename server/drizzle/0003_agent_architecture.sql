ALTER TABLE users ADD COLUMN context_notes JSONB DEFAULT '[]';

CREATE TABLE agents (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'conversation',
  name VARCHAR(255) NOT NULL,
  system_prompt TEXT NOT NULL,
  behavior_prompt TEXT,
  voice_id VARCHAR(255),
  settings JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

ALTER TABLE sessions ADD COLUMN agent_id INTEGER REFERENCES agents(id) ON DELETE SET NULL;
