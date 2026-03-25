import { create } from 'zustand';

interface OnboardingStore {
  displayName: string | null;
  speechObservation: string | null;
  farewellMessage: string | null;
  setOnboardingResult: (displayName: string | null, speechObservation: string | null, farewellMessage: string | null) => void;
  reset: () => void;
}

export const useOnboardingStore = create<OnboardingStore>((set) => ({
  displayName: null,
  speechObservation: null,
  farewellMessage: null,
  setOnboardingResult: (displayName, speechObservation, farewellMessage) => set({ displayName, speechObservation, farewellMessage }),
  reset: () => set({ displayName: null, speechObservation: null, farewellMessage: null }),
}));
