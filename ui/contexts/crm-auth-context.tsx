"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from "react";
import { setCrmToken, removeCrmToken } from "@/lib/crm";

const CRM_API_BASE_URL = process.env.NEXT_PUBLIC_CRM_API_URL || 'http://localhost:5001/api';

export interface CrmUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'sys_admin' | 'tenant_admin' | 'tenant_user' | 'customer_user';
  tenantId?: string;
}

interface CrmAuthContextType {
  user: CrmUser | null;
  isLoading: boolean;
  isLoggedIn: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const CrmAuthContext = createContext<CrmAuthContextType | undefined>(undefined);

const CRM_USER_KEY = 'crm_user';
const CRM_TOKEN_KEY = 'crm_token';

function getStoredUser(): CrmUser | null {
  if (typeof window === 'undefined') return null;
  const stored = localStorage.getItem(CRM_USER_KEY);
  if (!stored) return null;
  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(CRM_TOKEN_KEY);
}

export function CrmAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CrmUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check for existing auth on mount
  useEffect(() => {
    const storedUser = getStoredUser();
    const storedToken = getStoredToken();
    if (storedUser && storedToken) {
      setUser(storedUser);
    }
    setIsLoading(false);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const response = await fetch(`${CRM_API_BASE_URL}/auth/admin/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Login failed' }));
      throw new Error(error.message || 'Login failed');
    }

    const data = await response.json();
    const { token, user: userData } = data;

    // Store token and user
    setCrmToken(token);
    localStorage.setItem(CRM_USER_KEY, JSON.stringify(userData));
    setUser(userData);
  }, []);

  const logout = useCallback(() => {
    removeCrmToken();
    localStorage.removeItem(CRM_USER_KEY);
    setUser(null);
  }, []);

  return (
    <CrmAuthContext.Provider
      value={{
        user,
        isLoading,
        isLoggedIn: !!user,
        login,
        logout,
      }}
    >
      {children}
    </CrmAuthContext.Provider>
  );
}

export function useCrmAuth() {
  const context = useContext(CrmAuthContext);
  if (context === undefined) {
    throw new Error("useCrmAuth must be used within a CrmAuthProvider");
  }
  return context;
}
