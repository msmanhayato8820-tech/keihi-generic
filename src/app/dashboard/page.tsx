'use client';
import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useDB } from '@/lib/db';
import { EXPENSE_STATUS, DEPT_BUDGETS } from '@/data/mock';
import { exportMF, exportFreee, exportYayoi } from '@/lib/export';
import { getStatusLabel } from '@/lib/expense';

export default function DashboardPage() {
  const { user } = useAuth();
  const db = useDB();
  if (!user) return null;

  const myExpenses = user.role === 'admin' ? db.expenses : db.expenses.filter(e => e.userId === user.id);
  const stats = {
    total: myExpenses.length,
    approvedAmt: myExpenses.filter(e => e.status === EXPENSE_STATUS.APPROVED).reduce((s, e) => s + (e.amount || 0), 0),
    pending: myExpenses.filter(e => [EXPENSE_STATUS.PENDING_MANAGER, EXPENSE_STATUS.PENDING_ACCOUNTANT].includes(e.status as any)).length,
    draft: myExpenses.filter(e => e.status === EXPENSE_STATUS.DRAFT).length,
  };

  // Approval notifications
  const pendingForMe = db.expenses.filter(e => {
    if ((user.role === 'manager' || user.role === 'admin') && e.status === 'pending_manager') return true;
    if (user.role === 'accountant' && e.status === 'pending_accountant') return true;
    return false;
  });

  // Monthly chart data (last 6 months)
  const monthData: { month: string; amount: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const m = d.toISOString().slice(0, 7);
    const amt = myExpenses.filter(e => e.date.startsWith(m)).reduce((s, e) => s + (e.amount || 0), 0);
    monthData.push({ month: m, amount: amt });
  }
  const maxMonth = Math.max(...monthData.map(m => m.amount), 1);

  // Category breakdown
  const catData: Record<number, number> = {};
  myExpenses.forEach(e => { catData[e.category] = (catData[e.category] || 0) + (e.amount || 0); });
  const catEntries = Object.entries(catData).map(([id, amt]) => ({
    cat: db.categories.find(c => c.id === Number(id)),
    amt,
  })).filter(x => x.cat).sort((a, b) => b.amt - a.amt).slice(0, 5);
  const catTotal = catEntries.reduce((s, c) => s + c.amt, 0);

  // Budget usage
  const currentMonth = new Date().toISOString().slice(0, 7);
  const deptBudget = DEPT_BUDGETS[user.dept] || 0;
  const deptExpenses = db.expenses.filter(e => {
    const eUser = db.users.find(u => u.id === e.userId);
    return eUser?.dept === user.dept && e.date.startsWith(currentMonth) && e.status !== 'rejected';
  });
  const deptSpent = deptExpenses.reduce((s, e) => s + (e.amount || 0), 0);
  const budgetPct = deptBudget > 0 ? Math.min(Math.round((deptSpent / deptBudget) * 100), 100) : 0;

  const recent = [...myExpenses].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 8);

  return (
    <div>
      <h1 className="page-title">ダッシュボード</h1>

      {/* Approval notification */}
      {pendingForMe.length > 0 && (
        <div style={{ background: 'var(--warning-bg, rgba(245,158,11,0.1))', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '12px', padding: '14px 18px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '20px' }}>⚠️</span>
          <div>
            <p style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)' }}>
              あなたの承認待ちが {pendingForMe.length} 件あります
            </p>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              合計金額: ¥{pendingForMe.reduce((s, e) => s + (e.amount || 0), 0).toLocaleString()}
            </p>
          </div>
        </div>
      )}

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

      {/* Budget usage */}
      {deptBudget > 0 && (
        <div style={{ background: 'var(--bg-card)', backdropFilter: 'var(--glass-blur)', border: '1px solid var(--border)', borderRadius: '16px', padding: '20px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <h2 className="chart-title" style={{ margin: 0 }}>部門月次予算（{db.departments.find(d => d.id === user.dept)?.name}）</h2>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              ¥{deptSpent.toLocaleString()} / ¥{deptBudget.toLocaleString()}
            </span>
          </div>
          <div style={{ background: 'var(--bg-alt)', borderRadius: '6px', height: '10px', overflow: 'hidden' }}>
            <div style={{
              background: budgetPct >= 90 ? '#ef4444' : budgetPct >= 70 ? '#f59e0b' : 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
              height: '100%', width: `${budgetPct}%`, borderRadius: '6px', transition: 'width 0.5s ease',
            }} />
          </div>
          <p style={{ fontSize: '11px', color: budgetPct >= 90 ? '#ef4444' : 'var(--text-secondary)', marginTop: '6px' }}>
            {budgetPct}% 消化{budgetPct >= 90 ? ' ⚠ 予算超過注意' : ''}
          </p>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px', marginBottom: '20px' }}>
        {/* Monthly chart */}
        <div style={{ background: 'var(--bg-card)', backdropFilter: 'var(--glass-blur)', border: '1px solid var(--border)', borderRadius: '16px', padding: '20px' }}>
          <h2 className="chart-title">月次推移</h2>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', height: '120px', marginTop: '12px' }}>
            {monthData.map(m => (
              <div key={m.month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                <span style={{ fontSize: '10px', color: 'var(--text-accent)', fontWeight: '700' }}>
                  {m.amount > 0 ? `¥${Math.round(m.amount / 1000)}k` : ''}
                </span>
                <div style={{
                  width: '100%', borderRadius: '4px 4px 0 0',
                  background: 'linear-gradient(180deg, #3b82f6, #8b5cf6)',
                  height: `${Math.max((m.amount / maxMonth) * 100, 4)}%`,
                  minHeight: '4px', transition: 'height 0.5s ease',
                }} />
                <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>{m.month.slice(5)}月</span>
              </div>
            ))}
          </div>
        </div>

        {/* Category breakdown */}
        <div style={{ background: 'var(--bg-card)', backdropFilter: 'var(--glass-blur)', border: '1px solid var(--border)', borderRadius: '16px', padding: '20px' }}>
          <h2 className="chart-title">カテゴリ内訳 TOP5</h2>
          <div style={{ marginTop: '12px' }}>
            {catEntries.map(({ cat, amt }) => {
              const pct = catTotal > 0 ? Math.round((amt / catTotal) * 100) : 0;
              return (
                <div key={cat!.id} style={{ marginBottom: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                    <span style={{ color: 'var(--text-primary)' }}>{cat!.icon} {cat!.name}</span>
                    <span style={{ color: 'var(--text-accent)', fontWeight: '700' }}>¥{amt.toLocaleString()} ({pct}%)</span>
                  </div>
                  <div style={{ background: 'var(--bg-alt)', borderRadius: '4px', height: '6px', overflow: 'hidden' }}>
                    <div style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', height: '100%', width: `${pct}%`, borderRadius: '4px' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Accounting export buttons */}
      {(user.role === 'admin' || user.role === 'accountant') && (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px 18px', marginBottom: '20px' }}>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '10px', fontWeight: '600' }}>会計ソフト連携（承認済みデータを仕訳CSV出力）</p>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button className="btn btn-secondary btn-sm" onClick={() => exportMF(db.expenses)}>
              💰 マネーフォワード
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => exportFreee(db.expenses)}>
              📗 freee
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => exportYayoi(db.expenses)}>
              📘 弥生シリーズ
            </button>
          </div>
        </div>
      )}

      <div className="table-card">
        <div className="table-header">
          <h2 className="chart-title">最近の申請</h2>
        </div>
        <div className="table-scroll">
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
    </div>
  );
}
