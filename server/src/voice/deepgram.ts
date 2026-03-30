import WebSocket from 'ws';

export interface TranscriptResult {
  text: string;
  isFinal: boolean;
  speechFinal: boolean;
  confidence: number;
  words: Array<{ word: string; start: number; end: number; confidence: number }>;
}

export interface DeepgramCallbacks {
  onTranscript: (result: TranscriptResult) => void;
  onUtteranceEnd: () => void;
  onError: (error: Error) => void;
  onClose: () => void;
}

export class DeepgramClient {
  private ws: WebSocket | null = null;
  private keepAliveInterval: ReturnType<typeof setInterval> | null = null;
  private callbacks: DeepgramCallbacks;
  private apiKey: string;

  constructor(apiKey: string, callbacks: DeepgramCallbacks) {
    this.apiKey = apiKey;
    this.callbacks = callbacks;
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const params = new URLSearchParams({
        model: 'nova-3',
        encoding: 'linear16',
        sample_rate: '16000',
        channels: '1',
        language: 'en',
        interim_results: 'true',
        utterance_end_ms: '2500',
        endpointing: '800',
        smart_format: 'true',
        filler_words: 'true',
        punctuate: 'true',
      });

      const url = `wss://api.deepgram.com/v1/listen?${params.toString()}`;

      this.ws = new WebSocket(url, {
        headers: { Authorization: `Token ${this.apiKey}` },
      });

      this.ws.on('open', () => {
        console.log('[deepgram] Connected');

        // Keep alive every 8 seconds
        this.keepAliveInterval = setInterval(() => {
          if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ type: 'KeepAlive' }));
          }
        }, 8000);

        resolve();
      });

      this.ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleMessage(message);
        } catch (err) {
          console.error('[deepgram] Failed to parse message:', err);
        }
      });

      this.ws.on('error', (err) => {
        console.error('[deepgram] WebSocket error:', err);
        this.callbacks.onError(err instanceof Error ? err : new Error(String(err)));
        reject(err);
      });

      this.ws.on('close', (code, reason) => {
        console.log(`[deepgram] Connection closed: ${code} ${reason}`);
        this.stopKeepAlive();
        this.callbacks.onClose();
      });
    });
  }

  private sendCount = 0;
  sendAudio(pcmBuffer: Buffer) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.sendCount++;
      this.ws.send(pcmBuffer);
    } else {
      console.warn(`[deepgram] ⚠️ Cannot send audio, ws state=${this.ws?.readyState}`);
    }
  }

  close() {
    this.stopKeepAlive();
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'CloseStream' }));
      this.ws.close();
    }
    this.ws = null;
  }

  private handleMessage(message: any) {
    if (message.type === 'Results') {
      const alt = message.channel?.alternatives?.[0];
      if (!alt) return;

      const transcript = alt.transcript?.trim();
      if (!transcript) return;

      const result: TranscriptResult = {
        text: transcript,
        isFinal: message.is_final === true,
        speechFinal: message.speech_final === true,
        confidence: alt.confidence ?? 0,
        words: alt.words ?? [],
      };

      this.callbacks.onTranscript(result);
    } else if (message.type === 'UtteranceEnd') {
      this.callbacks.onUtteranceEnd();
    }
  }

  private stopKeepAlive() {
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = null;
    }
  }
}
