'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme';
import { getMockUsers, MOCK_USER_ROLE_LABELS } from '@/data/mock';
import { getCompanySettings, applyCompanyColors } from '@/lib/company';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();

  const [companyName, setCompanyName] = useState('会社名');
  const [systemName, setSystemName] = useState('経費管理システム');
  const [logoLetter, setLogoLetter] = useState('K');
  const [primaryColor, setPrimaryColor] = useState('#3b82f6');
  const [secondaryColor, setSecondaryColor] = useState('#8b5cf6');
  const [demoUsers, setDemoUsers] = useState(getMockUsers());

  useEffect(() => {
    const s = getCompanySettings();
    setCompanyName(s.companyName);
    setSystemName(s.systemName);
    setLogoLetter(s.logoLetter);
    setPrimaryColor(s.primaryColor);
    setSecondaryColor(s.secondaryColor);
    applyCompanyColors(s);
    setDemoUsers(getMockUsers());
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const user = login(email, password);
    if (user) {
      router.push('/dashboard');
    } else {
      setError('メールアドレスまたはパスワードが正しくありません');
    }
  };

  return (
    <div className="login-page">
      <div style={{ width: '100%', maxWidth: '440px', padding: '0 16px', boxSizing: 'border-box' }}>
        {/* Theme toggle */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
          <button onClick={toggleTheme} className="theme-toggle-btn">
            {theme === 'dark' ? (
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" /></svg>
            ) : (
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" /></svg>
            )}
          </button>
        </div>

        {/* Logo + Title */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            width: '56px', height: '56px', borderRadius: '16px',
            background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px', boxShadow: `0 8px 24px ${primaryColor}4D`
          }}>
            <span style={{ color: 'white', fontSize: '24px', fontWeight: '800' }}>{logoLetter}</span>
          </div>
          <h1 style={{ fontSize: '22px', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '4px' }}>
            {companyName}
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>{systemName}</p>
        </div>

        {/* Login Card */}
        <div className="login-container">
          <form onSubmit={handleSubmit} style={{ marginBottom: '24px' }}>
            <div className="form-group">
              <label className="form-label">メールアドレス</label>
              <input
                type="email" className="form-control"
                value={email} onChange={e => setEmail(e.target.value)}
                placeholder={demoUsers[0]?.email || 'user@example.co.jp'} required
              />
            </div>
            <div className="form-group">
              <label className="form-label">パスワード</label>
              <input
                type="password" className="form-control"
                value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••" required
              />
            </div>
            {error && <p style={{ color: 'var(--error-color)', fontSize: '13px', marginBottom: '12px' }}>{error}</p>}
            <button type="submit" className="btn btn-primary" style={{ marginTop: '8px' }}>
              ログイン
            </button>
          </form>

          {/* Demo accounts */}
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '20px' }}>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
              デモアカウント（パスワード: <strong>demo</strong>）
            </p>
            <div className="demo-btn-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              {demoUsers.map(u => (
                <button
                  key={u.email}
                  onClick={() => { setEmail(u.email); setPassword('demo'); setError(''); }}
                  className="demo-btn"
                >
                  <span style={{ fontWeight: '700', color: 'var(--text-primary)', fontSize: '12px' }}>
                    {MOCK_USER_ROLE_LABELS[u.role]}
                  </span>
                  <br />
                  <span style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>{u.name}</span>
                  <br />
                  <span style={{ color: 'var(--text-secondary)', fontSize: '10px', opacity: 0.6, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '11px', marginTop: '24px', opacity: 0.6 }}>
          Powered by Next.js + Vercel
        </p>
      </div>
    </div>
  );
}
