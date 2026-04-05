'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { User, Expense, Category, Department, Vendor, DBContextType } from '@/types';
import { DEFAULT_CATEGORIES, DEFAULT_DEPARTMENTS, MOCK_EXPENSES, MOCK_USERS, MOCK_VENDORS, DEFAULT_GAS_URL } from '@/data/mock';

const DataContext = createContext<DBContextType | null>(null);

function getScriptUrl(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('gasScriptUrl') || DEFAULT_GAS_URL;
}

function isGasConfigured(): boolean {
  const url = getScriptUrl();
  if (!url) return false;
  if (url.includes('YOUR_GAS_SCRIPT_ID')) return false;
  if (!url.startsWith('https://script.google.com/')) return false;
  return true;
}

function getLocalData() {
  return {
    users: JSON.parse(typeof window !== 'undefined' ? localStorage.getItem('users') || '[]' : '[]'),
    expenses: JSON.parse(typeof window !== 'undefined' ? localStorage.getItem('expenses') || '[]' : '[]'),
    categories: JSON.parse(typeof window !== 'undefined' ? localStorage.getItem('categories') || JSON.stringify(DEFAULT_CATEGORIES) : JSON.stringify(DEFAULT_CATEGORIES)),
    departments: DEFAULT_DEPARTMENTS,
    vendors: JSON.parse(typeof window !== 'undefined' ? localStorage.getItem('vendors') || JSON.stringify(MOCK_VENDORS) : JSON.stringify(MOCK_VENDORS)),
  };
}

async function fetchAll() {
  if (isGasConfigured()) {
    try {
      const url = getScriptUrl();
      const res = await fetch(url + '?action=init');
      const data = await res.json();
      if (!data.error) {
        return {
          users: data.users || [],
          expenses: data.expenses || [],
          categories: data.categories?.length ? data.categories : DEFAULT_CATEGORIES,
          departments: data.departments?.length ? data.departments : DEFAULT_DEPARTMENTS,
          vendors: data.vendors || [],
        };
      }
    } catch {
      // GAS fetch failed — fall back to local/mock data
    }
  }
  return getLocalData();
}

async function gasPost(body: object) {
  if (!isGasConfigured()) return;
  const url = getScriptUrl();
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return res.json();
  } catch {
    // GAS post failed — silently ignore in demo mode
  }
}

// Slack通知
async function sendSlackNotification(message: string) {
  if (typeof window === 'undefined') return;
  const webhookUrl = localStorage.getItem('slackWebhookUrl');
  if (!webhookUrl) return;
  try {
    await fetch(webhookUrl, {
      method: 'POST',
      body: JSON.stringify({ text: message }),
    });
  } catch {}
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [users, setUsers] = useState<User[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES);
  const [departments] = useState<Department[]>(DEFAULT_DEPARTMENTS);
  const [vendors, setVendors] = useState<Vendor[]>(MOCK_VENDORS);
  const [isOnline, setIsOnline] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: string; key: number } | null>(null);
  const [mounted, setMounted] = useState(false);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type, key: Date.now() });
  }, []);

  const refresh = useCallback(async () => {
    try {
      const data = await fetchAll();
      const finalUsers = data.users.length > 0 ? data.users : MOCK_USERS;
      const finalExpenses = data.expenses.length > 0 ? data.expenses : MOCK_EXPENSES;
      setUsers(finalUsers);
      setExpenses(finalExpenses);
      setCategories(data.categories);
      setVendors(data.vendors.length > 0 ? data.vendors : MOCK_VENDORS);
      setIsOnline(isGasConfigured());
    } catch {
      setUsers(MOCK_USERS);
      setExpenses(MOCK_EXPENSES);
    }
  }, []);

  useEffect(() => { setMounted(true); refresh(); }, [refresh]);
  useEffect(() => {
    if (!mounted) return;
    const interval = setInterval(refresh, 60000);
    return () => clearInterval(interval);
  }, [mounted, refresh]);

  const upsertUser = async (user: User) => {
    setUsers(prev => {
      const idx = prev.findIndex(u => u.id === user.id);
      if (idx >= 0) { const next = [...prev]; next[idx] = user; return next; }
      return [...prev, user];
    });
    try { await gasPost({ action: 'upsert', sheet: 'users', data: user }); } catch {}
  };

  const deleteUser = async (id: number) => {
    setUsers(prev => prev.filter(u => u.id !== id));
    try { await gasPost({ action: 'delete', sheet: 'users', id }); } catch {}
  };

  const bulkSetUsers = async (newUsers: User[]) => {
    setUsers(newUsers);
    try { await gasPost({ action: 'replace', sheet: 'users', data: newUsers }); } catch {}
  };

  const upsertExpense = async (expense: Expense) => {
    // 電子帳簿保存法: タイムスタンプ自動付与
    const now = new Date().toISOString();
    if (!expense.createdAt) expense.createdAt = now;
    expense.updatedAt = now;

    setExpenses(prev => {
      const idx = prev.findIndex(e => e.id === expense.id);
      if (idx >= 0) { const next = [...prev]; next[idx] = expense; return next; }
      return [...prev, expense];
    });

    // Slack通知
    if (expense.status === 'pending_manager') {
      const userName = users.find(u => u.id === expense.userId)?.name || '';
      sendSlackNotification(`📝 新しい経費申請: ${userName}さんが「${expense.description}」¥${(expense.amount || 0).toLocaleString()}を申請しました`);
    } else if (expense.status === 'approved') {
      sendSlackNotification(`✅ 経費承認完了: 「${expense.description}」¥${(expense.amount || 0).toLocaleString()}が承認されました`);
    }

    try { await gasPost({ action: 'upsert', sheet: 'expenses', data: expense }); } catch {}
  };

  const saveCategories = async (cats: Category[]) => {
    setCategories(cats);
    try { await gasPost({ action: 'replace', sheet: 'categories', data: cats }); } catch {}
  };

  const upsertVendor = async (vendor: Vendor) => {
    let updated: Vendor[] = [];
    setVendors(prev => {
      const idx = prev.findIndex(v => v.id === vendor.id);
      updated = idx >= 0 ? prev.map((v, i) => i === idx ? vendor : v) : [...prev, vendor];
      return updated;
    });
    localStorage.setItem('vendors', JSON.stringify(updated));
    try { await gasPost({ action: 'upsert', sheet: 'vendors', data: vendor }); } catch {}
  };

  const deleteVendor = async (id: number) => {
    let updated: Vendor[] = [];
    setVendors(prev => {
      updated = prev.filter(v => v.id !== id);
      return updated;
    });
    localStorage.setItem('vendors', JSON.stringify(updated));
    try { await gasPost({ action: 'delete', sheet: 'vendors', id }); } catch {}
  };

  const db: DBContextType = {
    users, expenses, categories, departments, vendors,
    upsertUser, deleteUser, bulkSetUsers, upsertExpense, saveCategories,
    upsertVendor, deleteVendor,
    refresh, isOnline, showToast,
  };

  return (
    <DataContext.Provider value={db}>
      {children}
      {toast && (
        <div
          key={toast.key}
          className={`fixed top-5 right-5 px-5 py-3 rounded-xl text-sm font-semibold z-50 ${
            toast.type === 'success' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
            toast.type === 'error' ? 'bg-red-500/20 text-red-300 border border-red-500/30' :
            'bg-blue-500/20 text-blue-300 border border-blue-500/30'
          }`}
          style={{ animation: 'slideIn 0.3s ease' }}
          onAnimationEnd={() => setTimeout(() => setToast(null), 3700)}
        >
          {toast.message}
        </div>
      )}
    </DataContext.Provider>
  );
}

export function useDB() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useDB must be used within DataProvider');
  return ctx;
}
