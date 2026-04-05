'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { AuthProvider, useAuth } from '@/lib/auth';
import { ThemeProvider, useTheme } from '@/lib/theme';
import { DataProvider, useDB } from '@/lib/db';
import { getCompanySettings, applyCompanyColors } from '@/lib/company';

function Sidebar() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const db = useDB();
  const router = useRouter();
  const pathname = usePathname();
  const [companyName, setCompanyName] = useState('');

  useEffect(() => {
    const s = getCompanySettings();
    setCompanyName(s.companyName);
    applyCompanyColors(s);
  }, []);

  if (!user) return null;

  const handleLogout = () => { logout(); router.push('/login'); };

  // Count pending approvals for badge
  const pendingCount = db.expenses.filter(e => {
    if ((user.role === 'manager' || user.role === 'admin') && e.status === 'pending_manager') return true;
    if (user.role === 'accountant' && e.status === 'pending_accountant') return true;
    return false;
  }).length;

  const nav = [
    { href: '/dashboard', label: '📊 ダッシュボード', exact: true },
    { href: '/dashboard/apply', label: '📝 経費申請' },
    { href: '/dashboard/list', label: '📋 申請一覧' },
    ...(user.role === 'manager' || user.role === 'accountant' || user.role === 'admin'
      ? [{ href: '/dashboard/approval', label: `✓ 承認${pendingCount > 0 ? ` (${pendingCount})` : ''}`, exact: false, badge: pendingCount }] : []),
    { href: '/dashboard/reports', label: '📈 レポート' },
    { href: '/dashboard/vendors', label: '🏢 取引先マスタ' },
    ...(user.role === 'admin' ? [{ href: '/dashboard/users', label: '👥 ユーザー管理', exact: false }] : []),
    { href: '/dashboard/settings', label: '⚙ 設定' },
  ];

  const deptName = db.departments.find(d => d.id === user.dept)?.name || '';
  const roleLabel: Record<string, string> = { admin: '管理者', manager: '部長', accountant: '経理', employee: '一般社員' };

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname.startsWith(href);

  return (
    <div className="sidebar">
      <div className="logo">{companyName || '経費管理'}</div>
      <div className={`db-status ${db.isOnline ? 'db-online' : 'db-offline'}`}>
        {db.isOnline ? '🟢 共有DB接続中' : '🟡 デモモード'}
      </div>
      <div className="user-info">
        <div className="user-name">{user.name}</div>
        <div className="user-dept">{deptName}</div>
        <div className="user-role">{roleLabel[user.role] || user.role}</div>
      </div>
      <ul className="nav-menu">
        {nav.map(n => (
          <li key={n.href} className="nav-item">
            <button
              className={`nav-link ${isActive(n.href, n.exact) ? 'active' : ''}`}
              onClick={() => router.push(n.href)}
            >
              {n.label}
            </button>
          </li>
        ))}
      </ul>
      {db.isOnline && (
        <button className="refresh-btn" onClick={async () => { await db.refresh(); db.showToast('データを更新しました', 'success'); }}>
          🔄 データ更新
        </button>
      )}
      <button className="dark-toggle" onClick={toggleTheme}>
        {theme === 'dark' ? '☀ ライトモード' : '🌙 ダークモード'}
      </button>
      <button className="logout-btn" onClick={handleLogout}>ログアウト</button>
    </div>
  );
}

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { if (mounted && !user) router.push('/login'); }, [mounted, user, router]);

  if (!mounted) return (
    <div className="login-page">
      <div style={{ color: 'var(--text-primary)', fontSize: '14px' }}>読み込み中...</div>
    </div>
  );
  if (!user) return null;
  return <>{children}</>;
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <DataProvider>
          <AuthGuard>
            <div className="container">
              <Sidebar />
              <div className="main-content">{children}</div>
            </div>
          </AuthGuard>
        </DataProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
