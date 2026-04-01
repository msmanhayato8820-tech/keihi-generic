'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '@/types';
import { MOCK_USERS } from '@/data/mock';

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string, users?: User[]) => User | null;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

function mockLogin(email: string, password: string, users: User[]): User | null {
  const mockUser = MOCK_USERS.find(u => u.email === email);
  if (mockUser && password === 'demo') return mockUser;
  const realUser = users.find(u => u.email === email);
  if (realUser) return realUser;
  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem('keihi_user');
    if (stored) {
      try { setUser(JSON.parse(stored)); } catch {}
    }
  }, []);

  const login = (email: string, password: string, users: User[] = []): User | null => {
    const found = mockLogin(email, password, users);
    if (found) {
      setUser(found);
      sessionStorage.setItem('keihi_user', JSON.stringify(found));
    }
    return found;
  };

  const logout = () => {
    setUser(null);
    sessionStorage.removeItem('keihi_user');
  };

  return <AuthContext.Provider value={{ user, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
