import type { FastifyInstance } from 'fastify';
import type { WebSocket } from 'ws';
import { PressureDrillSession } from './drill-handler.js';
import { DURATION_PRESETS } from './types.js';
import { getScenario } from './scenarios.js';
import type { ScenarioSlug, DurationPreset } from './types.js';

export async function pressureDrillWsRoute(fastify: FastifyInstance) {
  fastify.get('/pressure-drill/session', { websocket: true }, (socket, req) => {
    // Parse setup from query params. Mobile opens the WS with ?scenario=...&duration=...
    const url = new URL(req.url, `http://${req.headers.host}`);
    const scenarioParam = url.searchParams.get('scenario') as ScenarioSlug | null;
    const durationRaw = Number(url.searchParams.get('duration'));

    if (!scenarioParam || !getScenario(scenarioParam)) {
      socket.close(4003, 'Invalid scenarioSlug');
      return;
    }
    if (!DURATION_PRESETS.includes(durationRaw as DurationPreset)) {
      socket.close(4003, 'Invalid durationPreset');
      return;
    }
    const durationPreset = durationRaw as DurationPreset;

    const drill = new PressureDrillSession({
      userId: req.user.userId,
      // @fastify/websocket's socket is a `ws` WebSocket at runtime but the
      // SocketStream wrapper types it differently. Cast keeps the handler typed
      // against the standard ws type.
      socket: socket as unknown as WebSocket,
      scenarioSlug: scenarioParam,
      durationPreset,
    });

    fastify.log.info(
      `[pressure-drill] New session ${drill.id}, scenario=${scenarioParam}, duration=${durationPreset}s, user=${req.user.userId}`,
    );

    // Kick off. Handler does its own error handling; any thrown error closes the socket.
    drill.start().catch((err) => {
      fastify.log.error({ err }, '[pressure-drill] start failed');
      socket.close();
    });

    socket.on('message', (raw: Buffer) => drill.handleMessage(raw.toString()));
    socket.on('close', () => {
      fastify.log.info(`[pressure-drill] Connection closed, session ${drill.id}`);
      drill.cleanup();
    });
    socket.on('error', (err) => {
      fastify.log.error({ err }, '[pressure-drill] socket error');
      drill.cleanup();
    });
  });
}
