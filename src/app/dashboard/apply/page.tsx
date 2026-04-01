'use client';
import { useState, useRef, DragEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useDB } from '@/lib/db';
import { TAX_TYPES } from '@/data/mock';
import { LineItem } from '@/types';
import { getDriveSettings, uploadFileToDrive } from '@/lib/gdrive';

function genId() { return Math.random().toString(36).slice(2); }

// OCR: 領収書から金額を抽出
async function extractAmountFromImage(dataUrl: string): Promise<string> {
  try {
    const Tesseract = (await import('tesseract.js')).default;
    const result = await Tesseract.recognize(dataUrl, 'jpn+eng', {
      logger: () => {},
    });
    const text = result.data.text.slice(0, 800);
    const patterns = [
      /合計[^\d]*[¥￥\\]?\s*([\d,]+)/,
      /総額[^\d]*[¥￥\\]?\s*([\d,]+)/,
      /金額[^\d]*[¥￥\\]?\s*([\d,]+)/,
      /[¥￥\\]\s*([\d,]+)/,
      /(\d{1,3}(?:,\d{3})+)(?:\s*円)/,
      /(\d{4,})(?:\s*円|-)/,
    ];
    for (const p of patterns) {
      const m = text.match(p);
      if (m) return m[1].replace(/,/g, '');
    }
    return '';
  } catch {
    return '';
  }
}

interface ReceiptItem {
  id: string;
  file: File;
  dataUrl: string;
  ocrLoading: boolean;
  ocrAmount: string;
  ocrApplied: boolean;
}

export default function ApplyPage() {
  const { user } = useAuth();
  const db = useDB();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState('');
  const [memo, setMemo] = useState('');
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { id: genId(), category: db.categories[0]?.id || 1, amount: 0, taxType: 'tax_10' }
  ]);
  const [receipts, setReceipts] = useState<ReceiptItem[]>([]);
  const [dragging, setDragging] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);

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

  const applyOcrToLine = (receiptId: string, amount: string) => {
    // 空の明細行を探すか、なければ新規追加
    const emptyIdx = lineItems.findIndex(li => !li.amount || li.amount === 0);
    if (emptyIdx >= 0) {
      setLineItems(prev => prev.map((li, i) => i === emptyIdx ? { ...li, amount: Number(amount) } : li));
    } else {
      setLineItems(prev => [...prev, { id: genId(), category: db.categories[0]?.id || 1, amount: Number(amount), taxType: 'tax_10' }]);
    }
    setReceipts(prev => prev.map(r => r.id === receiptId ? { ...r, ocrApplied: true } : r));
  };

  const handleFileAdded = async (file: File) => {
    if (!file.type.startsWith('image/') && !file.type.includes('pdf')) return;
    if (receipts.length >= 10) { db.showToast('領収書は最大10枚です', 'error'); return; }

    const dataUrl = await new Promise<string>(resolve => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target?.result as string);
      reader.readAsDataURL(file);
    });

    const newReceipt: ReceiptItem = { id: genId(), file, dataUrl, ocrLoading: true, ocrAmount: '', ocrApplied: false };
    setReceipts(prev => [...prev, newReceipt]);

    // OCR実行（画像のみ）
    if (file.type.startsWith('image/')) {
      const amount = await extractAmountFromImage(dataUrl);
      setReceipts(prev => prev.map(r => r.id === newReceipt.id ? { ...r, ocrLoading: false, ocrAmount: amount } : r));
      // 金額が取れたら自動的に明細行に反映
      if (amount) {
        const emptyIdx = lineItems.findIndex(li => !li.amount || li.amount === 0);
        if (emptyIdx >= 0) {
          setLineItems(prev => prev.map((li, i) => i === emptyIdx ? { ...li, amount: Number(amount) } : li));
          setReceipts(prev => prev.map(r => r.id === newReceipt.id ? { ...r, ocrApplied: true } : r));
        }
      }
    } else {
      setReceipts(prev => prev.map(r => r.id === newReceipt.id ? { ...r, ocrLoading: false } : r));
    }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileAdded(file);
  };

  const buildDraft = () => {
    const maxId = db.expenses.reduce((m, e) => Math.max(m, e.id), 0);
    return {
      id: maxId + 1,
      userId: user!.id,
      date,
      category: lineItems[0]?.category || 1,
      amount: totalAmount,
      description,
      memo,
      taxType: lineItems[0]?.taxType || 'tax_10',
      status: 'draft',
      receipt: receipts[0]?.file.name || null,
      driveFileId: null,
      approvalHistory: [] as any[],
      lineItems,
      receipts: receipts.map(r => ({ filename: r.file.name, driveFileId: null })),
    };
  };

  const handleSubmit = async () => {
    if (!description.trim()) { db.showToast('説明を入力してください', 'error'); return; }
    if (totalAmount <= 0) { db.showToast('金額を入力してください', 'error'); return; }
    setSubmitting(true);

    // Google Drive アップロード
    const driveSettings = getDriveSettings();
    const uploadedReceipts: Array<{ filename: string; driveFileId: string | null }> = [];

    if (receipts.length > 0 && driveSettings) {
      db.showToast('Google Driveにアップロード中...', 'info');
      for (const r of receipts) {
        try {
          const result = await uploadFileToDrive(r.file, description);
          uploadedReceipts.push({ filename: r.file.name, driveFileId: result.id });
          db.showToast(`✓ ${r.file.name} をDriveにアップロードしました`, 'success');
        } catch (err: any) {
          db.showToast(`⚠ Drive upload失敗: ${err.message}`, 'error');
          uploadedReceipts.push({ filename: r.file.name, driveFileId: null });
        }
      }
    } else {
      receipts.forEach(r => uploadedReceipts.push({ filename: r.file.name, driveFileId: null }));
    }

    try {
      const maxId = db.expenses.reduce((m, e) => Math.max(m, e.id), 0);
      const expense = {
        id: maxId + 1,
        userId: user!.id,
        date,
        category: lineItems[0]?.category || 1,
        amount: totalAmount,
        description,
        memo,
        taxType: lineItems[0]?.taxType || 'tax_10',
        status: 'pending_manager',
        receipt: uploadedReceipts[0]?.filename || null,
        driveFileId: uploadedReceipts[0]?.driveFileId || null,
        approvalHistory: [
          { action: 'submitted', by: user!.name, at: new Date().toISOString(), comment: '' }
        ],
        lineItems,
        receipts: uploadedReceipts,
      };
      await db.upsertExpense(expense);
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
      await db.upsertExpense(buildDraft());
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
          {lineItems.map((li) => (
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
          <label className="form-label">
            領収書
            <span style={{ fontSize: '11px', fontWeight: '400', marginLeft: '8px', textTransform: 'none', letterSpacing: 0,
              color: getDriveSettings() ? 'var(--success-color)' : 'var(--text-secondary)' }}>
              {getDriveSettings() ? '✓ Google Driveに自動アップロード' : '※ 画像アップロードでOCR金額読取'}
            </span>
          </label>

          {/* Drop zone */}
          <div
            className={`drag-drop-area${dragging ? ' active' : ''}`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
          >
            <p style={{ fontSize: '24px', marginBottom: '8px' }}>📎</p>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
              クリックまたはドラッグ&ドロップで領収書を追加
            </p>
            <p style={{ color: 'var(--text-secondary)', fontSize: '11px', marginTop: '4px', opacity: 0.6 }}>
              JPG・PNG・PDF（最大10枚）
            </p>
          </div>
          <input
            ref={fileInputRef} type="file" accept="image/*,.pdf" multiple
            style={{ display: 'none' }}
            onChange={e => { Array.from(e.target.files || []).forEach(handleFileAdded); }}
          />

          {/* Receipt previews */}
          {receipts.length > 0 && (
            <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {receipts.map(r => (
                <div key={r.id} style={{
                  border: '1px solid var(--border)', borderRadius: '12px', padding: '14px',
                  background: 'var(--bg-alt)', display: 'flex', gap: '14px', alignItems: 'flex-start'
                }}>
                  {/* Image thumbnail */}
                  {r.file.type.startsWith('image/') ? (
                    <img
                      src={r.dataUrl} alt="receipt"
                      style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '8px', border: '1px solid var(--border)', cursor: 'pointer', flexShrink: 0 }}
                      onClick={() => { const w = window.open('', '_blank'); if (w) { w.document.write(`<img src="${r.dataUrl}" style="max-width:100%;"/>`); w.document.close(); } }}
                    />
                  ) : (
                    <div style={{ width: '80px', height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '28px', flexShrink: 0 }}>📄</div>
                  )}

                  {/* OCR info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.file.name}
                    </p>

                    {r.ocrLoading ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '12px' }}>
                        <span className="loading" style={{ width: '12px', height: '12px' }}></span>
                        OCR読取中...
                      </div>
                    ) : r.ocrAmount ? (
                      <div>
                        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                          OCR読取金額：
                          <strong style={{ color: 'var(--text-accent)', fontSize: '14px', marginLeft: '4px' }}>
                            ¥{Number(r.ocrAmount).toLocaleString()}
                          </strong>
                        </p>
                        {r.ocrApplied ? (
                          <span style={{ fontSize: '12px', color: 'var(--success-color)', fontWeight: '600' }}>✓ 明細に反映済み</span>
                        ) : (
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => applyOcrToLine(r.id, r.ocrAmount)}
                            style={{ fontSize: '12px', padding: '5px 12px' }}
                          >
                            ↓ 明細に金額を反映
                          </button>
                        )}
                      </div>
                    ) : (
                      <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                        {r.file.type.startsWith('image/') ? '金額を自動読取できませんでした' : 'PDFはOCR非対応'}
                      </p>
                    )}
                  </div>

                  {/* Remove button */}
                  <button
                    onClick={() => setReceipts(prev => prev.filter(x => x.id !== r.id))}
                    style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '18px', padding: '0', lineHeight: 1, flexShrink: 0 }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
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
