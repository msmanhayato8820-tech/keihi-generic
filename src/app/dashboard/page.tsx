'use client';
import { useAuth } from '@/lib/auth';
import { useDB } from '@/lib/db';
import { EXPENSE_STATUS } from '@/data/mock';

function getStatusLabel(status: string) {
  const map: Record<string, string> = {
    draft: '下書き', pending_manager: '部長承認待', pending_accountant: '経理承認待',
    approved: '承認済', rejected: '却下',
  };
  return map[status] || status;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const db = useDB();
  if (!user) return null;

  const myExpenses = user.role === 'admin' ? db.expenses : db.expenses.filter(e => e.userId === user.id);
  const stats = {
    total: myExpenses.length,
    approvedAmt: myExpenses.filter(e => e.status === EXPENSE_STATUS.APPROVED).reduce((s, e) => s + (e.amount || 0), 0),
    pending: myExpenses.filter(e => [EXPENSE_STATUS.PENDING_MANAGER, EXPENSE_STATUS.PENDING_ACCOUNTANT].includes(e.status as 'pending_manager' | 'pending_accountant')).length,
    draft: myExpenses.filter(e => e.status === EXPENSE_STATUS.DRAFT).length,
  };
  const recent = [...myExpenses].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 10);

  return (
    <div>
      <h1 className="page-title">ダッシュボード</h1>
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">申請件数</div>
          <div className="stat-value">{stats.total}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">承認済み金額</div>
          <div className="stat-value">¥{stats.approvedAmt.toLocaleString()}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">承認待ち</div>
          <div className="stat-value">{stats.pending}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">下書き</div>
          <div className="stat-value">{stats.draft}</div>
        </div>
      </div>

      <div className="table-card">
        <div className="table-header">
          <h2 className="chart-title">最近の申請</h2>
        </div>
        <table>
          <thead>
            <tr>
              <th>日付</th>
              <th>カテゴリ</th>
              <th>説明</th>
              <th>金額</th>
              <th>ステータス</th>
            </tr>
          </thead>
          <tbody>
            {recent.length === 0 ? (
              <tr><td colSpan={5} className="no-data">申請がありません</td></tr>
            ) : recent.map(e => (
              <tr key={e.id}>
                <td>{e.date}</td>
                <td>{db.categories.find(c => c.id === e.category)?.icon} {db.categories.find(c => c.id === e.category)?.name || '-'}</td>
                <td>{e.description}</td>
                <td>¥{(e.amount || 0).toLocaleString()}</td>
                <td><span className={`status-badge status-${e.status}`}>{getStatusLabel(e.status)}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
