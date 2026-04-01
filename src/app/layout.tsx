import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ variable: '--font-inter', subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'アネストシステム | 経費管理システム',
  description: 'アネストシステム 経費申請・承認・管理システム',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" className={inter.variable} suppressHydrationWarning>
      <head>
        <script async src="https://apis.google.com/js/api.js"></script>
        <script async src="https://accounts.google.com/gsi/client"></script>
      </head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
