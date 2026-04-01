'use client';
import { useAuth } from '@/lib/auth';
import { useDB } from '@/lib/db';

export default function ReportsPage() {
  const { user } = useAuth();
  const db = useDB();
  if (!user) return null;

  const myExpenses = user.role === 'admin' ? db.expenses : db.expenses.filter(e => e.userId === user.id);

  // By month
  const byMonth: Record<string, number> = {};
  myExpenses.forEach(e => {
    const month = e.date.slice(0, 7);
    byMonth[month] = (byMonth[month] || 0) + (e.amount || 0);
  });
  const monthEntries = Object.entries(byMonth).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 12);

  // By category
  const byCat: Record<number, number> = {};
  myExpenses.forEach(e => {
    byCat[e.category] = (byCat[e.category] || 0) + (e.amount || 0);
  });
  const catEntries = Object.entries(byCat)
    .map(([id, amt]) => ({ cat: db.categories.find(c => c.id === Number(id)), amt }))
    .filter(x => x.cat)
    .sort((a, b) => b.amt - a.amt);

  // By status
  const byStatus: Record<string, { count: number; total: number }> = {};
  myExpenses.forEach(e => {
    if (!byStatus[e.status]) byStatus[e.status] = { count: 0, total: 0 };
    byStatus[e.status].count++;
    byStatus[e.status].total += (e.amount || 0);
  });

  const statusLabels: Record<string, string> = {
    draft: '下書き', pending_manager: '部長承認待', pending_accountant: '経理承認待',
    approved: '承認済', rejected: '却下',
  };

  const totalApproved = myExpenses.filter(e => e.status === 'approved').reduce((s, e) => s + (e.amount || 0), 0);
  const totalAll = myExpenses.reduce((s, e) => s + (e.amount || 0), 0);
  const maxMonth = monthEntries.length > 0 ? Math.max(...monthEntries.map(([, v]) => v)) : 1;

  return (
    <div>
      <h1 className="page-title">レポート</h1>

      {/* Summary */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">合計申請額</div>
          <div className="stat-value">¥{totalAll.toLocaleString()}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">承認済み合計</div>
          <div className="stat-value">¥{totalApproved.toLocaleString()}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">申請件数</div>
          <div className="stat-value">{myExpenses.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">平均申請額</div>
          <div className="stat-value">
            {myExpenses.length > 0 ? `¥${Math.round(totalAll / myExpenses.length).toLocaleString()}` : '—'}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        {/* Monthly */}
        <div className="table-card">
          <div className="table-header"><h2 className="chart-title">月別推移</h2></div>
          {monthEntries.length === 0 ? (
            <div className="no-data">データがありません</div>
          ) : (
            <div style={{ padding: '20px' }}>
              {monthEntries.map(([month, amt]) => (
                <div key={month} style={{ marginBottom: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '13px' }}>
                    <span style={{ color: 'var(--text-primary)' }}>{month}</span>
                    <span style={{ color: 'var(--text-accent)', fontWeight: '700' }}>¥{amt.toLocaleString()}</span>
                  </div>
                  <div style={{ background: 'var(--bg-alt)', borderRadius: '4px', height: '6px', overflow: 'hidden' }}>
                    <div style={{
                      background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                      height: '100%',
                      width: `${Math.round((amt / maxMonth) * 100)}%`,
                      borderRadius: '4px',
                      transition: 'width 0.5s ease'
                    }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* By category */}
        <div className="table-card">
          <div className="table-header"><h2 className="chart-title">カテゴリ別</h2></div>
          {catEntries.length === 0 ? (
            <div className="no-data">データがありません</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>カテゴリ</th>
                  <th>金額</th>
                  <th>割合</th>
                </tr>
              </thead>
              <tbody>
                {catEntries.map(({ cat, amt }) => (
                  <tr key={cat!.id}>
                    <td>{cat!.icon} {cat!.name}</td>
                    <td>¥{amt.toLocaleString()}</td>
                    <td>{totalAll > 0 ? `${Math.round((amt / totalAll) * 100)}%` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* By status */}
      <div className="table-card" style={{ marginTop: '20px' }}>
        <div className="table-header"><h2 className="chart-title">ステータス別</h2></div>
        <table>
          <thead>
            <tr><th>ステータス</th><th>件数</th><th>合計金額</th></tr>
          </thead>
          <tbody>
            {Object.entries(byStatus).length === 0 ? (
              <tr><td colSpan={3} className="no-data">データがありません</td></tr>
            ) : Object.entries(byStatus).map(([status, data]) => (
              <tr key={status}>
                <td><span className={`status-badge status-${status}`}>{statusLabels[status] || status}</span></td>
                <td>{data.count}件</td>
                <td>¥{data.total.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
