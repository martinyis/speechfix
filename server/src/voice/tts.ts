import WebSocket from 'ws';
import { TTS_MODEL } from './voice-config.js';

export interface TTSCallbacks {
  onAudio: (base64Chunk: string) => void;
  onDone: () => void;
  onError: (error: Error) => void;
}

export class CartesiaTTS {
  private ws: WebSocket | null = null;
  private callbacks: TTSCallbacks;
  private apiKey: string;
  private voiceId: string;
  private currentContextId: string = '';
  private activeContextId: string = '';

  private audioChunkCount = 0;
  private lastAudioChunkTime = 0;
  private flushed = false;
  private completionResolve: (() => void) | null = null;
  private silenceCheckInterval: NodeJS.Timeout | null = null;

  constructor(apiKey: string, voiceId: string, callbacks: TTSCallbacks) {
    this.apiKey = apiKey;
    this.voiceId = voiceId;
    this.callbacks = callbacks;
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const params = new URLSearchParams({
        api_key: this.apiKey,
        cartesia_version: '2025-04-16',
      });

      const url = `wss://api.cartesia.ai/tts/websocket?${params.toString()}`;

      this.ws = new WebSocket(url);

      this.ws.on('open', () => {
        console.log('[tts] Connected to Cartesia');
        resolve();
      });

      this.ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleMessage(message);
        } catch (err) {
          console.error('[tts] Failed to parse message:', err);
        }
      });

      this.ws.on('error', (err) => {
        console.error('[tts] WebSocket error:', err);
        this.callbacks.onError(err instanceof Error ? err : new Error(String(err)));
        reject(err);
      });

      this.ws.on('close', (code, reason) => {
        console.log(`[tts] Connection closed: ${code} ${reason}`);
      });
    });
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  /** Send text to TTS. Returns true if sent, false if connection is dead. */
  sendText(text: string): boolean {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        model_id: TTS_MODEL,
        transcript: text,
        voice: { mode: 'id', id: this.voiceId },
        output_format: {
          container: 'raw',
          encoding: 'pcm_s16le',
          sample_rate: 24000,
        },
        context_id: this.activeContextId,
        continue: true,
        language: 'en',
      }));
      return true;
    }
    return false;
  }

  /**
   * Signal end of input for this generation.
   * Sends continue: false which tells Cartesia to finalize audio for this context.
   */
  flush() {
    this.flushed = true;
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        model_id: TTS_MODEL,
        transcript: '',
        voice: { mode: 'id', id: this.voiceId },
        output_format: {
          container: 'raw',
          encoding: 'pcm_s16le',
          sample_rate: 24000,
        },
        context_id: this.activeContextId,
        continue: false,
        language: 'en',
      }));
    }
    // Start monitoring for audio silence (fallback if done doesn't arrive)
    this.startSilenceCheck();
  }

  /**
   * Wait for TTS generation to complete.
   * Resolves when: done received for this context, OR 2000ms of audio silence after flush, OR timeout.
   * The timeout is a safety net only — normal completion comes from the "done" event or silence detection.
   */
  waitForCompletion(timeoutMs = 30000): Promise<void> {
    return new Promise((resolve) => {
      this.completionResolve = resolve;

      // Safety timeout
      setTimeout(() => {
        if (this.completionResolve === resolve) {
          console.log('[tts] waitForCompletion timed out');
          this.resolveCompletion();
        }
      }, timeoutMs);
    });
  }

  abort() {
    const oldContextId = this.activeContextId;
    // Generate new context to ignore stale audio
    this.currentContextId = crypto.randomUUID();
    this.stopSilenceCheck();

    // Send cancel for the old context
    if (this.ws?.readyState === WebSocket.OPEN && oldContextId) {
      this.ws.send(JSON.stringify({
        context_id: oldContextId,
        cancel: true,
      }));
    }

    if (this.completionResolve) {
      this.completionResolve();
      this.completionResolve = null;
    }
    console.log('[tts] Aborted current generation');
  }

  startTurn(): number {
    this.currentContextId = crypto.randomUUID();
    this.activeContextId = this.currentContextId;
    this.audioChunkCount = 0;
    this.lastAudioChunkTime = 0;
    this.flushed = false;
    this.stopSilenceCheck();
    // Return a numeric turn ID for compatibility with session-manager
    return 0;
  }

  close() {
    this.stopSilenceCheck();
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.close();
    }
    this.ws = null;
  }

  private startSilenceCheck() {
    this.stopSilenceCheck();
    this.silenceCheckInterval = setInterval(() => {
      if (!this.flushed || !this.completionResolve) return;

      // If we received at least one audio chunk and 2000ms has passed since the last one
      if (this.audioChunkCount > 0 && this.lastAudioChunkTime > 0) {
        const silenceMs = Date.now() - this.lastAudioChunkTime;
        if (silenceMs >= 2000) {
          console.log(`[tts] Audio silence detected (${silenceMs}ms), completing turn`);
          this.resolveCompletion();
        }
      }
    }, 100);
  }

  private stopSilenceCheck() {
    if (this.silenceCheckInterval) {
      clearInterval(this.silenceCheckInterval);
      this.silenceCheckInterval = null;
    }
  }

  private resolveCompletion() {
    this.stopSilenceCheck();
    if (this.completionResolve) {
      this.completionResolve();
      this.completionResolve = null;
    }
  }

  private handleMessage(message: any) {
    // Only process messages for the active context
    if (message.context_id && message.context_id !== this.activeContextId) {
      return;
    }

    if (message.type === 'chunk' && message.data) {
      this.audioChunkCount++;
      this.lastAudioChunkTime = Date.now();

      if (this.audioChunkCount <= 3) {
        console.log(`[tts] Received audio chunk #${this.audioChunkCount}, context=${this.activeContextId.slice(0, 8)}, len=${message.data.length}`);
      }

      this.callbacks.onAudio(message.data);
    }

    if (message.type === 'done') {
      console.log(`[tts] Received done, total audio chunks: ${this.audioChunkCount}`);
      this.callbacks.onDone();
      this.resolveCompletion();
    }

    if (message.type === 'error') {
      console.error(`[tts] Cartesia error:`, message.error || message);
      this.callbacks.onError(new Error(message.error || 'Cartesia TTS error'));
    }
  }
}
