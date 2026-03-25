import { create } from 'zustand';

interface OnboardingStore {
  displayName: string | null;
  speechObservation: string | null;
  setOnboardingResult: (displayName: string | null, speechObservation: string | null) => void;
  reset: () => void;
}

export const useOnboardingStore = create<OnboardingStore>((set) => ({
  displayName: null,
  speechObservation: null,
  setOnboardingResult: (displayName, speechObservation) => set({ displayName, speechObservation }),
  reset: () => set({ displayName: null, speechObservation: null }),
}));
