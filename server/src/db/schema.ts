import { pgTable, serial, text, integer, jsonb, timestamp, varchar, boolean } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: varchar('name', { length: 255 }),
  displayName: varchar('display_name', { length: 255 }),
  context: text('context'),
  goals: jsonb('goals'),
  contextNotes: jsonb('context_notes').default([]),
  onboardingComplete: boolean('onboarding_complete').default(false).notNull(),
  analysisFlags: jsonb('analysis_flags').default({ grammar: true, fillers: true, patterns: true }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const agents = pgTable('agents', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  type: text('type').notNull().default('conversation'),
  name: varchar('name', { length: 255 }).notNull(),
  systemPrompt: text('system_prompt').notNull(),
  behaviorPrompt: text('behavior_prompt'),
  voiceId: varchar('voice_id', { length: 255 }),
  settings: jsonb('settings').default({}).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const sessions = pgTable('sessions', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  agentId: integer('agent_id').references(() => agents.id, { onDelete: 'set null' }),
  type: text('type').notNull().default('recording'),
  status: text('status').notNull().default('completed'),
  transcription: text('transcription').notNull(),
  durationSeconds: integer('duration_seconds').notNull(),
  analysis: jsonb('analysis'),
  conversationTranscript: jsonb('conversation_transcript'),
  title: varchar('title', { length: 255 }),
  description: text('description'),
  topicCategory: varchar('topic_category', { length: 50 }),
  clarityScore: integer('clarity_score'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const corrections = pgTable('corrections', {
  id: serial('id').primaryKey(),
  sessionId: integer('session_id').references(() => sessions.id, { onDelete: 'cascade' }).notNull(),
  originalText: text('original_text').notNull(),
  correctedText: text('corrected_text').notNull(),
  explanation: text('explanation'),
  correctionType: text('correction_type').notNull(),
  sentenceIndex: integer('sentence_index').notNull().default(0),
  severity: text('severity').notNull().default('error'),
  contextSnippet: text('context_snippet'),
  scenario: text('scenario'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const fillerWords = pgTable('filler_words', {
  id: serial('id').primaryKey(),
  sessionId: integer('session_id').references(() => sessions.id, { onDelete: 'cascade' }).notNull(),
  word: text('word').notNull(),
  count: integer('count').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const agentGreetings = pgTable('agent_greetings', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  agentId: integer('agent_id').references(() => agents.id, { onDelete: 'cascade' }),
  greetingText: text('greeting_text').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const speechPatterns = pgTable('speech_patterns', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  type: text('type').notNull(),
  identifier: text('identifier'),
  data: jsonb('data').notNull(),
  sessionsAnalyzed: jsonb('sessions_analyzed').default([]).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const practiceAttempts = pgTable('practice_attempts', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  correctionId: integer('correction_id').references(() => corrections.id, { onDelete: 'cascade' }).notNull(),
  mode: text('mode').notNull(),
  passed: boolean('passed').notNull(),
  transcript: text('transcript').notNull(),
  feedback: text('feedback'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
