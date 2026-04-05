'use client';
import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useDB } from '@/lib/db';
import { Expense } from '@/types';
import { exportCsv, exportMF, exportFreee, exportYayoi } from '@/lib/export';
import { getStatusLabel, actionLabel } from '@/lib/expense';

const STATUS_OPTIONS = [
  { value: '', label: 'すべて' },
  { value: 'draft', label: '下書き' },
  { value: 'pending_manager', label: '部長承認待' },
  { value: 'pending_accountant', label: '経理承認待' },
  { value: 'approved', label: '承認済' },
  { value: 'rejected', label: '却下' },
];

function formatDate(s: string): string { return s ? s.slice(0, 10) : '-'; }

type SortKey = 'date' | 'amount' | 'description';

const PAGE_SIZE = 10;

export default function ListPage() {
  const { user } = useAuth();
  const db = useDB();
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [search, setSearch] = useState('');
  const [amountMin, setAmountMin] = useState('');
  const [amountMax, setAmountMax] = useState('');
  const [paidFilter, setPaidFilter] = useState(''); // '' | 'paid' | 'unpaid'
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortAsc, setSortAsc] = useState(false);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Expense | null>(null);

  if (!user) return null;

  const base = user.role === 'admin' ? db.expenses : db.expenses.filter(e => e.userId === user.id);
  const filtered = base.filter(e => {
    if (statusFilter && e.status !== statusFilter) return false;
    if (categoryFilter && String(e.category) !== categoryFilter) return false;
    if (dateFrom && e.date < dateFrom) return false;
    if (dateTo && e.date > dateTo) return false;
    if (search && !e.description.toLowerCase().includes(search.toLowerCase())) return false;
    if (amountMin && (e.amount || 0) < Number(amountMin)) return false;
    if (amountMax && (e.amount || 0) > Number(amountMax)) return false;
    if (paidFilter === 'paid' && !e.isPaid) return false;
    if (paidFilter === 'unpaid' && e.isPaid) return false;
    return true;
  }).sort((a, b) => {
    let cmp = 0;
    if (sortKey === 'date') cmp = new Date(a.date).getTime() - new Date(b.date).getTime();
    else if (sortKey === 'amount') cmp = (a.amount || 0) - (b.amount || 0);
    else if (sortKey === 'description') cmp = a.description.localeCompare(b.description);
    return sortAsc ? cmp : -cmp;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const submitterName = (userId: number) => db.users.find(u => u.id === userId)?.name || `ID:${userId}`;

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  };

  const sortIcon = (key: SortKey) => sortKey === key ? (sortAsc ? ' ↑' : ' ↓') : '';

  const togglePaid = async (expense: Expense) => {
    const newPaid = !expense.isPaid;
    await db.upsertExpense({
      ...expense,
      isPaid: newPaid,
      paidAt: newPaid ? new Date().toISOString() : undefined,
      paidBy: newPaid ? user!.name : undefined,
      updatedAt: new Date().toISOString(),
    });
    db.showToast(newPaid ? '精算済みにしました' : '未精算に戻しました', 'success');
  };

  const handleExportCsv = () => exportCsv(filtered, db.categories, submitterName);
  const handleExportMF = () => exportMF(filtered);
  const handleExportFreee = () => exportFreee(filtered);
  const handleExportYayoi = () => exportYayoi(filtered);

  return (
    <div>
      <h1 className="page-title">申請一覧</h1>

      {/* Filters */}
      <div style={{ background: 'var(--bg-card)', backdropFilter: 'var(--glass-blur)', border: '1px solid var(--border)', borderRadius: '16px', padding: '20px', marginBottom: '20px' }}>
        {/* Search */}
        <div className="form-group" style={{ marginBottom: '12px' }}>
          <input type="text" className="form-control" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="🔍 説明・件名で検索..." />
        </div>
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
          <div>
            <label className="form-label">金額範囲</label>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <input type="number" className="form-control" value={amountMin} onChange={e => { setAmountMin(e.target.value); setPage(1); }} placeholder="¥下限" style={{ flex: 1 }} />
              <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>〜</span>
              <input type="number" className="form-control" value={amountMax} onChange={e => { setAmountMax(e.target.value); setPage(1); }} placeholder="¥上限" style={{ flex: 1 }} />
            </div>
          </div>
          {(user.role === 'admin' || user.role === 'accountant') && (
            <div>
              <label className="form-label">精算状況</label>
              <select className="form-control" value={paidFilter} onChange={e => { setPaidFilter(e.target.value); setPage(1); }}>
                <option value="">すべて</option>
                <option value="unpaid">未精算</option>
                <option value="paid">精算済み</option>
              </select>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
            {filtered.length}件 / 全{base.length}件
            {filtered.length > 0 && ` ・ 合計 ¥${filtered.reduce((s, e) => s + (e.amount || 0), 0).toLocaleString()}`}
            {filtered.length > 0 && (user.role === 'admin' || user.role === 'accountant') && (() => {
              const unpaid = filtered.filter(e => e.status === 'approved' && !e.isPaid);
              return unpaid.length > 0 ? ` ・ 未精算 ${unpaid.length}件 ¥${unpaid.reduce((s, e) => s + (e.amount || 0), 0).toLocaleString()}` : '';
            })()}
          </p>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <button className="btn btn-secondary btn-sm" onClick={handleExportCsv}>📊 CSV</button>
            {(user.role === 'admin' || user.role === 'accountant') && <>
              <button className="btn btn-secondary btn-sm" onClick={handleExportMF}>💰 MF</button>
              <button className="btn btn-secondary btn-sm" onClick={handleExportFreee}>📗 freee</button>
              <button className="btn btn-secondary btn-sm" onClick={handleExportYayoi}>📘 弥生</button>
            </>}
          </div>
        </div>
      </div>

      <div className="table-card">
        <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th onClick={() => handleSort('date')} style={{ cursor: 'pointer' }}>日付{sortIcon('date')}</th>
              {user.role === 'admin' && <th>申請者</th>}
              <th>カテゴリ</th>
              <th onClick={() => handleSort('description')} style={{ cursor: 'pointer' }}>説明{sortIcon('description')}</th>
              <th onClick={() => handleSort('amount')} style={{ cursor: 'pointer' }}>金額{sortIcon('amount')}</th>
              <th>ステータス</th>
              {(user.role === 'admin' || user.role === 'accountant') && <th style={{ textAlign: 'center' }}>精算</th>}
              <th></th>
            </tr>
          </thead>
          <tbody>
            {paged.length === 0 ? (
              <tr><td colSpan={99} className="no-data">申請がありません</td></tr>
            ) : paged.map(e => (
              <tr key={e.id} style={e.isPaid ? { opacity: 0.6 } : {}}>
                <td>{formatDate(e.date)}</td>
                {user.role === 'admin' && <td style={{ fontSize: '12px' }}>{submitterName(e.userId)}</td>}
                <td>{db.categories.find(c => c.id === e.category)?.icon} {db.categories.find(c => c.id === e.category)?.name || '-'}</td>
                <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.description}</td>
                <td>¥{(e.amount || 0).toLocaleString()}</td>
                <td><span className={`status-badge status-${e.status}`}>{getStatusLabel(e.status)}</span></td>
                {(user.role === 'admin' || user.role === 'accountant') && (
                  <td style={{ textAlign: 'center' }}>
                    {e.status === 'approved' ? (
                      <input type="checkbox" checked={!!e.isPaid} onChange={() => togglePaid(e)}
                        title={e.isPaid ? `精算済み (${e.paidAt ? new Date(e.paidAt).toLocaleDateString('ja-JP') : ''})` : '未精算 — クリックで精算済みに'}
                        style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#10b981' }} />
                    ) : <span style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>—</span>}
                  </td>
                )}
                <td><button className="btn btn-secondary btn-sm" onClick={() => setSelected(e)}>詳細</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        <div className="pagination">
          <button className="pagination-btn" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>前へ</button>
          <span className="pagination-info">{page} / {totalPages}</span>
          <button className="pagination-btn" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>次へ</button>
        </div>
      </div>

      {/* Detail Modal with Timeline */}
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
                <div style={{ fontWeight: '700', marginTop: '8px', color: 'var(--text-accent)' }}>合計: ¥{(selected.amount || 0).toLocaleString()}</div>
              </div>
            </div>
            {/* 領収書リンク */}
            {(selected.receipts && selected.receipts.length > 0) && (
              <div className="detail-row">
                <div className="detail-label">領収書</div>
                <div className="detail-value">
                  {selected.receipts.map((r, i) => (
                    <div key={i} style={{ marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '13px' }}>📎 {r.filename}</span>
                      {r.driveFileId && (
                        <a href={`https://drive.google.com/file/d/${r.driveFileId}/view`} target="_blank" rel="noopener noreferrer"
                          style={{ fontSize: '12px', color: 'var(--text-accent)', textDecoration: 'none', padding: '2px 8px', background: 'rgba(59,130,246,0.1)', borderRadius: '6px' }}>
                          開く →
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {/* 電帳法タイムスタンプ */}
            {selected.createdAt && (
              <div className="detail-row">
                <div className="detail-label">保存日時</div>
                <div className="detail-value" style={{ fontSize: '12px', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                  作成: {new Date(selected.createdAt).toLocaleString('ja-JP')}
                  {selected.updatedAt && selected.updatedAt !== selected.createdAt && (
                    <span style={{ marginLeft: '12px' }}>更新: {new Date(selected.updatedAt).toLocaleString('ja-JP')}</span>
                  )}
                </div>
              </div>
            )}
            <div className="detail-row">
              <div className="detail-label">インボイス</div>
              <div className="detail-value">
                {selected.isQualifiedInvoice !== false ? (
                  <span style={{ fontSize: '12px', color: '#10b981', fontWeight: '700', background: 'rgba(16,185,129,0.1)', padding: '3px 10px', borderRadius: '6px', border: '1px solid rgba(16,185,129,0.3)' }}>✓ 適格請求書</span>
                ) : (
                  <span style={{ fontSize: '12px', color: '#f59e0b', fontWeight: '700', background: 'rgba(245,158,11,0.1)', padding: '3px 10px', borderRadius: '6px', border: '1px solid rgba(245,158,11,0.3)' }}>△ 非適格（経過措置対象）</span>
                )}
                {selected.invoiceNumber && (
                  <span style={{ fontFamily: 'monospace', fontSize: '13px', color: 'var(--text-accent)', marginLeft: '10px' }}>
                    {selected.invoiceNumber}
                    <a href={`https://www.invoice-kohyo.nta.go.jp/regno-search/detail?selRegNo=${selected.invoiceNumber}`} target="_blank" rel="noopener noreferrer"
                      style={{ fontSize: '11px', color: 'var(--text-secondary)', marginLeft: '6px' }}>確認→</a>
                  </span>
                )}
              </div>
            </div>
            {/* 精算状況 */}
            {selected.status === 'approved' && (
              <div className="detail-row">
                <div className="detail-label">精算状況</div>
                <div className="detail-value">
                  {selected.isPaid ? (
                    <div>
                      <span style={{ fontSize: '12px', color: '#10b981', fontWeight: '700', background: 'rgba(16,185,129,0.1)', padding: '3px 10px', borderRadius: '6px', border: '1px solid rgba(16,185,129,0.3)' }}>✓ 精算済み</span>
                      {selected.paidAt && <span style={{ fontSize: '11px', color: 'var(--text-secondary)', marginLeft: '8px' }}>{new Date(selected.paidAt).toLocaleDateString('ja-JP')}</span>}
                      {selected.paidBy && <span style={{ fontSize: '11px', color: 'var(--text-secondary)', marginLeft: '4px' }}>({selected.paidBy})</span>}
                    </div>
                  ) : (
                    <span style={{ fontSize: '12px', color: '#f59e0b', fontWeight: '700', background: 'rgba(245,158,11,0.1)', padding: '3px 10px', borderRadius: '6px', border: '1px solid rgba(245,158,11,0.3)' }}>未精算（立替中）</span>
                  )}
                </div>
              </div>
            )}
            <div className="detail-row">
              <div className="detail-label">ステータス</div>
              <div className="detail-value"><span className={`status-badge status-${selected.status}`}>{getStatusLabel(selected.status)}</span></div>
            </div>

            {/* Visual Timeline */}
            {selected.approvalHistory.length > 0 && (
              <div style={{ margin: '20px 0' }}>
                <div style={{ fontWeight: '700', marginBottom: '12px', fontSize: '13px', color: 'var(--text-secondary)' }}>承認フロー</div>
                <div style={{ position: 'relative', paddingLeft: '20px' }}>
                  <div style={{ position: 'absolute', left: '8px', top: '4px', bottom: '4px', width: '2px', background: 'var(--border)' }} />
                  {selected.approvalHistory.map((h, i) => (
                    <div key={i} style={{ position: 'relative', marginBottom: '16px', paddingLeft: '20px' }}>
                      <div style={{
                        position: 'absolute', left: '-14px', top: '2px', width: '12px', height: '12px', borderRadius: '50%',
                        background: h.action === 'rejected' ? '#ef4444' : h.action.includes('approved') ? '#10b981' : '#3b82f6',
                        border: '2px solid var(--bg-card)',
                      }} />
                      <div>
                        <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)' }}>{actionLabel(h.action)}</span>
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)', marginLeft: '8px' }}>{h.by}</span>
                      </div>
                      {h.comment && <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>{h.comment}</p>}
                      <p style={{ fontSize: '11px', color: 'var(--text-secondary)', opacity: 0.6, marginTop: '2px' }}>{new Date(h.at).toLocaleString('ja-JP')}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
