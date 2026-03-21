import { pgTable, serial, text, integer, jsonb, timestamp } from 'drizzle-orm/pg-core';

export const sessions = pgTable('sessions', {
  id: serial('id').primaryKey(),
  type: text('type').notNull().default('recording'),
  status: text('status').notNull().default('completed'),
  transcription: text('transcription').notNull(),
  durationSeconds: integer('duration_seconds').notNull(),
  analysis: jsonb('analysis'),
  conversationTranscript: jsonb('conversation_transcript'),
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
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const fillerWords = pgTable('filler_words', {
  id: serial('id').primaryKey(),
  sessionId: integer('session_id').references(() => sessions.id, { onDelete: 'cascade' }).notNull(),
  word: text('word').notNull(),
  count: integer('count').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
