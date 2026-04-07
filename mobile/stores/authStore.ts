import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL } from '../lib/config';

const TOKEN_KEY = 'auth_token';

interface AnalysisFlags {
  grammar: boolean;
  fillers: boolean;
  patterns: boolean;
}

interface User {
  id: number;
  email: string;
  name: string | null;
  displayName: string | null;
  onboardingComplete: boolean;
  analysisFlags: AnalysisFlags;
}

interface AuthStore {
  token: string | null;
  user: User | null;
  isReady: boolean;
  isSigningUp: boolean;

  setAuth: (token: string, user: User) => Promise<void>;
  clearAuth: () => Promise<void>;
  loadToken: () => Promise<void>;
  setOnboardingComplete: () => void;
  setSigningUp: (value: boolean) => void;
  updateAnalysisFlags: (flags: Partial<AnalysisFlags>) => Promise<void>;
}

export const useAuthStore = create<AuthStore>((set) => ({
  token: null,
  user: null,
  isReady: false,
  isSigningUp: false,

  setAuth: async (token, user) => {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
    set({ token, user });
  },

  clearAuth: async () => {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    set({ token: null, user: null });
  },

  setOnboardingComplete: () => {
    console.log('[auth] setOnboardingComplete called');
    set((state) => ({
      user: state.user ? { ...state.user, onboardingComplete: true } : null,
    }));
  },

  setSigningUp: (value) => {
    const prev = useAuthStore.getState().isSigningUp;
    console.log(`[auth] setSigningUp: ${value} (was: ${prev})`, new Error().stack?.split('\n').slice(1, 4).join(' <- '));
    set({ isSigningUp: value });
  },

  updateAnalysisFlags: async (flags) => {
    const prev = useAuthStore.getState().user?.analysisFlags;
    // Optimistic update
    set((state) => ({
      user: state.user
        ? { ...state.user, analysisFlags: { ...state.user.analysisFlags, ...flags } }
        : null,
    }));
    try {
      const token = useAuthStore.getState().token;
      const res = await fetch(`${API_BASE_URL}/settings/analysis-flags`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(flags),
      });
      if (!res.ok) throw new Error('Failed to update');
    } catch {
      // Rollback on failure
      if (prev) {
        set((state) => ({
          user: state.user ? { ...state.user, analysisFlags: prev } : null,
        }));
      }
    }
  },

  loadToken: async () => {
    try {
      const token = await SecureStore.getItemAsync(TOKEN_KEY);
      if (token) {
        const payload = JSON.parse(atob(token.split('.')[1]));
        // Set initial state from JWT, default onboardingComplete to true to prevent flash
        set({
          token,
          user: {
            id: payload.userId,
            email: payload.email,
            name: null,
            displayName: null,
            onboardingComplete: true,
            analysisFlags: { grammar: true, fillers: true, patterns: true },
          },
          isReady: false,
        });

        // Fetch actual onboarding status from server
        try {
          const res = await fetch(`${API_BASE_URL}/onboarding/status`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            const data = await res.json();
            set((state) => ({
              user: state.user
                ? {
                    ...state.user,
                    onboardingComplete: data.onboardingComplete,
                    displayName: data.displayName ?? state.user.displayName,
                    analysisFlags: data.analysisFlags ?? state.user.analysisFlags,
                  }
                : null,
              isReady: true,
            }));
          } else {
            set({ isReady: true });
          }
        } catch {
          set({ isReady: true });
        }
      } else {
        set({ isReady: true });
      }
    } catch {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      set({ token: null, user: null, isReady: true });
    }
  },
}));
