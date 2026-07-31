/**
 * src/lib/auth.ts
 * Auth utilities — token storage, API wiring, type definitions.
 */

import axios from "axios";

export type Employee = {
  id: number;
  email: string;
  full_name: string;
  department: string | null;
  phone: string | null;
  avatar_url: string | null;
  theme: "dark" | "light";
  is_admin: boolean;
};

export type AuthState = {
  token: string | null;
  employee: Employee | null;
};

const TOKEN_KEY = "assurauto_token";
const EMPLOYEE_KEY = "assurauto_employee";

// ── Storage helpers ──────────────────────────────────────────────────────────

export function saveAuth(token: string, employee: Employee): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(EMPLOYEE_KEY, JSON.stringify(employee));
}

export function clearAuth(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(EMPLOYEE_KEY);
}

export function loadStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function loadStoredEmployee(): Employee | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(EMPLOYEE_KEY);
    return raw ? (JSON.parse(raw) as Employee) : null;
  } catch {
    return null;
  }
}

// ── Axios instance with auth header injection ────────────────────────────────

export const authApi = axios.create({ baseURL: "/api/v1" });

authApi.interceptors.request.use((config) => {
  const token = loadStoredToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

authApi.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired/invalid → force logout
      clearAuth();
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
    }
    const detail = error.response?.data?.detail;
    return Promise.reject(new Error(detail || error.message || "Erreur API"));
  },
);

// ── API calls ────────────────────────────────────────────────────────────────

export async function apiLogin(email: string, password: string): Promise<{ token: string; employee: Employee }> {
  const form = new URLSearchParams();
  form.append("username", email);
  form.append("password", password);
  const response = await axios.post<{ access_token: string; employee: Employee }>("/api/v1/auth/login", form, {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
  return { token: response.data.access_token, employee: response.data.employee };
}

export async function apiGetMe(token: string): Promise<Employee> {
  const response = await axios.get<Employee>("/api/v1/auth/me", {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
}

export async function apiUpdateProfile(updates: Partial<Employee>): Promise<Employee> {
  const response = await authApi.patch<Employee>("/auth/me", updates);
  return response.data;
}

export async function apiChangePassword(currentPassword: string, newPassword: string): Promise<void> {
  await authApi.post("/auth/change-password", {
    current_password: currentPassword,
    new_password: newPassword,
  });
}

export function initApiWithToken(token: string): void {
  authApi.defaults.headers.common["Authorization"] = `Bearer ${token}`;
}
