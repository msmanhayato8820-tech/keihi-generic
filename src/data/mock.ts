import { User, Category, Department, Expense, Vendor, ApprovalRule } from '@/types';
import { getDemoAccounts } from '@/lib/company';

export const MOCK_USERS: User[] = [
  { id: 1, name: '山田 太郎', email: 'admin@example.co.jp', role: 'admin', dept: 1, section: '経営企画' },
  { id: 2, name: '佐藤 花子', email: 'manager@example.co.jp', role: 'manager', dept: 3, section: '営業課' },
  { id: 3, name: '鈴木 一郎', email: 'accountant@example.co.jp', role: 'accountant', dept: 5, section: '経理課' },
  { id: 4, name: '田中 次郎', email: 'employee@example.co.jp', role: 'employee', dept: 3, section: '営業課' },
];

/** Returns demo accounts from company settings, or MOCK_USERS as fallback */
export function getMockUsers(): User[] {
  if (typeof window === 'undefined') return MOCK_USERS;
  const accounts = getDemoAccounts();
  return accounts.length > 0 ? accounts : MOCK_USERS;
}

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 1, name: '交通費', icon: '🚌' },
  { id: 2, name: '宿泊費', icon: '🏨' },
  { id: 3, name: '交際費', icon: '🍽' },
  { id: 4, name: '消耗品費', icon: '📝' },
  { id: 5, name: '通信費', icon: '📱' },
  { id: 6, name: '会議費', icon: '💼' },
  { id: 7, name: '書籍・研修費', icon: '📚' },
  { id: 8, name: '備品費', icon: '🖥' },
  { id: 9, name: '郵送費', icon: '📮' },
  { id: 10, name: 'その他', icon: '📦' },
];

export const DEFAULT_DEPARTMENTS: Department[] = [
  { id: 1, name: '経営', sections: ['経営企画'] },
  { id: 2, name: '総務部', sections: ['総務課'] },
  { id: 3, name: 'システム営業部', sections: ['営業課', '製品管理課', 'ユーザーサポート課', 'コールセンター'] },
  { id: 4, name: 'システム開発部', sections: ['開発課'] },
  { id: 5, name: '経理部', sections: ['経理課'] },
];

export const MOCK_EXPENSES: Expense[] = [
  {
    id: 1, userId: 4, date: '2026-03-15', category: 1, amount: 3500,
    description: '大阪出張 電車代', memo: '', taxType: 'tax_10',
    status: 'approved', receipt: null, driveFileId: null, invoiceNumber: 'T1234567890123', isQualifiedInvoice: true,
    approvalHistory: [
      { action: 'submitted', by: '田中 次郎', at: '2026-03-15T09:00:00', comment: '' },
      { action: 'approved_manager', by: '佐藤 花子', at: '2026-03-15T14:00:00', comment: '承認します' },
      { action: 'approved_accountant', by: '鈴木 一郎', at: '2026-03-16T10:00:00', comment: '' },
    ],
    lineItems: [{ id: 'a1', category: 1, amount: 3500, taxType: 'tax_10' }],
  },
  {
    id: 2, userId: 4, date: '2026-03-20', category: 3, amount: 12000,
    description: '顧客接待 ランチ', memo: '〇〇株式会社 山本様', taxType: 'tax_10',
    status: 'pending_manager', receipt: null, driveFileId: null, invoiceNumber: 'T9876543210987', isQualifiedInvoice: true,
    approvalHistory: [
      { action: 'submitted', by: '田中 次郎', at: '2026-03-20T12:00:00', comment: '' },
    ],
    lineItems: [{ id: 'b1', category: 3, amount: 12000, taxType: 'tax_10' }],
  },
  {
    id: 3, userId: 2, date: '2026-03-25', category: 7, amount: 4800,
    description: 'AWS認定試験 参考書', memo: '', taxType: 'tax_10',
    status: 'pending_accountant', receipt: null, driveFileId: null,
    approvalHistory: [
      { action: 'submitted', by: '佐藤 花子', at: '2026-03-25T09:30:00', comment: '' },
      { action: 'approved_manager', by: '山田 太郎', at: '2026-03-25T11:00:00', comment: '承認' },
    ],
    lineItems: [{ id: 'c1', category: 7, amount: 4800, taxType: 'tax_10' }],
  },
  {
    id: 4, userId: 4, date: '2026-03-28', category: 1, amount: 980,
    description: '営業訪問 バス代', memo: '', taxType: 'tax_10',
    status: 'draft', receipt: null, driveFileId: null,
    approvalHistory: [],
    lineItems: [{ id: 'd1', category: 1, amount: 980, taxType: 'tax_10' }],
  },
];

export const TAX_TYPES = [
  { id: 'tax_10', name: '課税 10%', rate: 0.10, label: '10%' },
  { id: 'tax_8', name: '軽減税率 8%', rate: 0.08, label: '8%' },
  { id: 'tax_exempt', name: '非課税', rate: 0, label: '非課税' },
  { id: 'tax_non', name: '不課税', rate: 0, label: '不課税' },
];

export const EXPENSE_STATUS = {
  DRAFT: 'draft',
  PENDING_MANAGER: 'pending_manager',
  PENDING_ACCOUNTANT: 'pending_accountant',
  APPROVED: 'approved',
  REJECTED: 'rejected',
} as const;

export const MOCK_USER_ROLE_LABELS: Record<string, string> = {
  admin: '管理者',
  manager: '部長',
  accountant: '経理',
  employee: '一般社員',
};

// SECURITY: Do NOT hardcode a real GAS script URL here.
// Set the script URL via app settings (stored in localStorage under 'gasUrl')
// or via an environment variable. This placeholder must remain a placeholder in source control.
export const DEFAULT_GAS_URL = 'https://script.google.com/macros/s/YOUR_GAS_SCRIPT_ID/exec';

// ===== 取引先マスタ =====
export const MOCK_VENDORS: Vendor[] = [
  { id: 1, name: 'JR東日本', invoiceNumber: 'T7011001058843', isQualified: true, category: '交通' },
  { id: 2, name: 'ANA', invoiceNumber: 'T4010001016740', isQualified: true, category: '交通' },
  { id: 3, name: '東急ホテルズ', invoiceNumber: 'T2010401089842', isQualified: true, category: '宿泊' },
  { id: 4, name: 'アスクル', invoiceNumber: 'T5010001052477', isQualified: true, category: '消耗品' },
  { id: 5, name: '個人タクシー 山田', isQualified: false, category: '交通' },
];

// ===== 承認ルート設定 =====
export const DEFAULT_APPROVAL_RULES: ApprovalRule[] = [
  { id: 'r1', name: '5万円超は役員承認', condition: 'amount_over', value: 50000, requiredRole: 'admin', description: '5万円を超える申請は役員（admin）の承認も必要' },
  { id: 'r2', name: '交際費は役員承認', condition: 'category_is', value: 3, requiredRole: 'admin', description: '交際費カテゴリは金額に関わらず役員承認が必要' },
  { id: 'r3', name: '10万円超は経理＋役員', condition: 'amount_over', value: 100000, requiredRole: 'admin', description: '10万円超は経理承認後に役員の最終承認が必要' },
];

// ===== 交通費 主要路線運賃 =====
export const COMMON_ROUTES = [
  { from: '東京', to: '大阪', fare: 13870, method: '新幹線（のぞみ指定席）' },
  { from: '東京', to: '名古屋', fare: 11300, method: '新幹線（のぞみ指定席）' },
  { from: '東京', to: '仙台', fare: 11410, method: '新幹線（はやぶさ指定席）' },
  { from: '東京', to: '広島', fare: 19440, method: '新幹線（のぞみ指定席）' },
  { from: '東京', to: '福岡', fare: 23390, method: '新幹線（のぞみ指定席）' },
  { from: '品川', to: '新横浜', fare: 380, method: 'JR在来線' },
  { from: '渋谷', to: '新宿', fare: 160, method: 'JR山手線' },
  { from: '東京', to: '横浜', fare: 490, method: 'JR在来線' },
  { from: '東京', to: '大宮', fare: 580, method: 'JR在来線' },
  { from: '新宿', to: '立川', fare: 490, method: 'JR中央線' },
];

// ===== マネーフォワード連携 =====
// カテゴリ → MF勘定科目マッピング
export const MF_ACCOUNT_MAP: Record<number, { code: string; name: string; mfDebit: string }> = {
  1: { code: '7121', name: '旅費交通費', mfDebit: '旅費交通費' },
  2: { code: '7122', name: '旅費交通費', mfDebit: '旅費交通費' },
  3: { code: '7131', name: '交際費', mfDebit: '交際費' },
  4: { code: '7141', name: '消耗品費', mfDebit: '消耗品費' },
  5: { code: '7151', name: '通信費', mfDebit: '通信費' },
  6: { code: '7161', name: '会議費', mfDebit: '会議費' },
  7: { code: '7171', name: '研修費', mfDebit: '研修費' },
  8: { code: '7181', name: '備品費', mfDebit: '消耗品費' },
  9: { code: '7191', name: '荷造運賃', mfDebit: '荷造運賃' },
  10: { code: '7199', name: '雑費', mfDebit: '雑費' },
};

export const MF_TAX_MAP: Record<string, string> = {
  tax_10: '課対仕入10%',
  tax_8: '課対仕入8%(軽)',
  tax_exempt: '非課税仕入',
  tax_non: '対象外',
};

// ===== freee連携 =====
export const FREEE_TAX_MAP: Record<string, string> = {
  tax_10: '課対仕入10%',
  tax_8: '課対仕入(軽)8%',
  tax_exempt: '非課仕入',
  tax_non: '対象外',
};

// ===== 弥生シリーズ連携 =====
export const YAYOI_TAX_MAP: Record<string, string> = {
  tax_10: '課対仕入10%',
  tax_8: '課対仕入8%',
  tax_exempt: '非課税仕入',
  tax_non: '対象外',
};

export const YAYOI_ACCOUNT_MAP: Record<number, string> = {
  1: '旅費交通費',
  2: '旅費交通費',
  3: '交際費',
  4: '消耗品費',
  5: '通信費',
  6: '会議費',
  7: '研修採用費',
  8: '消耗品費',
  9: '荷造運賃',
  10: '雑費',
};

// ===== 経費テンプレート =====
export interface ExpenseTemplate {
  id: string;
  name: string;
  icon: string;
  description: string;
  lineItems: Array<{ category: number; amount: number; taxType: string }>;
}

export const DEFAULT_TEMPLATES: ExpenseTemplate[] = [
  {
    id: 'biz_trip_train',
    name: '国内出張（電車）',
    icon: '🚄',
    description: '電車での出張交通費',
    lineItems: [{ category: 1, amount: 0, taxType: 'tax_10' }],
  },
  {
    id: 'biz_trip_full',
    name: '出張（交通+宿泊）',
    icon: '🏨',
    description: '交通費と宿泊費セット',
    lineItems: [
      { category: 1, amount: 0, taxType: 'tax_10' },
      { category: 2, amount: 0, taxType: 'tax_10' },
    ],
  },
  {
    id: 'client_meal',
    name: '接待・会食',
    icon: '🍽',
    description: '顧客接待の飲食費',
    lineItems: [{ category: 3, amount: 0, taxType: 'tax_10' }],
  },
  {
    id: 'supplies',
    name: '消耗品購入',
    icon: '📝',
    description: 'オフィス消耗品',
    lineItems: [{ category: 4, amount: 0, taxType: 'tax_10' }],
  },
  {
    id: 'meeting',
    name: '会議費',
    icon: '💼',
    description: '社内外の会議関連費',
    lineItems: [{ category: 6, amount: 0, taxType: 'tax_8' }],
  },
  {
    id: 'training',
    name: '研修・書籍',
    icon: '📚',
    description: '書籍購入や研修費',
    lineItems: [{ category: 7, amount: 0, taxType: 'tax_10' }],
  },
];

// ===== 経費ポリシー =====
export interface ExpensePolicy {
  categoryId: number;
  maxAmount: number;
  requireReceipt: boolean;
  note: string;
}

export const EXPENSE_POLICIES: ExpensePolicy[] = [
  { categoryId: 1, maxAmount: 50000, requireReceipt: false, note: '5万円超は事前承認が必要' },
  { categoryId: 2, maxAmount: 20000, requireReceipt: true, note: '1泊2万円以下（領収書必須）' },
  { categoryId: 3, maxAmount: 30000, requireReceipt: true, note: '1回3万円以下・参加者名記載必須' },
  { categoryId: 4, maxAmount: 10000, requireReceipt: true, note: '1万円超は事前承認が必要' },
  { categoryId: 5, maxAmount: 5000, requireReceipt: true, note: '月額5千円以下' },
  { categoryId: 6, maxAmount: 5000, requireReceipt: true, note: '1回5千円以下' },
  { categoryId: 7, maxAmount: 30000, requireReceipt: true, note: '事前申請推奨' },
  { categoryId: 8, maxAmount: 50000, requireReceipt: true, note: '5万円超は稟議が必要' },
];

// ===== 部門別月次予算 =====
export const DEPT_BUDGETS: Record<number, number> = {
  1: 200000,   // 経営
  2: 150000,   // 総務部
  3: 500000,   // システム営業部
  4: 300000,   // システム開発部
  5: 100000,   // 経理部
};
