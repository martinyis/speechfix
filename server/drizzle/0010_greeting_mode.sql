ALTER TABLE "agent_greetings" ADD COLUMN "mode" varchar(50) NOT NULL DEFAULT 'conversation';
CREATE UNIQUE INDEX "ux_greeting_user_agent_mode" ON "agent_greetings" ("user_id", COALESCE("agent_id", 0), "mode");
