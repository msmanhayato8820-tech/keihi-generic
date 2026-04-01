'use client';
import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
type Theme = 'dark' | 'light';
interface ThemeContextType { theme: Theme; toggleTheme: () => void; }
const ThemeContext = createContext<ThemeContextType | null>(null);
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>('dark');
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const stored = localStorage.getItem('keihi_theme') as Theme | null;
    if (stored) setTheme(stored);
    setMounted(true);
  }, []);
  useEffect(() => {
    if (!mounted) return;
    document.body.className = theme === 'dark' ? 'dark' : '';
    localStorage.setItem('keihi_theme', theme);
  }, [theme, mounted]);
  const toggleTheme = useCallback(() => setTheme(p => p === 'dark' ? 'light' : 'dark'), []);
  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>;
}
export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
