'use client';
import { useAuth } from '@/lib/auth';
import { useDB } from '@/lib/db';
import { DEPT_BUDGETS } from '@/data/mock';
import { exportMF, exportFreee, exportYayoi } from '@/lib/export';

export default function ReportsPage() {
  const { user } = useAuth();
  const db = useDB();
  if (!user) return null;

  const myExpenses = user.role === 'admin' ? db.expenses : db.expenses.filter(e => e.userId === user.id);

  // By month
  const byMonth: Record<string, number> = {};
  myExpenses.forEach(e => { const month = e.date.slice(0, 7); byMonth[month] = (byMonth[month] || 0) + (e.amount || 0); });
  const monthEntries = Object.entries(byMonth).sort((a, b) => a[0].localeCompare(b[0])).slice(-12);

  // By category
  const byCat: Record<number, number> = {};
  myExpenses.forEach(e => { byCat[e.category] = (byCat[e.category] || 0) + (e.amount || 0); });
  const catEntries = Object.entries(byCat).map(([id, amt]) => ({ cat: db.categories.find(c => c.id === Number(id)), amt })).filter(x => x.cat).sort((a, b) => b.amt - a.amt);

  // By status
  const byStatus: Record<string, { count: number; total: number }> = {};
  myExpenses.forEach(e => { if (!byStatus[e.status]) byStatus[e.status] = { count: 0, total: 0 }; byStatus[e.status].count++; byStatus[e.status].total += (e.amount || 0); });

  const statusLabels: Record<string, string> = {
    draft: '下書き', pending_manager: '部長承認待', pending_accountant: '経理承認待', approved: '承認済', rejected: '却下',
  };

  const totalApproved = myExpenses.filter(e => e.status === 'approved').reduce((s, e) => s + (e.amount || 0), 0);
  const totalAll = myExpenses.reduce((s, e) => s + (e.amount || 0), 0);
  const maxMonth = monthEntries.length > 0 ? Math.max(...monthEntries.map(([, v]) => v)) : 1;

  // Department budget comparison (admin only)
  const currentMonth = new Date().toISOString().slice(0, 7);
  const deptBudgetData = user.role === 'admin' ? db.departments.map(dept => {
    const budget = DEPT_BUDGETS[dept.id] || 0;
    const spent = db.expenses.filter(e => {
      const eUser = db.users.find(u => u.id === e.userId);
      return eUser?.dept === dept.id && e.date.startsWith(currentMonth) && e.status !== 'rejected';
    }).reduce((s, e) => s + (e.amount || 0), 0);
    return { dept, budget, spent, pct: budget > 0 ? Math.round((spent / budget) * 100) : 0 };
  }) : [];

  // Per-employee monthly summary (admin/manager)
  const employeeSummary = (user.role === 'admin' || user.role === 'manager') ? db.users.filter(u => u.role === 'employee' || u.role === 'manager').map(u => {
    const expenses = db.expenses.filter(e => e.userId === u.id && e.date.startsWith(currentMonth));
    const total = expenses.reduce((s, e) => s + (e.amount || 0), 0);
    const approved = expenses.filter(e => e.status === 'approved').reduce((s, e) => s + (e.amount || 0), 0);
    const pending = expenses.filter(e => e.status.startsWith('pending')).length;
    return { user: u, total, approved, pending, count: expenses.length };
  }).filter(x => x.count > 0).sort((a, b) => b.total - a.total) : [];

  // Category colors for visual chart
  const catColors = ['#3b82f6', '#8b5cf6', '#06b6d4', '#f59e0b', '#ef4444', '#10b981', '#ec4899', '#64748b', '#14b8a6', '#f97316'];

  const handleExportMF = () => exportMF(myExpenses);
  const handleExportFreee = () => exportFreee(myExpenses);
  const handleExportYayoi = () => exportYayoi(myExpenses);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <h1 className="page-title" style={{ margin: 0 }}>レポート</h1>
        {(user.role === 'admin' || user.role === 'accountant') && (
          <div style={{ display: 'flex', gap: '6px' }}>
            <button className="btn btn-secondary btn-sm" onClick={handleExportMF}>💰 MF</button>
            <button className="btn btn-secondary btn-sm" onClick={handleExportFreee}>📗 freee</button>
            <button className="btn btn-secondary btn-sm" onClick={handleExportYayoi}>📘 弥生</button>
          </div>
        )}
      </div>

      {/* Summary */}
      <div className="stats-grid">
        <div className="stat-card"><div className="stat-label">合計申請額</div><div className="stat-value">¥{totalAll.toLocaleString()}</div></div>
        <div className="stat-card"><div className="stat-label">承認済み合計</div><div className="stat-value">¥{totalApproved.toLocaleString()}</div></div>
        <div className="stat-card"><div className="stat-label">申請件数</div><div className="stat-value">{myExpenses.length}</div></div>
        <div className="stat-card"><div className="stat-label">平均申請額</div><div className="stat-value">{myExpenses.length > 0 ? `¥${Math.round(totalAll / myExpenses.length).toLocaleString()}` : '—'}</div></div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px' }}>
        {/* Monthly bar chart */}
        <div className="table-card">
          <div className="table-header"><h2 className="chart-title">月別推移</h2></div>
          {monthEntries.length === 0 ? (
            <div className="no-data">データがありません</div>
          ) : (
            <div style={{ padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', height: '140px', marginBottom: '8px' }}>
                {monthEntries.map(([month, amt]) => (
                  <div key={month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                    <span style={{ fontSize: '9px', color: 'var(--text-accent)', fontWeight: '700' }}>
                      {amt > 0 ? `¥${Math.round(amt / 1000)}k` : ''}
                    </span>
                    <div style={{
                      width: '100%', maxWidth: '40px', borderRadius: '4px 4px 0 0',
                      background: 'linear-gradient(180deg, #3b82f6, #8b5cf6)',
                      height: `${Math.max((amt / maxMonth) * 100, 4)}%`, minHeight: '4px',
                      transition: 'height 0.5s ease',
                    }} />
                    <span style={{ fontSize: '9px', color: 'var(--text-secondary)', transform: 'rotate(-30deg)', transformOrigin: 'center' }}>{month.slice(5)}月</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Category donut-style breakdown */}
        <div className="table-card">
          <div className="table-header"><h2 className="chart-title">カテゴリ別</h2></div>
          {catEntries.length === 0 ? (
            <div className="no-data">データがありません</div>
          ) : (
            <div style={{ padding: '20px' }}>
              {/* Horizontal stacked bar */}
              <div style={{ display: 'flex', height: '16px', borderRadius: '8px', overflow: 'hidden', marginBottom: '16px' }}>
                {catEntries.map(({ cat, amt }, i) => (
                  <div key={cat!.id} style={{ width: `${totalAll > 0 ? (amt / totalAll) * 100 : 0}%`, background: catColors[i % catColors.length], transition: 'width 0.5s' }}
                    title={`${cat!.name}: ¥${amt.toLocaleString()}`} />
                ))}
              </div>
              {catEntries.map(({ cat, amt }, i) => {
                const pct = totalAll > 0 ? Math.round((amt / totalAll) * 100) : 0;
                return (
                  <div key={cat!.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', fontSize: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: catColors[i % catColors.length] }} />
                      <span style={{ color: 'var(--text-primary)' }}>{cat!.icon} {cat!.name}</span>
                    </div>
                    <span style={{ color: 'var(--text-accent)', fontWeight: '700' }}>¥{amt.toLocaleString()} ({pct}%)</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Department budget comparison (admin) */}
      {deptBudgetData.length > 0 && (
        <div className="table-card" style={{ marginTop: '20px' }}>
          <div className="table-header"><h2 className="chart-title">部門別予算消化率（{currentMonth}）</h2></div>
          <div style={{ padding: '20px' }}>
            {deptBudgetData.map(({ dept, budget, spent, pct }) => (
              <div key={dept.id} style={{ marginBottom: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '13px' }}>
                  <span style={{ color: 'var(--text-primary)', fontWeight: '600' }}>{dept.name}</span>
                  <span style={{ color: pct >= 90 ? '#ef4444' : 'var(--text-accent)', fontWeight: '700' }}>
                    ¥{spent.toLocaleString()} / ¥{budget.toLocaleString()} ({pct}%)
                  </span>
                </div>
                <div style={{ background: 'var(--bg-alt)', borderRadius: '4px', height: '8px', overflow: 'hidden' }}>
                  <div style={{
                    background: pct >= 90 ? '#ef4444' : pct >= 70 ? '#f59e0b' : 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                    height: '100%', width: `${Math.min(pct, 100)}%`, borderRadius: '4px', transition: 'width 0.5s ease',
                  }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Employee summary (admin/manager) */}
      {employeeSummary.length > 0 && (
        <div className="table-card" style={{ marginTop: '20px' }}>
          <div className="table-header"><h2 className="chart-title">従業員別月次サマリー（{currentMonth}）</h2></div>
          <div className="table-scroll">
          <table>
            <thead>
              <tr><th>氏名</th><th>部署</th><th>申請件数</th><th>合計金額</th><th>承認済</th><th>承認待ち</th></tr>
            </thead>
            <tbody>
              {employeeSummary.map(({ user: u, total, approved, pending, count }) => (
                <tr key={u.id}>
                  <td>{u.name}</td>
                  <td style={{ fontSize: '12px' }}>{db.departments.find(d => d.id === u.dept)?.name || ''}</td>
                  <td>{count}件</td>
                  <td>¥{total.toLocaleString()}</td>
                  <td>¥{approved.toLocaleString()}</td>
                  <td>{pending > 0 ? <span style={{ color: '#f59e0b', fontWeight: '700' }}>{pending}件</span> : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {/* By status */}
      <div className="table-card" style={{ marginTop: '20px' }}>
        <div className="table-header"><h2 className="chart-title">ステータス別</h2></div>
        <div className="table-scroll">
        <table>
          <thead><tr><th>ステータス</th><th>件数</th><th>合計金額</th></tr></thead>
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
    </div>
  );
}
