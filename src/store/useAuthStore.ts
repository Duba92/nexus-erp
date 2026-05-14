import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { type User, type Company } from '@/src/lib/db';

interface AuthState {
  currentUser: User | null;
  currentCompany: Company | null;
  isAuthenticated: boolean;
  setAuth: (user: User, company: Company | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      currentUser: null,
      currentCompany: null,
      isAuthenticated: false,
      setAuth: (user, company) => set({ currentUser: user, currentCompany: company, isAuthenticated: true }),
      logout: () => set({ currentUser: null, currentCompany: null, isAuthenticated: false }),
    }),
    {
      name: 'nexus-auth-storage',
    }
  )
);
