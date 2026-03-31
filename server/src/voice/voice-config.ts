export interface VoiceConfig {
  id: string;          // Cartesia voice UUID
  name: string;
  gender: 'male' | 'female';
  description: string;
}

// Default Reflexa system voice
export const DEFAULT_VOICE_ID = 'f786b574-daa5-4673-aa0c-cbe3e8534c02';

// Available voices for custom agents (real Cartesia voice IDs)
export const AVAILABLE_VOICES: VoiceConfig[] = [
  { id: 'e07c00bc-4134-4eae-9ea4-1a55fb45746b', name: 'Brooke', gender: 'female', description: 'Confident, conversational' },
  { id: '9626c31c-bec5-4cca-baa8-f8ba9e84c8bc', name: 'Jacqueline', gender: 'female', description: 'Reassuring, empathic' },
  { id: 'f9836c6e-a0bd-460e-9d3c-f7299fa60f94', name: 'Caroline', gender: 'female', description: 'Friendly, inviting' },
  { id: 'e8e5fffb-252c-436d-b842-8879b84445b6', name: 'Cathy', gender: 'female', description: 'Nice, casual' },
  { id: '5ee9feff-1265-424a-9d7f-8e4d431a12c7', name: 'Ronald', gender: 'male', description: 'Intense, deep' },
  { id: 'a167e0f3-df7e-4d52-a9c3-f949145efdab', name: 'Blake', gender: 'male', description: 'Energetic, engaging' },
  { id: '79f8b5fb-2cc8-479a-80df-29f7a7cf1a3e', name: 'Theo', gender: 'male', description: 'Steady, confident' },
];

// TTS model to use ('sonic' = Sonic Turbo, 'sonic-3' = higher quality)
export const TTS_MODEL = 'sonic';
