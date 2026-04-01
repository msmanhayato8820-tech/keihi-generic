'use client';
import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useDB } from '@/lib/db';
import { Expense } from '@/types';

function getStatusLabel(status: string) {
  const m: Record<string, string> = {
    draft: '下書き', pending_manager: '部長承認待', pending_accountant: '経理承認待',
    approved: '承認済', rejected: '却下',
  };
  return m[status] || status;
}

function actionLabel(action: string) {
  const m: Record<string, string> = {
    submitted: '申請', approved_manager: '部長承認', approved_accountant: '経理承認', rejected: '却下',
  };
  return m[action] || action;
}

export default function ApprovalPage() {
  const { user } = useAuth();
  const db = useDB();
  const [selected, setSelected] = useState<Expense | null>(null);
  const [comment, setComment] = useState('');
  const [processing, setProcessing] = useState(false);

  if (!user) return null;

  const canApprove =
    (user.role === 'manager' || user.role === 'admin') ||
    user.role === 'accountant';

  const pendingExpenses = db.expenses.filter(e => {
    if (user.role === 'manager' || user.role === 'admin') {
      return e.status === 'pending_manager';
    }
    if (user.role === 'accountant') {
      return e.status === 'pending_accountant';
    }
    return false;
  });

  const submitterName = (userId: number) => db.users.find(u => u.id === userId)?.name || `ID:${userId}`;

  const handleApprove = async () => {
    if (!selected || !user) return;
    setProcessing(true);
    try {
      const nextStatus = user.role === 'manager' || user.role === 'admin'
        ? 'pending_accountant'
        : 'approved';
      const action = user.role === 'manager' || user.role === 'admin'
        ? 'approved_manager'
        : 'approved_accountant';

      const updated: Expense = {
        ...selected,
        status: nextStatus,
        approvalHistory: [
          ...selected.approvalHistory,
          { action, by: user.name, at: new Date().toISOString(), comment: comment.trim() }
        ]
      };
      await db.upsertExpense(updated);
      db.showToast('承認しました', 'success');
      setSelected(null);
      setComment('');
    } catch {
      db.showToast('エラーが発生しました', 'error');
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!selected || !user) return;
    if (!comment.trim()) { db.showToast('却下理由を入力してください', 'error'); return; }
    setProcessing(true);
    try {
      const updated: Expense = {
        ...selected,
        status: 'rejected',
        approvalHistory: [
          ...selected.approvalHistory,
          { action: 'rejected', by: user.name, at: new Date().toISOString(), comment: comment.trim() }
        ]
      };
      await db.upsertExpense(updated);
      db.showToast('却下しました', 'info');
      setSelected(null);
      setComment('');
    } catch {
      db.showToast('エラーが発生しました', 'error');
    } finally {
      setProcessing(false);
    }
  };

  const roleLabel = user.role === 'accountant' ? '経理' : '部長';

  return (
    <div>
      <h1 className="page-title">承認</h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '20px' }}>
        {roleLabel}として承認待ちの申請が {pendingExpenses.length} 件あります
      </p>

      {!canApprove ? (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px', padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
          承認権限がありません
        </div>
      ) : (
        <div className="table-card">
          <table>
            <thead>
              <tr>
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
                <tr><td colSpan={7} className="no-data">承認待ちの申請はありません</td></tr>
              ) : pendingExpenses.map(e => (
                <tr key={e.id}>
                  <td>{e.date}</td>
                  <td>{submitterName(e.userId)}</td>
                  <td>{db.categories.find(c => c.id === e.category)?.icon} {db.categories.find(c => c.id === e.category)?.name}</td>
                  <td style={{ maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.description}</td>
                  <td>¥{(e.amount || 0).toLocaleString()}</td>
                  <td><span className={`status-badge status-${e.status}`}>{getStatusLabel(e.status)}</span></td>
                  <td>
                    <button className="btn btn-secondary btn-sm" onClick={() => { setSelected(e); setComment(''); }}>
                      確認・承認
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
            <div className="detail-row">
              <div className="detail-label">明細</div>
              <div className="detail-value">
                {(selected.lineItems || []).map(li => (
                  <div key={li.id} style={{ marginBottom: '6px', fontSize: '13px' }}>
                    {db.categories.find(c => c.id === li.category)?.name} — ¥{(li.amount || 0).toLocaleString()}
                  </div>
                ))}
                <div style={{ fontWeight: '700', marginTop: '8px', color: 'var(--text-accent)', fontSize: '16px' }}>
                  合計: ¥{(selected.amount || 0).toLocaleString()}
                </div>
              </div>
            </div>

            {selected.receipt && (
              <div className="detail-row">
                <div className="detail-label">領収書</div>
                <div className="detail-value">
                  {selected.receipt.startsWith('data:image') ? (
                    <img src={selected.receipt} alt="receipt" style={{ maxWidth: '100%', maxHeight: '200px', borderRadius: '8px' }} />
                  ) : (
                    <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>ファイルあり</span>
                  )}
                </div>
              </div>
            )}

            {selected.approvalHistory.length > 0 && (
              <div className="approval-history" style={{ marginBottom: '20px' }}>
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

            <div className="comment-area">
              <label className="form-label">コメント（却下時は必須）</label>
              <textarea
                className="comment-field"
                value={comment}
                onChange={e => setComment(e.target.value)}
                placeholder="承認・却下の理由やコメントを入力..."
              />
            </div>

            <div className="button-group">
              <button className="btn btn-danger" onClick={handleReject} disabled={processing}>
                却下
              </button>
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
