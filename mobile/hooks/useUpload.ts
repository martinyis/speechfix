import { useMutation } from '@tanstack/react-query';
import { API_BASE_URL } from '../lib/api';

export function useUpload() {
  return useMutation({
    mutationFn: async ({
      audioUri,
      duration,
    }: {
      audioUri: string;
      duration: number;
    }) => {
      const formData = new FormData();
      formData.append('audio', {
        uri: audioUri,
        type: 'audio/m4a',
        name: 'recording.m4a',
      } as any);
      formData.append('duration', String(Math.round(duration)));

      const response = await fetch(`${API_BASE_URL}/sessions`, {
        method: 'POST',
        body: formData,
        // Do NOT set Content-Type header -- FormData sets it with boundary automatically
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Upload failed: ${error}`);
      }

      return response.json();
    },
  });
}
