import WebSocket from 'ws';

export interface TTSCallbacks {
  onAudio: (base64Chunk: string) => void;
  onDone: () => void;
  onError: (error: Error) => void;
}

export class ElevenLabsTTS {
  private ws: WebSocket | null = null;
  private callbacks: TTSCallbacks;
  private apiKey: string;
  private voiceId: string;
  private currentTurnId = 0;
  private activeTurnId = 0;

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
        model_id: 'eleven_multilingual_v2',
        output_format: 'pcm_24000',
        inactivity_timeout: '60',
      });

      const url = `wss://api.elevenlabs.io/v1/text-to-speech/${this.voiceId}/stream-input?${params.toString()}`;

      this.ws = new WebSocket(url);

      this.ws.on('open', () => {
        console.log('[tts] Connected to ElevenLabs');

        // Send initialization message
        this.ws!.send(JSON.stringify({
          text: ' ',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            speed: 1.0,
          },
          generation_config: {
            chunk_length_schedule: [80, 120, 200, 260],
          },
          'xi-api-key': this.apiKey,
        }));

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
        text: text + ' ',
        try_trigger_generation: true,
      }));
      return true;
    }
    return false;
  }

  /**
   * Signal end of input for this generation.
   * Sends EOS (empty text) which tells ElevenLabs to generate remaining audio and send isFinal.
   * The connection will close after this — that's expected.
   */
  flush() {
    this.flushed = true;
    if (this.ws?.readyState === WebSocket.OPEN) {
      // Empty string = end of stream signal for ElevenLabs
      this.ws.send(JSON.stringify({ text: '' }));
    }
    // Start monitoring for audio silence (fallback if isFinal doesn't arrive)
    this.startSilenceCheck();
  }

  /**
   * Wait for TTS generation to complete.
   * Resolves when: isFinal received, OR 500ms of audio silence after flush, OR timeout.
   */
  waitForCompletion(timeoutMs = 5000): Promise<void> {
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
    this.currentTurnId++;
    this.stopSilenceCheck();
    // Send EOS to clear buffer
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ text: '' }));
    }
    if (this.completionResolve) {
      this.completionResolve();
      this.completionResolve = null;
    }
    console.log('[tts] Aborted current generation');
  }

  startTurn(): number {
    this.currentTurnId++;
    this.activeTurnId = this.currentTurnId;
    this.audioChunkCount = 0;
    this.lastAudioChunkTime = 0;
    this.flushed = false;
    this.stopSilenceCheck();
    return this.activeTurnId;
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

      // If we received at least one audio chunk and 500ms has passed since the last one
      if (this.audioChunkCount > 0 && this.lastAudioChunkTime > 0) {
        const silenceMs = Date.now() - this.lastAudioChunkTime;
        if (silenceMs >= 500) {
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
    if (message.audio) {
      this.audioChunkCount++;
      this.lastAudioChunkTime = Date.now();

      if (this.audioChunkCount <= 3) {
        console.log(`[tts] Received audio chunk #${this.audioChunkCount}, active=${this.activeTurnId}, current=${this.currentTurnId}, len=${message.audio.length}`);
      }

      // Only forward audio for the active turn
      if (this.activeTurnId === this.currentTurnId) {
        this.callbacks.onAudio(message.audio);
      }
    }

    if (message.isFinal) {
      console.log(`[tts] Received isFinal, total audio chunks: ${this.audioChunkCount}`);
      if (this.activeTurnId === this.currentTurnId) {
        this.callbacks.onDone();
        this.resolveCompletion();
      }
    }

    if (message.error) {
      console.error(`[tts] ElevenLabs error:`, message);
    }
  }
}
