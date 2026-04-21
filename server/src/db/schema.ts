import { pgTable, serial, text, integer, jsonb, timestamp, varchar, boolean, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

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
  onboardingAnalysis: jsonb('onboarding_analysis'),
  lastPatternAnalysisAt: timestamp('last_pattern_analysis_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const agents = pgTable('agents', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  type: text('type').notNull().default('conversation'),
  agentMode: text('agent_mode').notNull().default('conversation'),
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
  deepInsights: jsonb('deep_insights'),
  conversationTranscript: jsonb('conversation_transcript'),
  title: varchar('title', { length: 255 }),
  description: text('description'),
  topicCategory: varchar('topic_category', { length: 50 }),
  /**
   * Relative path to the persisted user audio for this session (e.g., "42/1234.ogg").
   * Resolved by AudioStorage. Null while encoding, or for legacy sessions.
   */
  audioPath: text('audio_path'),
  /**
   * Which encoder produced `audio_path`: 'pcm' (legacy server-side 16kHz PCM)
   * or 'hifi' (client-uploaded M4A at 48kHz). 'hifi' takes precedence so the
   * two pipelines can race without overwriting the higher-quality file.
   */
  audioSource: text('audio_source'),
  /**
   * Relative path to the raw client-uploaded M4A (before trim+Opus encode).
   * Kept on disk so the encoder can re-run after a server crash. Cleared after
   * successful encode (or kept for debugging — cheap).
   */
  audioRawPath: text('audio_raw_path'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const corrections = pgTable('corrections', {
  id: serial('id').primaryKey(),
  sessionId: integer('session_id').references(() => sessions.id, { onDelete: 'cascade' }).notNull(),
  originalText: text('original_text').notNull(),
  correctedText: text('corrected_text').notNull(),
  explanation: text('explanation'),
  shortReason: text('short_reason'),
  correctionType: text('correction_type').notNull(),
  sentenceIndex: integer('sentence_index').notNull().default(0),
  severity: text('severity').notNull().default('error'),
  contextSnippet: text('context_snippet'),
  scenario: text('scenario'),
  fullContext: text('full_context'),
  dismissed: boolean('dismissed').default(false),
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
  mode: varchar('mode', { length: 50 }).default('conversation').notNull(),
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
  status: text('status').notNull().default('queued'),
  queuePosition: integer('queue_position'),
  completedAt: timestamp('completed_at'),
  isReturning: boolean('is_returning').notNull().default(false),
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

export const patternExercises = pgTable('pattern_exercises', {
  id: serial('id').primaryKey(),
  patternId: integer('pattern_id').references(() => speechPatterns.id, { onDelete: 'cascade' }).notNull(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  originalSentence: text('original_sentence').notNull(),
  targetWord: text('target_word'),
  patternType: text('pattern_type').notNull(),
  alternatives: jsonb('alternatives').default([]).notNull(),
  highlightPhrases: jsonb('highlight_phrases'),
  suggestedReframe: text('suggested_reframe'),
  level: integer('level').notNull().default(1),
  orderIndex: integer('order_index').notNull().default(0),
  practiced: boolean('practiced').default(false).notNull(),
  practiceCount: integer('practice_count').default(0).notNull(),
  lastPracticedAt: timestamp('last_practiced_at'),
  nextPracticeAt: timestamp('next_practice_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const fillerCoachSessions = pgTable('filler_coach_sessions', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  durationSeconds: integer('duration_seconds').notNull(),
  totalFillerCount: integer('total_filler_count').notNull().default(0),
  fillerData: jsonb('filler_data'),
  cognitiveLevel: integer('cognitive_level'),
  topicSlug: varchar('topic_slug', { length: 50 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const patternPracticeAttempts = pgTable('pattern_practice_attempts', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  exerciseId: integer('exercise_id').references(() => patternExercises.id, { onDelete: 'cascade' }).notNull(),
  passed: boolean('passed').notNull(),
  transcript: text('transcript').notNull(),
  feedback: text('feedback'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const weakSpots = pgTable('weak_spots', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull(),
  correctionType: text('correction_type').notNull(),
  status: text('status', { enum: ['active', 'backlog', 'resolved', 'dismissed'] }).notNull().default('backlog'),
  severity: text('severity', { enum: ['error', 'improvement', 'polish'] }).notNull(),
  srsStage: integer('srs_stage').notNull().default(0),
  nextReviewAt: timestamp('next_review_at'),
  lastDrillAt: timestamp('last_drill_at'),
  isRecurring: boolean('is_recurring').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  uniqueUserTypeActive: uniqueIndex('weak_spots_user_type_active_idx')
    .on(table.userId, table.correctionType)
    .where(sql`status != 'dismissed'`),
}));

export const weakSpotCorrections = pgTable('weak_spot_corrections', {
  id: serial('id').primaryKey(),
  weakSpotId: integer('weak_spot_id').references(() => weakSpots.id, { onDelete: 'cascade' }).notNull(),
  correctionId: integer('correction_id').references(() => corrections.id, { onDelete: 'cascade' }).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const weakSpotExercises = pgTable('weak_spot_exercises', {
  id: serial('id').primaryKey(),
  weakSpotId: integer('weak_spot_id').references(() => weakSpots.id, { onDelete: 'cascade' }).notNull(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  originalText: text('original_text').notNull(),
  correctedText: text('corrected_text').notNull(),
  explanation: text('explanation'),
  orderIndex: integer('order_index').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const weakSpotDrillAttempts = pgTable('weak_spot_drill_attempts', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  weakSpotId: integer('weak_spot_id').references(() => weakSpots.id, { onDelete: 'cascade' }).notNull(),
  correctionId: integer('correction_id').references(() => corrections.id),
  exerciseId: integer('exercise_id').references(() => weakSpotExercises.id),
  passed: boolean('passed').notNull(),
  transcript: text('transcript'),
  feedback: text('feedback'),
  createdAt: timestamp('created_at').defaultNow(),
});
