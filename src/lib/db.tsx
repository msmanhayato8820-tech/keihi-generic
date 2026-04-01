'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { User, Expense, Category, Department, DBContextType } from '@/types';
import { DEFAULT_CATEGORIES, DEFAULT_DEPARTMENTS, MOCK_EXPENSES, MOCK_USERS, DEFAULT_GAS_URL } from '@/data/mock';

const DataContext = createContext<DBContextType | null>(null);

function getScriptUrl(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('gasScriptUrl') || DEFAULT_GAS_URL;
}

async function fetchAll() {
  const url = getScriptUrl();
  if (url) {
    try {
      const res = await fetch(url + '?action=init');
      const data = await res.json();
      if (!data.error) {
        return {
          users: data.users || [],
          expenses: data.expenses || [],
          categories: data.categories?.length ? data.categories : DEFAULT_CATEGORIES,
          departments: data.departments?.length ? data.departments : DEFAULT_DEPARTMENTS,
        };
      }
    } catch {}
  }
  return {
    users: JSON.parse(typeof window !== 'undefined' ? localStorage.getItem('users') || '[]' : '[]'),
    expenses: JSON.parse(typeof window !== 'undefined' ? localStorage.getItem('expenses') || '[]' : '[]'),
    categories: JSON.parse(typeof window !== 'undefined' ? localStorage.getItem('categories') || JSON.stringify(DEFAULT_CATEGORIES) : JSON.stringify(DEFAULT_CATEGORIES)),
    departments: DEFAULT_DEPARTMENTS,
  };
}

async function gasPost(body: object) {
  const url = getScriptUrl();
  if (!url) return;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [users, setUsers] = useState<User[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES);
  const [departments] = useState<Department[]>(DEFAULT_DEPARTMENTS);
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
      setIsOnline(!!getScriptUrl());
    } catch {
      setUsers(MOCK_USERS);
      setExpenses(MOCK_EXPENSES);
    }
  }, []);

  useEffect(() => {
    setMounted(true);
    refresh();
  }, [refresh]);

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
    setExpenses(prev => {
      const idx = prev.findIndex(e => e.id === expense.id);
      if (idx >= 0) { const next = [...prev]; next[idx] = expense; return next; }
      return [...prev, expense];
    });
    try { await gasPost({ action: 'upsert', sheet: 'expenses', data: expense }); } catch {}
  };

  const saveCategories = async (cats: Category[]) => {
    setCategories(cats);
    try { await gasPost({ action: 'replace', sheet: 'categories', data: cats }); } catch {}
  };

  const db: DBContextType = {
    users, expenses, categories, departments,
    upsertUser, deleteUser, bulkSetUsers, upsertExpense, saveCategories,
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
