'use client';
import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useDB } from '@/lib/db';
import { Expense } from '@/types';
import { getStatusLabel, actionLabel } from '@/lib/expense';

export default function ApprovalPage() {
  const { user } = useAuth();
  const db = useDB();
  const [selected, setSelected] = useState<Expense | null>(null);
  const [comment, setComment] = useState('');
  const [processing, setProcessing] = useState(false);
  const [checkedIds, setCheckedIds] = useState<Set<number>>(new Set());
  const [bulkProcessing, setBulkProcessing] = useState(false);

  if (!user) return null;

  const canApprove = user.role === 'manager' || user.role === 'admin' || user.role === 'accountant';

  const pendingExpenses = db.expenses.filter(e => {
    if (user.role === 'manager' || user.role === 'admin') return e.status === 'pending_manager';
    if (user.role === 'accountant') return e.status === 'pending_accountant';
    return false;
  });

  const submitterName = (userId: number) => db.users.find(u => u.id === userId)?.name || `ID:${userId}`;

  const toggleCheck = (id: number) => {
    setCheckedIds(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  };
  const toggleAll = () => {
    if (checkedIds.size === pendingExpenses.length) setCheckedIds(new Set());
    else setCheckedIds(new Set(pendingExpenses.map(e => e.id)));
  };

  const handleApprove = async () => {
    if (!selected || !user) return;
    setProcessing(true);
    try {
      const nextStatus = (user.role === 'manager' || user.role === 'admin') ? 'pending_accountant' : 'approved';
      const action = (user.role === 'manager' || user.role === 'admin') ? 'approved_manager' : 'approved_accountant';
      await db.upsertExpense({
        ...selected, status: nextStatus,
        approvalHistory: [...selected.approvalHistory, { action, by: user.name, at: new Date().toISOString(), comment: comment.trim() }],
      });
      db.showToast('承認しました', 'success');
      setSelected(null); setComment('');
    } catch { db.showToast('エラーが発生しました', 'error'); }
    finally { setProcessing(false); }
  };

  const handleReject = async () => {
    if (!selected || !user) return;
    if (!comment.trim()) { db.showToast('却下理由を入力してください', 'error'); return; }
    setProcessing(true);
    try {
      await db.upsertExpense({
        ...selected, status: 'rejected',
        approvalHistory: [...selected.approvalHistory, { action: 'rejected', by: user.name, at: new Date().toISOString(), comment: comment.trim() }],
      });
      db.showToast('却下しました', 'info');
      setSelected(null); setComment('');
    } catch { db.showToast('エラーが発生しました', 'error'); }
    finally { setProcessing(false); }
  };

  const handleBulkApprove = async () => {
    if (checkedIds.size === 0) return;
    setBulkProcessing(true);
    const nextStatus = (user.role === 'manager' || user.role === 'admin') ? 'pending_accountant' : 'approved';
    const action = (user.role === 'manager' || user.role === 'admin') ? 'approved_manager' : 'approved_accountant';
    let count = 0;
    for (const id of checkedIds) {
      const expense = pendingExpenses.find(e => e.id === id);
      if (!expense) continue;
      try {
        await db.upsertExpense({
          ...expense, status: nextStatus,
          approvalHistory: [...expense.approvalHistory, { action, by: user.name, at: new Date().toISOString(), comment: '一括承認' }],
        });
        count++;
      } catch {}
    }
    db.showToast(`${count}件を一括承認しました`, 'success');
    setCheckedIds(new Set());
    setBulkProcessing(false);
  };

  const roleLabel = user.role === 'accountant' ? '経理' : '部長';
  const totalCheckedAmt = pendingExpenses.filter(e => checkedIds.has(e.id)).reduce((s, e) => s + (e.amount || 0), 0);

  return (
    <div>
      <h1 className="page-title">承認</h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '20px' }}>
        {roleLabel}として承認待ちの申請が {pendingExpenses.length} 件あります
      </p>

      {/* Bulk actions */}
      {checkedIds.size > 0 && (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px 18px', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
          <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>
            <strong>{checkedIds.size}件</strong> 選択中（合計 ¥{totalCheckedAmt.toLocaleString()}）
          </span>
          <button className="btn btn-success btn-sm" onClick={handleBulkApprove} disabled={bulkProcessing}>
            {bulkProcessing ? '処理中...' : `✓ ${checkedIds.size}件を一括承認`}
          </button>
        </div>
      )}

      {!canApprove ? (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px', padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
          承認権限がありません
        </div>
      ) : (
        <div className="table-card">
          <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th style={{ width: '40px' }}>
                  <input type="checkbox" checked={checkedIds.size === pendingExpenses.length && pendingExpenses.length > 0} onChange={toggleAll} />
                </th>
                <th>日付</th>
                <th>申請者</th>
                <th>カテゴリ</th>
                <th>説明</th>
                <th>金額</th>
                <th>ステータス</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {pendingExpenses.length === 0 ? (
                <tr><td colSpan={8} className="no-data">承認待ちの申請はありません</td></tr>
              ) : pendingExpenses.map(e => (
                <tr key={e.id}>
                  <td><input type="checkbox" checked={checkedIds.has(e.id)} onChange={() => toggleCheck(e.id)} /></td>
                  <td>{e.date}</td>
                  <td>{submitterName(e.userId)}</td>
                  <td>{db.categories.find(c => c.id === e.category)?.icon} {db.categories.find(c => c.id === e.category)?.name}</td>
                  <td style={{ maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.description}</td>
                  <td>¥{(e.amount || 0).toLocaleString()}</td>
                  <td><span className={`status-badge status-${e.status}`}>{getStatusLabel(e.status)}</span></td>
                  <td><button className="btn btn-secondary btn-sm" onClick={() => { setSelected(e); setComment(''); }}>確認・承認</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {/* Approval Modal */}
      {selected && (
        <div className="modal" onClick={e => { if (e.target === e.currentTarget) { setSelected(null); setComment(''); } }}>
          <div className="modal-content">
            <button className="modal-close" onClick={() => { setSelected(null); setComment(''); }}>×</button>
            <h2 className="modal-title">申請確認・承認</h2>

            <div className="detail-row"><div className="detail-label">申請日</div><div className="detail-value">{selected.date}</div></div>
            <div className="detail-row"><div className="detail-label">申請者</div><div className="detail-value">{submitterName(selected.userId)}</div></div>
            <div className="detail-row"><div className="detail-label">説明</div><div className="detail-value">{selected.description}</div></div>
            {selected.memo && <div className="detail-row"><div className="detail-label">メモ</div><div className="detail-value">{selected.memo}</div></div>}
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
            <div className="detail-row">
              <div className="detail-label">明細</div>
              <div className="detail-value">
                {(selected.lineItems || []).map(li => (
                  <div key={li.id} style={{ marginBottom: '6px', fontSize: '13px' }}>
                    {db.categories.find(c => c.id === li.category)?.name} — ¥{(li.amount || 0).toLocaleString()}
                  </div>
                ))}
                <div style={{ fontWeight: '700', marginTop: '8px', color: 'var(--text-accent)', fontSize: '16px' }}>合計: ¥{(selected.amount || 0).toLocaleString()}</div>
              </div>
            </div>

            {/* Visual timeline */}
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
                  {/* Current step */}
                  <div style={{ position: 'relative', paddingLeft: '20px' }}>
                    <div style={{ position: 'absolute', left: '-14px', top: '2px', width: '12px', height: '12px', borderRadius: '50%', background: 'var(--border)', border: '2px dashed var(--text-secondary)' }} />
                    <span style={{ fontSize: '12px', color: 'var(--text-accent)', fontWeight: '600' }}>← 現在のステップ（{roleLabel}承認）</span>
                  </div>
                </div>
              </div>
            )}

            <div className="comment-area">
              <label className="form-label">コメント（却下時は必須）</label>
              <textarea className="comment-field" value={comment} onChange={e => setComment(e.target.value)} placeholder="承認・却下の理由やコメントを入力..." />
            </div>
            <div className="button-group">
              <button className="btn btn-danger" onClick={handleReject} disabled={processing}>却下</button>
              <button className="btn btn-success" onClick={handleApprove} disabled={processing} style={{ flex: 1 }}>
                {processing ? '処理中...' : '承認'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
