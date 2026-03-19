export interface TranscriptionResult {
  sessionId: number;
  transcription: string;
  sentences: string[];
  durationSeconds: number;
  createdAt: string;
}

export interface Session {
  id: number;
  transcription: string;
  durationSeconds: number;
  analysis: unknown | null;
  createdAt: string;
}
