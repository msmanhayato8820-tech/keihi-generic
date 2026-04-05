// Company settings module - manages branding, demo accounts, and theme colors
import { User } from '@/types';

export interface CompanySettings {
  companyName: string;
  systemName: string;
  domain: string;
  logoLetter: string;
  primaryColor: string;
  secondaryColor: string;
}

export interface DemoAccount {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'manager' | 'accountant' | 'employee';
  dept: number;
  section: string;
}

const DEFAULT_SETTINGS: CompanySettings = {
  companyName: '会社名',
  systemName: '経費管理システム',
  domain: 'example.co.jp',
  logoLetter: 'K',
  primaryColor: '#3b82f6',
  secondaryColor: '#8b5cf6',
};

const DEFAULT_DEMO_ACCOUNTS: DemoAccount[] = [
  { id: 1, name: '山田 太郎', email: 'admin', role: 'admin', dept: 1, section: '経営企画' },
  { id: 2, name: '佐藤 花子', email: 'manager', role: 'manager', dept: 3, section: '営業課' },
  { id: 3, name: '鈴木 一郎', email: 'accountant', role: 'accountant', dept: 5, section: '経理課' },
  { id: 4, name: '田中 次郎', email: 'employee', role: 'employee', dept: 3, section: '営業課' },
];

export function getCompanySettings(): CompanySettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const stored = localStorage.getItem('companySettings');
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...DEFAULT_SETTINGS, ...parsed };
    }
  } catch {}
  return DEFAULT_SETTINGS;
}

export function saveCompanySettings(settings: CompanySettings) {
  localStorage.setItem('companySettings', JSON.stringify(settings));
  applyCompanyColors(settings);
}

export function applyCompanyColors(settings?: CompanySettings) {
  if (typeof window === 'undefined') return;
  const s = settings || getCompanySettings();
  const root = document.documentElement;

  root.style.setProperty('--text-accent', s.primaryColor);
  root.style.setProperty('--logo-color', s.primaryColor);

  // Generate rgba for shadows and backgrounds
  const hexToRgb = (hex: string) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `${r},${g},${b}`;
  };

  const rgb = hexToRgb(s.primaryColor);
  root.style.setProperty('--btn-primary-bg', `linear-gradient(135deg, ${s.primaryColor}, ${s.secondaryColor})`);
  root.style.setProperty('--btn-primary-shadow', `0 4px 16px rgba(${rgb}, 0.35)`);
  root.style.setProperty('--nav-active-bg', `rgba(${rgb}, 0.1)`);
  root.style.setProperty('--nav-active-fg', s.primaryColor);
}

export function getDemoAccounts(): User[] {
  if (typeof window === 'undefined') return [];
  const settings = getCompanySettings();
  try {
    const stored = localStorage.getItem('demoAccounts');
    if (stored) {
      const accounts: DemoAccount[] = JSON.parse(stored);
      return accounts.map(a => ({
        ...a,
        email: a.email.includes('@') ? a.email : `${a.email}@${settings.domain}`,
      }));
    }
  } catch {}
  // Return defaults with configured domain
  return DEFAULT_DEMO_ACCOUNTS.map(a => ({
    ...a,
    email: `${a.email}@${settings.domain}`,
  }));
}

export function saveDemoAccounts(accounts: DemoAccount[]) {
  localStorage.setItem('demoAccounts', JSON.stringify(accounts));
}

export function getDefaultDemoAccounts(): DemoAccount[] {
  return DEFAULT_DEMO_ACCOUNTS;
}

export function getDefaultCompanySettings(): CompanySettings {
  return DEFAULT_SETTINGS;
}
