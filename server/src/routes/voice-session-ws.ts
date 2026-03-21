import { FastifyInstance } from 'fastify';
import { VoiceSession } from '../voice/session-manager.js';

export async function voiceSessionRoute(fastify: FastifyInstance) {
  fastify.get('/voice-session', { websocket: true }, (socket, req) => {
    const session = new VoiceSession(socket);
    fastify.log.info(`[voice-ws] New connection, session ${session.sessionId}`);

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
