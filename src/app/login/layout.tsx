'use client';
import { AuthProvider } from '@/lib/auth';
import { ThemeProvider } from '@/lib/theme';
export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <ThemeProvider><AuthProvider>{children}</AuthProvider></ThemeProvider>;
}
