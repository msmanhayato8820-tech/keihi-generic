'use client';
import { useState, useRef, DragEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useDB } from '@/lib/db';
import { TAX_TYPES } from '@/data/mock';
import { LineItem } from '@/types';

function genId() { return Math.random().toString(36).slice(2); }

export default function ApplyPage() {
  const { user } = useAuth();
  const db = useDB();
  const router = useRouter();

  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState('');
  const [memo, setMemo] = useState('');
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { id: genId(), category: db.categories[0]?.id || 1, amount: 0, taxType: 'tax_10' }
  ]);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!user) return null;

  const totalAmount = lineItems.reduce((s, li) => s + (Number(li.amount) || 0), 0);

  const addLineItem = () => {
    setLineItems(prev => [...prev, { id: genId(), category: db.categories[0]?.id || 1, amount: 0, taxType: 'tax_10' }]);
  };

  const removeLineItem = (id: string) => {
    if (lineItems.length <= 1) return;
    setLineItems(prev => prev.filter(li => li.id !== id));
  };

  const updateLineItem = (id: string, field: keyof LineItem, value: string | number) => {
    setLineItems(prev => prev.map(li => li.id === id ? { ...li, [field]: value } : li));
  };

  const handleFileChange = (file: File | null) => {
    if (!file) return;
    setReceiptFile(file);
    const reader = new FileReader();
    reader.onload = e => setReceiptPreview(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileChange(file);
  };

  const buildExpense = (status: string) => {
    const maxId = db.expenses.reduce((m, e) => Math.max(m, e.id), 0);
    return {
      id: maxId + 1,
      userId: user.id,
      date,
      category: lineItems[0]?.category || 1,
      amount: totalAmount,
      description,
      memo,
      taxType: lineItems[0]?.taxType || 'tax_10',
      status,
      receipt: receiptPreview || null,
      driveFileId: null,
      approvalHistory: status === 'draft' ? [] : [
        { action: 'submitted', by: user.name, at: new Date().toISOString(), comment: '' }
      ],
      lineItems,
    };
  };

  const handleSubmit = async () => {
    if (!description.trim()) { db.showToast('説明を入力してください', 'error'); return; }
    if (totalAmount <= 0) { db.showToast('金額を入力してください', 'error'); return; }
    setSubmitting(true);
    try {
      await db.upsertExpense(buildExpense('pending_manager'));
      db.showToast('申請を提出しました', 'success');
      router.push('/dashboard/list');
    } catch {
      db.showToast('エラーが発生しました', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveDraft = async () => {
    setSavingDraft(true);
    try {
      await db.upsertExpense(buildExpense('draft'));
      db.showToast('下書きを保存しました', 'success');
      router.push('/dashboard/list');
    } catch {
      db.showToast('エラーが発生しました', 'error');
    } finally {
      setSavingDraft(false);
    }
  };

  return (
    <div>
      <h1 className="page-title">経費申請</h1>

      <div style={{ background: 'var(--bg-card)', backdropFilter: 'var(--glass-blur)', border: '1px solid var(--border)', borderRadius: '16px', padding: '28px', marginBottom: '20px' }}>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">申請日</label>
            <input type="date" className="form-control" value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">合計金額</label>
            <div style={{ padding: '12px 16px', background: 'var(--bg-alt)', border: '1px solid var(--border)', borderRadius: '10px', fontSize: '18px', fontWeight: '800', color: 'var(--text-accent)' }}>
              ¥{totalAmount.toLocaleString()}
            </div>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">説明・件名</label>
          <input type="text" className="form-control" value={description} onChange={e => setDescription(e.target.value)} placeholder="例：大阪出張 交通費" />
        </div>

        <div className="form-group">
          <label className="form-label">メモ・備考</label>
          <textarea className="form-control" value={memo} onChange={e => setMemo(e.target.value)} rows={2} placeholder="任意のメモを入力" style={{ resize: 'vertical' }} />
        </div>

        {/* Line items */}
        <div className="form-group">
          <label className="form-label">明細</label>
          {lineItems.map((li, idx) => (
            <div key={li.id} className="line-item-row">
              <div>
                <select className="form-control" value={li.category} onChange={e => updateLineItem(li.id, 'category', Number(e.target.value))}>
                  {db.categories.map(c => (
                    <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <input
                  type="number" className="form-control"
                  value={li.amount || ''} min={0}
                  onChange={e => updateLineItem(li.id, 'amount', Number(e.target.value))}
                  placeholder="金額"
                />
              </div>
              <div>
                <select className="form-control" value={li.taxType} onChange={e => updateLineItem(li.id, 'taxType', e.target.value)}>
                  {TAX_TYPES.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <button
                className="btn btn-danger btn-sm"
                onClick={() => removeLineItem(li.id)}
                disabled={lineItems.length <= 1}
                style={{ whiteSpace: 'nowrap' }}
              >
                削除
              </button>
            </div>
          ))}
          <button className="btn btn-secondary btn-sm" onClick={addLineItem} style={{ marginTop: '8px' }}>
            + 明細追加
          </button>
        </div>

        {/* Receipt upload */}
        <div className="form-group">
          <label className="form-label">領収書</label>
          <div
            className="drag-drop-area"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            style={{ borderColor: dragging ? 'rgba(59,130,246,.6)' : undefined }}
          >
            {receiptPreview ? (
              <div>
                {receiptFile?.type?.startsWith('image/') ? (
                  <img src={receiptPreview} alt="receipt" style={{ maxHeight: '200px', maxWidth: '100%', borderRadius: '8px', margin: '0 auto', display: 'block' }} />
                ) : (
                  <p style={{ color: 'var(--text-secondary)' }}>📎 {receiptFile?.name}</p>
                )}
                <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '8px' }}>クリックで変更</p>
              </div>
            ) : (
              <div>
                <p style={{ fontSize: '24px', marginBottom: '8px' }}>📎</p>
                <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                  クリックまたはドラッグ&ドロップで領収書をアップロード
                </p>
                <p style={{ color: 'var(--text-secondary)', fontSize: '11px', marginTop: '4px', opacity: 0.6 }}>
                  JPG, PNG, PDF対応
                </p>
              </div>
            )}
          </div>
          <input
            ref={fileInputRef} type="file" accept="image/*,.pdf"
            style={{ display: 'none' }}
            onChange={e => handleFileChange(e.target.files?.[0] || null)}
          />
          {receiptFile && (
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '6px' }}>
              ✓ {receiptFile.name} ({(receiptFile.size / 1024).toFixed(1)} KB)
            </p>
          )}
        </div>

        <div className="button-group">
          <button className="btn btn-secondary" onClick={handleSaveDraft} disabled={savingDraft}>
            {savingDraft ? '保存中...' : '下書き保存'}
          </button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting} style={{ width: 'auto', flex: 1 }}>
            {submitting ? '提出中...' : '申請を提出'}
          </button>
        </div>
      </div>
    </div>
  );
}
