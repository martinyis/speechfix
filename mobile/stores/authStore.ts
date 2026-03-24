import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL } from '../lib/api';

const TOKEN_KEY = 'auth_token';

interface User {
  id: number;
  email: string;
  name: string | null;
  displayName: string | null;
  onboardingComplete: boolean;
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
    set((state) => ({
      user: state.user ? { ...state.user, onboardingComplete: true } : null,
    }));
  },

  setSigningUp: (value) => {
    set({ isSigningUp: value });
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
