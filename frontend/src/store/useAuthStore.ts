import { create } from 'zustand';
import type { User } from '../types/index';
import { usersApi } from '../api/users';
import { setInitData } from '../api/client';

interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
  init: (initData: string) => Promise<void>;
  refreshUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,
  error: null,

  init: async (initData: string) => {
    try {
      set({ loading: true, error: null });
      setInitData(initData);
      const user = await usersApi.getMe();
      set({ user, loading: false });
    } catch (err: any) {
      const message = err.response?.data?.detail || 'Failed to authenticate';
      set({ error: message, loading: false });
    }
  },

  refreshUser: async () => {
    try {
      const user = await usersApi.getMe();
      set({ user });
    } catch {
      // silent
    }
  },
}));