export type UserRole = 'admin' | 'manager' | 'accountant' | 'employee';

export interface User {
  id: number;
  name: string;
  email: string;
  passwordHash?: string;
  role: UserRole;
  dept: number;
  section?: string;
}

export interface LineItem {
  id: string;
  category: number;
  amount: number;
  taxType: string;
}

export interface ApprovalHistoryEntry {
  action: string;
  by: string;
  at: string;
  comment?: string;
}

export interface Expense {
  id: number;
  userId: number;
  date: string;
  category: number;
  amount: number;
  description: string;
  memo?: string;
  taxType: string;
  status: string;
  receipt?: string | null;
  driveFileId?: string | null;
  approvalHistory: ApprovalHistoryEntry[];
  lineItems?: LineItem[];
  receipts?: Array<{ filename: string; driveFileId: string | null }>;
}

export interface Category {
  id: number;
  name: string;
  icon: string;
}

export interface Department {
  id: number;
  name: string;
  sections: string[];
}

export interface DBContextType {
  users: User[];
  expenses: Expense[];
  categories: Category[];
  departments: Department[];
  upsertUser: (user: User) => Promise<void>;
  deleteUser: (id: number) => Promise<void>;
  bulkSetUsers: (users: User[]) => Promise<void>;
  upsertExpense: (expense: Expense) => Promise<void>;
  saveCategories: (cats: Category[]) => Promise<void>;
  refresh: () => Promise<void>;
  isOnline: boolean;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}
