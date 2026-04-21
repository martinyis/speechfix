import { FastifyInstance } from 'fastify';
import { VoiceSession } from '../voice/session-manager.js';
import { resolveHandler, type SystemAgentMode } from '../voice/handlers/index.js';
import type { AgentConfig } from '../voice/handlers/types.js';
import { db } from '../db/index.js';
import { agents } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { buildFillerHistoryPrompt } from '../voice/prompts/filler-context.js';
import { selectTopic } from '../modules/filler-coach/topic-selector.js';

export async function voiceSessionRoute(fastify: FastifyInstance) {
  fastify.get('/voice-session', { websocket: true }, async (socket, req) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const agentIdParam = url.searchParams.get('agent');
    const modeParam = url.searchParams.get('mode') as SystemAgentMode | null;

    let agentConfig: AgentConfig | null = null;
    let mode: SystemAgentMode | null = modeParam;

    // Load agent from DB if agent ID provided (but not when a system mode is explicitly set)
    if (agentIdParam && !modeParam) {
      const agentId = Number(agentIdParam);
      const [row] = await db.select().from(agents)
        .where(and(
          eq(agents.id, agentId),
          eq(agents.userId, req.user.userId),
        ));

      if (!row) {
        socket.close(4004, 'Agent not found');
        return;
      }

      agentConfig = {
        id: row.id,
        type: row.type,
        agentMode: row.agentMode,
        name: row.name,
        systemPrompt: row.systemPrompt,
        behaviorPrompt: row.behaviorPrompt,
        voiceId: row.voiceId,
        settings: (row.settings as Record<string, unknown>) ?? {},
      };
      mode = null;
    }

    const formContextParam = url.searchParams.get('formContext');
    let formContext: Record<string, unknown> | null = null;
    if (formContextParam) {
      try {
        formContext = JSON.parse(formContextParam);
      } catch {
        // ignore invalid JSON
      }
    }

    // Pre-fetch filler history for filler-coach mode
    if (mode === 'filler-coach') {
      const fillerHistory = await buildFillerHistoryPrompt(req.user.userId);
      formContext = formContext ?? {};
      formContext.fillerHistory = fillerHistory;
      // Default target words if not provided by client
      if (!formContext.targetWords) {
        formContext.targetWords = 'um, uh, like, you know';
      }
      // Select cognitive pressure topic
      const topicSelection = await selectTopic(req.user.userId);
      formContext.topicDirective = topicSelection.directive;
      formContext.topicSlug = topicSelection.topicSlug;
      formContext.cognitiveLevel = topicSelection.level;
    }

    const handler = resolveHandler(mode, agentConfig);
    const session = new VoiceSession(socket, req.user.userId, handler, agentConfig, mode, formContext);

    fastify.log.info(`[voice-ws] New connection, session ${session.sessionId}, agent=${agentConfig?.name ?? 'system'}, mode=${mode ?? 'default'}`);

    socket.on('message', (raw) => {
      try {
        const message = JSON.parse(raw.toString());

        switch (message.type) {
          case 'start':
            session.start();
            break;
          case 'audio':
            session.handleAudio(message.data);
            break;
          case 'interrupt':
            session.handleInterrupt();
            break;
          case 'done':
            session.handleDone();
            break;
          case 'mute':
            session.handleMute();
            break;
          case 'unmute':
            session.handleUnmute();
            break;
          default:
            fastify.log.warn(`[voice-ws] Unknown message type: ${message.type}`);
        }
      } catch (err) {
        fastify.log.error(`[voice-ws] Error handling message: ${err}`);
      }
    });

    socket.on('close', () => {
      fastify.log.info(`[voice-ws] Connection closed, session ${session.sessionId}`);
      session.cleanup();
    });

    socket.on('error', (err) => {
      fastify.log.error(`[voice-ws] Socket error: ${err}`);
      session.cleanup();
    });
  });
}
