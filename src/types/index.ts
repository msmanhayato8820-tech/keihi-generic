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
  invoiceNumber?: string | null;
  isQualifiedInvoice?: boolean;
  vendorId?: number | null;
  vendorName?: string;
  // 立替精算
  isPaid?: boolean; // 精算済み（支払い済み）
  paidAt?: string;  // 支払い日
  paidBy?: string;  // 支払い処理者
  // 電子帳簿保存法
  createdAt?: string;
  updatedAt?: string;
  revisionHistory?: RevisionEntry[];
  approvalHistory: ApprovalHistoryEntry[];
  lineItems?: LineItem[];
  receipts?: Array<{ filename: string; driveFileId: string | null }>;
}

export interface RevisionEntry {
  at: string;
  by: string;
  field: string;
  oldValue: string;
  newValue: string;
}

export interface Vendor {
  id: number;
  name: string;
  invoiceNumber?: string;
  isQualified: boolean;
  category?: string;
  phone?: string;
  address?: string;
}

export interface ApprovalRule {
  id: string;
  name: string;
  condition: 'amount_over' | 'category_is';
  value: number;
  requiredRole: 'manager' | 'admin' | 'accountant';
  description: string;
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
  vendors: Vendor[];
  upsertUser: (user: User) => Promise<void>;
  deleteUser: (id: number) => Promise<void>;
  bulkSetUsers: (users: User[]) => Promise<void>;
  upsertExpense: (expense: Expense) => Promise<void>;
  saveCategories: (cats: Category[]) => Promise<void>;
  upsertVendor: (vendor: Vendor) => Promise<void>;
  deleteVendor: (id: number) => Promise<void>;
  refresh: () => Promise<void>;
  isOnline: boolean;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}
