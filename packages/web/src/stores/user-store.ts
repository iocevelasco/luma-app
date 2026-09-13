import type { AuthUser } from '@luma/shared';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/**
 * Copia del usuario accesible fuera de React (handlers del api-client,
 * utilidades). El AuthProvider sigue siendo la fuente para los componentes:
 * este store se sincroniza desde ahí, no al revés.
 */
export type UserData = AuthUser;

interface UserState {
  user: UserData | null;
  isLoading: boolean;
  isInitialized: boolean;
  setUser: (user: UserData | null) => void;
  updateUser: (updates: Partial<UserData>) => void;
  clearUser: () => void;
  setLoading: (loading: boolean) => void;
  setInitialized: (initialized: boolean) => void;
}

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      user: null,
      isLoading: false,
      isInitialized: false,
      setUser: (user) => set({ user, isInitialized: true }),
      updateUser: (updates) =>
        set((state) => ({ user: state.user ? { ...state.user, ...updates } : null })),
      clearUser: () => set({ user: null, isInitialized: true }),
      setLoading: (isLoading) => set({ isLoading }),
      setInitialized: (isInitialized) => set({ isInitialized }),
    }),
    {
      name: 'user-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ user: state.user }),
    },
  ),
);
