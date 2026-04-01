import { User, Category, Department, Expense } from '@/types';

export const MOCK_USERS: User[] = [
  { id: 1, name: '山田 太郎', email: 'admin@anest.co.jp', role: 'admin', dept: 1, section: '経営企画' },
  { id: 2, name: '佐藤 花子', email: 'manager@anest.co.jp', role: 'manager', dept: 3, section: '営業課' },
  { id: 3, name: '鈴木 一郎', email: 'accountant@anest.co.jp', role: 'accountant', dept: 5, section: '経理課' },
  { id: 4, name: '田中 次郎', email: 'employee@anest.co.jp', role: 'employee', dept: 3, section: '営業課' },
];

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
    status: 'approved', receipt: null, driveFileId: null,
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
    status: 'pending_manager', receipt: null, driveFileId: null,
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

export const DEFAULT_GAS_URL = 'https://script.google.com/macros/s/AKfycbyldWH3c9a-XTUiv5PpFz9xtwid9V-mdrhDvcDeFBN2T_0nVllER66liOIdXCE-GR_M/exec';
