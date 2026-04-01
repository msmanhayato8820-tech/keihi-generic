'use client';
import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useDB } from '@/lib/db';
import { Expense } from '@/types';

const STATUS_OPTIONS = [
  { value: '', label: 'すべて' },
  { value: 'draft', label: '下書き' },
  { value: 'pending_manager', label: '部長承認待' },
  { value: 'pending_accountant', label: '経理承認待' },
  { value: 'approved', label: '承認済' },
  { value: 'rejected', label: '却下' },
];

function getStatusLabel(status: string) {
  return STATUS_OPTIONS.find(s => s.value === status)?.label || status;
}

// ISO文字列 or YYYY-MM-DD → YYYY-MM-DD に正規化
function formatDate(s: string): string {
  if (!s) return '-';
  return s.slice(0, 10);
}

function actionLabel(action: string) {
  const m: Record<string, string> = {
    submitted: '申請', approved_manager: '部長承認', approved_accountant: '経理承認', rejected: '却下',
  };
  return m[action] || action;
}

const PAGE_SIZE = 10;

export default function ListPage() {
  const { user } = useAuth();
  const db = useDB();
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Expense | null>(null);

  if (!user) return null;

  const base = user.role === 'admin' ? db.expenses : db.expenses.filter(e => e.userId === user.id);
  const filtered = base.filter(e => {
    if (statusFilter && e.status !== statusFilter) return false;
    if (categoryFilter && String(e.category) !== categoryFilter) return false;
    if (dateFrom && e.date < dateFrom) return false;
    if (dateTo && e.date > dateTo) return false;
    return true;
  }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const submitterName = (userId: number) => db.users.find(u => u.id === userId)?.name || `ID:${userId}`;

  return (
    <div>
      <h1 className="page-title">申請一覧</h1>

      {/* Filters */}
      <div style={{ background: 'var(--bg-card)', backdropFilter: 'var(--glass-blur)', border: '1px solid var(--border)', borderRadius: '16px', padding: '20px', marginBottom: '20px' }}>
        <div className="filter-group">
          <div>
            <label className="form-label">ステータス</label>
            <select className="form-control" value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}>
              {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">カテゴリ</label>
            <select className="form-control" value={categoryFilter} onChange={e => { setCategoryFilter(e.target.value); setPage(1); }}>
              <option value="">すべて</option>
              {db.categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">期間</label>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <input type="date" className="form-control" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1); }} style={{ flex: 1 }} />
              <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>〜</span>
              <input type="date" className="form-control" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1); }} style={{ flex: 1 }} />
            </div>
          </div>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
          {filtered.length}件 / 全{base.length}件
        </p>
      </div>

      <div className="table-card">
        <table>
          <thead>
            <tr>
              <th>日付</th>
              {user.role === 'admin' && <th>申請者</th>}
              <th>カテゴリ</th>
              <th>説明</th>
              <th>金額</th>
              <th>ステータス</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {paged.length === 0 ? (
              <tr><td colSpan={7} className="no-data">申請がありません</td></tr>
            ) : paged.map(e => (
              <tr key={e.id}>
                <td>{formatDate(e.date)}</td>
                {user.role === 'admin' && <td style={{ fontSize: '12px' }}>{submitterName(e.userId)}</td>}
                <td>{db.categories.find(c => c.id === e.category)?.icon} {db.categories.find(c => c.id === e.category)?.name || '-'}</td>
                <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.description}</td>
                <td>¥{(e.amount || 0).toLocaleString()}</td>
                <td><span className={`status-badge status-${e.status}`}>{getStatusLabel(e.status)}</span></td>
                <td>
                  <button className="btn btn-secondary btn-sm" onClick={() => setSelected(e)}>詳細</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="pagination">
          <button className="pagination-btn" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>前へ</button>
          <span className="pagination-info">{page} / {totalPages}</span>
          <button className="pagination-btn" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>次へ</button>
        </div>
      </div>

      {/* Detail Modal */}
      {selected && (
        <div className="modal" onClick={e => { if (e.target === e.currentTarget) setSelected(null); }}>
          <div className="modal-content">
            <button className="modal-close" onClick={() => setSelected(null)}>×</button>
            <h2 className="modal-title">申請詳細</h2>
            <div className="detail-row"><div className="detail-label">申請日</div><div className="detail-value">{formatDate(selected.date)}</div></div>
            <div className="detail-row"><div className="detail-label">申請者</div><div className="detail-value">{submitterName(selected.userId)}</div></div>
            <div className="detail-row"><div className="detail-label">説明</div><div className="detail-value">{selected.description}</div></div>
            {selected.memo && <div className="detail-row"><div className="detail-label">メモ</div><div className="detail-value">{selected.memo}</div></div>}
            <div className="detail-row">
              <div className="detail-label">明細</div>
              <div className="detail-value">
                {(selected.lineItems || []).map(li => (
                  <div key={li.id} style={{ marginBottom: '6px', fontSize: '13px' }}>
                    {db.categories.find(c => c.id === li.category)?.name} — ¥{(li.amount || 0).toLocaleString()}
                  </div>
                ))}
                <div style={{ fontWeight: '700', marginTop: '8px', color: 'var(--text-accent)' }}>
                  合計: ¥{(selected.amount || 0).toLocaleString()}
                </div>
              </div>
            </div>
            <div className="detail-row">
              <div className="detail-label">ステータス</div>
              <div className="detail-value"><span className={`status-badge status-${selected.status}`}>{getStatusLabel(selected.status)}</span></div>
            </div>
            {selected.receipt && (
              <div className="detail-row">
                <div className="detail-label">領収書</div>
                <div className="detail-value">
                  {selected.receipt.startsWith('data:image') ? (
                    <img src={selected.receipt} alt="receipt" style={{ maxWidth: '100%', maxHeight: '300px', borderRadius: '8px' }} />
                  ) : (
                    <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>ファイルあり</span>
                  )}
                </div>
              </div>
            )}
            {selected.approvalHistory.length > 0 && (
              <div className="approval-history">
                <div style={{ fontWeight: '700', marginBottom: '12px', fontSize: '13px', color: 'var(--text-secondary)' }}>承認履歴</div>
                {selected.approvalHistory.map((h, i) => (
                  <div key={i} className="history-item">
                    <div><strong>{actionLabel(h.action)}</strong> — {h.by}</div>
                    {h.comment && <div style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>{h.comment}</div>}
                    <div className="history-time">{new Date(h.at).toLocaleString('ja-JP')}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
