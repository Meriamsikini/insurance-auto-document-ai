/**
 * src/store/auth-store.ts
 * Zustand store for authentication state.
 */
import { create } from "zustand";
import {
  type Employee,
  apiLogin,
  apiUpdateProfile,
  apiChangePassword,
  saveAuth,
  clearAuth,
  loadStoredToken,
  loadStoredEmployee,
  initApiWithToken,
} from "@/lib/auth";

type AuthStore = {
  token: string | null;
  employee: Employee | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  updateProfile: (updates: Partial<Employee>) => Promise<void>;
  changePassword: (current: string, next: string) => Promise<void>;
  hydrate: () => void;
};

export const useAuthStore = create<AuthStore>((set, get) => ({
  token: null,
  employee: null,
  isAuthenticated: false,
  isLoading: false,

  hydrate: () => {
    const token = loadStoredToken();
    const employee = loadStoredEmployee();
    if (token && employee) {
      initApiWithToken(token);
      set({ token, employee, isAuthenticated: true });
    }
  },

  login: async (email, password) => {
    set({ isLoading: true });
    try {
      const { token, employee } = await apiLogin(email, password);
      saveAuth(token, employee);
      initApiWithToken(token);
      set({ token, employee, isAuthenticated: true, isLoading: false });
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  logout: () => {
    clearAuth();
    set({ token: null, employee: null, isAuthenticated: false });
  },

  updateProfile: async (updates) => {
    const updated = await apiUpdateProfile(updates);
    const employee = { ...get().employee!, ...updated };
    saveAuth(get().token!, employee);
    set({ employee });
  },

  changePassword: async (current, next) => {
    await apiChangePassword(current, next);
  },
}));
