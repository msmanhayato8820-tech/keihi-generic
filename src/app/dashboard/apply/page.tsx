'use client';
import { useState, useRef, DragEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useDB } from '@/lib/db';
import { TAX_TYPES, DEFAULT_TEMPLATES, EXPENSE_POLICIES, DEFAULT_APPROVAL_RULES, COMMON_ROUTES } from '@/data/mock';
import { LineItem } from '@/types';
import { getActiveProvider, uploadFile, STORAGE_PROVIDERS } from '@/lib/storage';

function genId() { return Math.random().toString(36).slice(2); }

interface OcrResult { amount: string; invoiceNumber: string; }

async function extractFromImage(dataUrl: string): Promise<OcrResult> {
  try {
    const Tesseract = (await import('tesseract.js')).default;
    const result = await Tesseract.recognize(dataUrl, 'jpn+eng', { logger: () => {} });
    const text = result.data.text.slice(0, 1200);
    let amount = '';
    const amountPatterns = [
      /合計[^\d]*[¥￥\\]?\s*([\d,]+)/, /総額[^\d]*[¥￥\\]?\s*([\d,]+)/,
      /金額[^\d]*[¥￥\\]?\s*([\d,]+)/, /[¥￥\\]\s*([\d,]+)/,
      /(\d{1,3}(?:,\d{3})+)(?:\s*円)/, /(\d{4,})(?:\s*円|-)/,
    ];
    for (const p of amountPatterns) { const m = text.match(p); if (m) { amount = m[1].replace(/,/g, ''); break; } }
    let invoiceNumber = '';
    const tPatterns = [/[TＴ]\s*[-−]?\s*(\d[\d\s-−]{11,15}\d)/, /登録番号[^\dTＴ]*[TＴ]\s*[-−]?\s*(\d[\d\s-−]{11,15}\d)/];
    for (const p of tPatterns) { const m = text.match(p); if (m) { const d = m[1].replace(/[\s\-−]/g, ''); if (d.length === 13) { invoiceNumber = 'T' + d; break; } } }
    if (!invoiceNumber) { const dm = text.match(/[TＴ](\d{13})/); if (dm) invoiceNumber = 'T' + dm[1]; }
    return { amount, invoiceNumber };
  } catch { return { amount: '', invoiceNumber: '' }; }
}

function validateInvoiceNumber(num: string): boolean {
  if (!num) return true;
  return /^T\d{13}$/.test(num);
}

interface ReceiptItem {
  id: string; file: File; dataUrl: string; ocrLoading: boolean; ocrAmount: string; ocrInvoiceNumber: string; ocrApplied: boolean;
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
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [isQualifiedInvoice, setIsQualifiedInvoice] = useState(true);
  const [vendorId, setVendorId] = useState<number | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showRouteSearch, setShowRouteSearch] = useState(false);
  const [policyWarnings, setPolicyWarnings] = useState<string[]>([]);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [approvalRoute, setApprovalRoute] = useState<string[]>([]);

  if (!user) return null;

  const totalAmount = lineItems.reduce((s, li) => s + (Number(li.amount) || 0), 0);

  const addLineItem = () => setLineItems(prev => [...prev, { id: genId(), category: db.categories[0]?.id || 1, amount: 0, taxType: 'tax_10' }]);
  const removeLineItem = (id: string) => { if (lineItems.length <= 1) return; setLineItems(prev => prev.filter(li => li.id !== id)); };
  const updateLineItem = (id: string, field: keyof LineItem, value: string | number) => setLineItems(prev => prev.map(li => li.id === id ? { ...li, [field]: value } : li));

  const applyTemplate = (templateId: string) => {
    const tpl = DEFAULT_TEMPLATES.find(t => t.id === templateId);
    if (!tpl) return;
    setLineItems(tpl.lineItems.map(li => ({ ...li, id: genId() })));
    setDescription(tpl.name);
    setShowTemplates(false);
    db.showToast(`テンプレート「${tpl.name}」を適用しました`, 'success');
  };

  // Vendor selection
  const handleVendorSelect = (vid: number) => {
    const vendor = db.vendors.find(v => v.id === vid);
    if (vendor) {
      setVendorId(vid);
      if (vendor.invoiceNumber) setInvoiceNumber(vendor.invoiceNumber);
      setIsQualifiedInvoice(vendor.isQualified);
    }
  };

  // Duplicate check
  const checkDuplicates = () => {
    const similar = db.expenses.filter(e => {
      if (e.userId !== user!.id) return false;
      if (Math.abs(new Date(e.date).getTime() - new Date(date).getTime()) > 3 * 86400000) return false;
      if (e.category !== lineItems[0]?.category) return false;
      if (Math.abs((e.amount || 0) - totalAmount) > totalAmount * 0.1) return false;
      return true;
    });
    if (similar.length > 0) {
      setDuplicateWarning(`⚠ 類似の申請が${similar.length}件あります（${similar.map(e => `${e.date} ¥${e.amount?.toLocaleString()} ${e.description}`).join('、')}）`);
    } else {
      setDuplicateWarning(null);
    }
  };

  // Approval route calculation
  const calculateApprovalRoute = () => {
    const route: string[] = ['部長承認'];
    const rules = DEFAULT_APPROVAL_RULES;
    const needsAdmin = rules.some(r => {
      if (r.condition === 'amount_over' && totalAmount > r.value && r.requiredRole === 'admin') return true;
      if (r.condition === 'category_is' && lineItems.some(li => li.category === r.value) && r.requiredRole === 'admin') return true;
      return false;
    });
    route.push('経理承認');
    if (needsAdmin) route.push('役員承認');
    setApprovalRoute(route);
  };

  // Policy check
  const checkPolicies = (): string[] => {
    const warnings: string[] = [];
    lineItems.forEach(li => {
      const policy = EXPENSE_POLICIES.find(p => p.categoryId === li.category);
      if (policy && li.amount > policy.maxAmount) {
        const catName = db.categories.find(c => c.id === li.category)?.name || '';
        warnings.push(`${catName}: ¥${li.amount.toLocaleString()}は上限¥${policy.maxAmount.toLocaleString()}を超過（${policy.note}）`);
      }
    });
    return warnings;
  };

  // Transit route apply
  const applyRoute = (fare: number, routeDesc: string) => {
    const emptyIdx = lineItems.findIndex(li => !li.amount || li.amount === 0);
    if (emptyIdx >= 0) {
      setLineItems(prev => prev.map((li, i) => i === emptyIdx ? { ...li, amount: fare, category: 1 } : li));
    } else {
      setLineItems(prev => [...prev, { id: genId(), category: 1, amount: fare, taxType: 'tax_10' }]);
    }
    if (!description) setDescription(routeDesc);
    setShowRouteSearch(false);
    db.showToast(`${routeDesc} ¥${fare.toLocaleString()}を追加`, 'success');
  };

  const applyOcrToLine = (receiptId: string, amount: string) => {
    const emptyIdx = lineItems.findIndex(li => !li.amount || li.amount === 0);
    if (emptyIdx >= 0) setLineItems(prev => prev.map((li, i) => i === emptyIdx ? { ...li, amount: Number(amount) } : li));
    else setLineItems(prev => [...prev, { id: genId(), category: db.categories[0]?.id || 1, amount: Number(amount), taxType: 'tax_10' }]);
    setReceipts(prev => prev.map(r => r.id === receiptId ? { ...r, ocrApplied: true } : r));
  };

  const handleFileAdded = async (file: File) => {
    if (!file.type.startsWith('image/') && !file.type.includes('pdf')) return;
    if (file.size > 5 * 1024 * 1024) { db.showToast('ファイルサイズは5MB以下にしてください', 'error'); return; }
    if (receipts.length >= 10) { db.showToast('領収書は最大10枚です', 'error'); return; }
    const dataUrl = await new Promise<string>(resolve => { const reader = new FileReader(); reader.onload = e => resolve(e.target?.result as string); reader.readAsDataURL(file); });
    const newReceipt: ReceiptItem = { id: genId(), file, dataUrl, ocrLoading: true, ocrAmount: '', ocrInvoiceNumber: '', ocrApplied: false };
    setReceipts(prev => [...prev, newReceipt]);
    if (file.type.startsWith('image/')) {
      const ocr = await extractFromImage(dataUrl);
      setReceipts(prev => prev.map(r => r.id === newReceipt.id ? { ...r, ocrLoading: false, ocrAmount: ocr.amount, ocrInvoiceNumber: ocr.invoiceNumber } : r));
      if (ocr.amount) {
        const emptyIdx = lineItems.findIndex(li => !li.amount || li.amount === 0);
        if (emptyIdx >= 0) { setLineItems(prev => prev.map((li, i) => i === emptyIdx ? { ...li, amount: Number(ocr.amount) } : li)); setReceipts(prev => prev.map(r => r.id === newReceipt.id ? { ...r, ocrApplied: true } : r)); }
      }
      if (ocr.invoiceNumber && !invoiceNumber) setInvoiceNumber(ocr.invoiceNumber);
    } else {
      setReceipts(prev => prev.map(r => r.id === newReceipt.id ? { ...r, ocrLoading: false } : r));
    }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => { e.preventDefault(); setDragging(false); const file = e.dataTransfer.files[0]; if (file) handleFileAdded(file); };

  const handleSubmit = async () => {
    if (!description.trim()) { db.showToast('説明を入力してください', 'error'); return; }
    if (totalAmount <= 0) { db.showToast('金額を入力してください', 'error'); return; }
    if (invoiceNumber && !validateInvoiceNumber(invoiceNumber)) { db.showToast('T番号の形式が不正です（T+13桁の数字）', 'error'); return; }
    checkDuplicates();
    calculateApprovalRoute();
    const warnings = checkPolicies();
    if (warnings.length > 0) setPolicyWarnings(warnings);

    setSubmitting(true);
    const activeProvider = getActiveProvider();
    const uploadedReceipts: Array<{ filename: string; driveFileId: string | null }> = [];
    if (receipts.length > 0 && activeProvider !== 'none') {
      const providerName = STORAGE_PROVIDERS.find(p => p.id === activeProvider)?.name || '';
      db.showToast(`${providerName}にアップロード中...`, 'info');
      for (const r of receipts) {
        try { const result = await uploadFile(r.file, description); uploadedReceipts.push({ filename: r.file.name, driveFileId: result?.fileId || null }); }
        catch { uploadedReceipts.push({ filename: r.file.name, driveFileId: null }); }
      }
    } else { receipts.forEach(r => uploadedReceipts.push({ filename: r.file.name, driveFileId: null })); }

    try {
      const newId = Date.now();
      const vendor = vendorId ? db.vendors.find(v => v.id === vendorId) : null;
      await db.upsertExpense({
        id: newId, userId: user!.id, date, category: lineItems[0]?.category || 1,
        amount: totalAmount, description, memo, taxType: lineItems[0]?.taxType || 'tax_10',
        status: 'pending_manager', receipt: uploadedReceipts[0]?.filename || null,
        driveFileId: uploadedReceipts[0]?.driveFileId || null, invoiceNumber: invoiceNumber || null, isQualifiedInvoice,
        vendorId: vendorId, vendorName: vendor?.name || '',
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), revisionHistory: [],
        approvalHistory: [{ action: 'submitted', by: user!.name, at: new Date().toISOString(), comment: '' }],
        lineItems, receipts: uploadedReceipts,
      });
      db.showToast('申請を提出しました', 'success');
      router.push('/dashboard/list');
    } catch { db.showToast('エラーが発生しました', 'error'); }
    finally { setSubmitting(false); }
  };

  const handleSaveDraft = async () => {
    setSavingDraft(true);
    try {
      const newId = Date.now();
      const vendor = vendorId ? db.vendors.find(v => v.id === vendorId) : null;
      await db.upsertExpense({
        id: newId, userId: user!.id, date, category: lineItems[0]?.category || 1,
        amount: totalAmount, description, memo, taxType: lineItems[0]?.taxType || 'tax_10',
        status: 'draft', receipt: receipts[0]?.file.name || null, driveFileId: null, invoiceNumber: invoiceNumber || null, isQualifiedInvoice,
        vendorId, vendorName: vendor?.name || '',
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), revisionHistory: [],
        approvalHistory: [], lineItems, receipts: receipts.map(r => ({ filename: r.file.name, driveFileId: null })),
      });
      db.showToast('下書きを保存しました', 'success'); router.push('/dashboard/list');
    } catch { db.showToast('エラーが発生しました', 'error'); }
    finally { setSavingDraft(false); }
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
        <h1 className="page-title" style={{ margin: 0 }}>経費申請</h1>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button className="btn btn-secondary btn-sm" onClick={() => setShowTemplates(!showTemplates)}>📋 テンプレート</button>
          <button className="btn btn-secondary btn-sm" onClick={() => setShowRouteSearch(!showRouteSearch)}>🚄 交通費検索</button>
        </div>
      </div>

      {/* Templates */}
      {showTemplates && (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px', padding: '20px', marginBottom: '20px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '12px' }}>テンプレートから入力</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '10px' }}>
            {DEFAULT_TEMPLATES.map(tpl => (
              <button key={tpl.id} onClick={() => applyTemplate(tpl.id)} style={{ background: 'var(--bg-alt)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px', textAlign: 'left', cursor: 'pointer' }}>
                <span style={{ fontSize: '24px' }}>{tpl.icon}</span>
                <p style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)', marginTop: '6px' }}>{tpl.name}</p>
                <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>{tpl.description}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Transit route search */}
      {showRouteSearch && (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px', padding: '20px', marginBottom: '20px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '12px' }}>🚄 交通費ルート検索</h3>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '12px' }}>よく使う路線をクリックで金額を明細に追加</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '8px' }}>
            {COMMON_ROUTES.map((r, i) => (
              <button key={i} onClick={() => applyRoute(r.fare, `${r.from}→${r.to} ${r.method}`)}
                style={{ background: 'var(--bg-alt)', border: '1px solid var(--border)', borderRadius: '10px', padding: '10px 14px', textAlign: 'left', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)' }}>{r.from} → {r.to}</p>
                  <p style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{r.method}</p>
                </div>
                <span style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text-accent)' }}>¥{r.fare.toLocaleString()}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Duplicate warning */}
      {duplicateWarning && (
        <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '12px', padding: '14px', marginBottom: '16px' }}>
          <p style={{ fontSize: '13px', color: '#ef4444', fontWeight: '700' }}>{duplicateWarning}</p>
          <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>重複でなければそのまま申請できます</p>
        </div>
      )}

      {/* Policy warnings */}
      {policyWarnings.length > 0 && (
        <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '12px', padding: '14px', marginBottom: '16px' }}>
          <p style={{ fontSize: '13px', fontWeight: '700', color: '#f59e0b', marginBottom: '8px' }}>⚠ ポリシー確認</p>
          {policyWarnings.map((w, i) => <p key={i} style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>- {w}</p>)}
        </div>
      )}

      <div style={{ background: 'var(--bg-card)', backdropFilter: 'var(--glass-blur)', border: '1px solid var(--border)', borderRadius: '16px', padding: '28px', marginBottom: '20px' }}>
        <div className="form-row">
          <div className="form-group"><label className="form-label">申請日</label><input type="date" className="form-control" value={date} onChange={e => setDate(e.target.value)} /></div>
          <div className="form-group"><label className="form-label">合計金額</label>
            <div style={{ padding: '12px 16px', background: 'var(--bg-alt)', border: '1px solid var(--border)', borderRadius: '10px', fontSize: '18px', fontWeight: '800', color: 'var(--text-accent)' }}>¥{totalAmount.toLocaleString()}</div>
          </div>
        </div>

        <div className="form-group"><label className="form-label">説明・件名</label><input type="text" className="form-control" value={description} onChange={e => setDescription(e.target.value)} placeholder="例：大阪出張 交通費" /></div>

        {/* Vendor selector */}
        <div className="form-group">
          <label className="form-label">取引先</label>
          <select className="form-control" value={vendorId || ''} onChange={e => { const v = Number(e.target.value); if (v) handleVendorSelect(v); else { setVendorId(null); } }}>
            <option value="">-- 取引先を選択（任意）--</option>
            {db.vendors.map(v => (
              <option key={v.id} value={v.id}>{v.name} {v.isQualified ? '✓適格' : '△非適格'}{v.invoiceNumber ? ` (${v.invoiceNumber})` : ''}</option>
            ))}
          </select>
        </div>

        <div className="form-group"><label className="form-label">メモ・備考</label><textarea className="form-control" value={memo} onChange={e => setMemo(e.target.value)} rows={2} placeholder="任意のメモを入力" style={{ resize: 'vertical' }} /></div>

        {/* T番号 + 適格/非適格 */}
        <div className="form-group">
          <label className="form-label">T番号（適格請求書発行事業者登録番号）<span style={{ fontSize: '11px', fontWeight: '400', marginLeft: '8px', color: 'var(--text-secondary)' }}>※ OCR自動読取 / 取引先選択で自動入力</span></label>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input type="text" className="form-control" value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value.toUpperCase())} placeholder="T1234567890123" maxLength={14} style={{ fontFamily: 'monospace', letterSpacing: '1px', flex: 1, ...(invoiceNumber && !validateInvoiceNumber(invoiceNumber) ? { borderColor: '#ef4444' } : {}) }} />
            {invoiceNumber && validateInvoiceNumber(invoiceNumber) && <span style={{ fontSize: '12px', color: 'var(--success-color)', fontWeight: '600', whiteSpace: 'nowrap' }}>✓ 有効</span>}
            {invoiceNumber && !validateInvoiceNumber(invoiceNumber) && <span style={{ fontSize: '12px', color: '#ef4444', fontWeight: '600', whiteSpace: 'nowrap' }}>T+13桁</span>}
          </div>
          {invoiceNumber && validateInvoiceNumber(invoiceNumber) && (
            <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              <a href={`https://www.invoice-kohyo.nta.go.jp/regno-search/detail?selRegNo=${invoiceNumber}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-accent)' }}>国税庁で確認 →</a>
            </p>
          )}
          <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
            <label style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', background: isQualifiedInvoice ? 'rgba(16,185,129,0.1)' : 'var(--bg-alt)', border: `2px solid ${isQualifiedInvoice ? 'rgba(16,185,129,0.4)' : 'var(--border)'}`, borderRadius: '10px', cursor: 'pointer' }}>
              <input type="radio" name="invoice_type" checked={isQualifiedInvoice} onChange={() => setIsQualifiedInvoice(true)} />
              <div><p style={{ fontSize: '13px', fontWeight: '700', color: isQualifiedInvoice ? '#10b981' : 'var(--text-primary)' }}>✓ 適格請求書</p><p style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>仕入税額控除の対象</p></div>
            </label>
            <label style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', background: !isQualifiedInvoice ? 'rgba(245,158,11,0.1)' : 'var(--bg-alt)', border: `2px solid ${!isQualifiedInvoice ? 'rgba(245,158,11,0.4)' : 'var(--border)'}`, borderRadius: '10px', cursor: 'pointer' }}>
              <input type="radio" name="invoice_type" checked={!isQualifiedInvoice} onChange={() => setIsQualifiedInvoice(false)} />
              <div><p style={{ fontSize: '13px', fontWeight: '700', color: !isQualifiedInvoice ? '#f59e0b' : 'var(--text-primary)' }}>△ 非適格</p><p style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>経過措置: 80%控除</p></div>
            </label>
          </div>
        </div>

        {/* Line items */}
        <div className="form-group">
          <label className="form-label">明細</label>
          {lineItems.map(li => {
            const policy = EXPENSE_POLICIES.find(p => p.categoryId === li.category);
            const overLimit = policy && li.amount > policy.maxAmount;
            return (
              <div key={li.id}>
                <div className="line-item-row">
                  <div><select className="form-control" value={li.category} onChange={e => updateLineItem(li.id, 'category', Number(e.target.value))}>{db.categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}</select></div>
                  <div><input type="number" className="form-control" value={li.amount || ''} min={0} onChange={e => updateLineItem(li.id, 'amount', Number(e.target.value))} placeholder="金額" style={overLimit ? { borderColor: '#f59e0b' } : {}} /></div>
                  <div><select className="form-control" value={li.taxType} onChange={e => updateLineItem(li.id, 'taxType', e.target.value)}>{TAX_TYPES.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
                  <button className="btn btn-danger btn-sm" onClick={() => removeLineItem(li.id)} disabled={lineItems.length <= 1} style={{ whiteSpace: 'nowrap' }}>削除</button>
                </div>
                {overLimit && <p style={{ fontSize: '11px', color: '#f59e0b', marginTop: '-4px', marginBottom: '8px', paddingLeft: '4px' }}>⚠ 上限¥{policy!.maxAmount.toLocaleString()} 超過 — {policy!.note}</p>}
              </div>
            );
          })}
          <button className="btn btn-secondary btn-sm" onClick={addLineItem} style={{ marginTop: '8px' }}>+ 明細追加</button>
        </div>

        {/* Approval route preview */}
        {totalAmount > 0 && (
          <div style={{ background: 'var(--bg-alt)', border: '1px solid var(--border)', borderRadius: '10px', padding: '12px 16px', marginBottom: '16px' }}>
            <p style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '6px' }}>承認ルート（自動判定）</p>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-primary)', padding: '3px 8px', background: 'rgba(59,130,246,0.15)', borderRadius: '6px' }}>申請</span>
              {(() => {
                const route: string[] = ['部長承認', '経理承認'];
                const needsAdmin = DEFAULT_APPROVAL_RULES.some(r => {
                  if (r.condition === 'amount_over' && totalAmount > r.value && r.requiredRole === 'admin') return true;
                  if (r.condition === 'category_is' && lineItems.some(li => li.category === r.value) && r.requiredRole === 'admin') return true;
                  return false;
                });
                if (needsAdmin) route.push('役員承認');
                return route.map((step, i) => (
                  <span key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>→</span>
                    <span style={{ fontSize: '12px', color: 'var(--text-primary)', padding: '3px 8px', background: step.includes('役員') ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.15)', borderRadius: '6px' }}>{step}</span>
                  </span>
                ));
              })()}
              <span style={{ color: 'var(--text-secondary)' }}>→</span>
              <span style={{ fontSize: '12px', color: '#10b981', padding: '3px 8px', background: 'rgba(16,185,129,0.15)', borderRadius: '6px', fontWeight: '700' }}>✓ 完了</span>
            </div>
            {DEFAULT_APPROVAL_RULES.filter(r => {
              if (r.condition === 'amount_over' && totalAmount > r.value) return true;
              if (r.condition === 'category_is' && lineItems.some(li => li.category === r.value)) return true;
              return false;
            }).map(r => (
              <p key={r.id} style={{ fontSize: '11px', color: '#f59e0b', marginTop: '4px' }}>⚠ {r.description}</p>
            ))}
          </div>
        )}

        {/* Receipt upload */}
        <div className="form-group">
          <label className="form-label">領収書 <span style={{ fontSize: '11px', fontWeight: '400', marginLeft: '8px', color: getActiveProvider() !== 'none' ? 'var(--success-color)' : 'var(--text-secondary)' }}>
            {getActiveProvider() !== 'none' ? `✓ ${STORAGE_PROVIDERS.find(p => p.id === getActiveProvider())?.name}に自動アップロード` : '※ OCR金額+T番号読取'}
          </span></label>
          <div className={`drag-drop-area${dragging ? ' active' : ''}`} onClick={() => fileInputRef.current?.click()} onDragOver={e => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={handleDrop}>
            <p style={{ fontSize: '24px', marginBottom: '8px' }}>📎</p>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>クリックまたはドラッグ&ドロップ</p>
          </div>
          <input ref={fileInputRef} type="file" accept="image/*,.pdf" multiple style={{ display: 'none' }} onChange={e => { Array.from(e.target.files || []).forEach(handleFileAdded); e.target.value = ''; }} />

          {receipts.length > 0 && (
            <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {receipts.map(r => (
                <div key={r.id} style={{ border: '1px solid var(--border)', borderRadius: '12px', padding: '14px', background: 'var(--bg-alt)', display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                  {r.file.type.startsWith('image/') ? (
                    <img src={r.dataUrl} alt="" style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '8px', border: '1px solid var(--border)', cursor: 'pointer', flexShrink: 0 }} onClick={() => { const w = window.open('', '_blank'); if (w) { w.document.write(`<img src="${r.dataUrl}" style="max-width:100%;"/>`); w.document.close(); } }} />
                  ) : <div style={{ width: '80px', height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-card)', borderRadius: '8px', fontSize: '28px', flexShrink: 0 }}>📄</div>}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.file.name}</p>
                    {r.ocrLoading ? (<div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '12px' }}><span className="loading" style={{ width: '12px', height: '12px' }}></span>OCR読取中...</div>)
                    : r.ocrAmount ? (<div>
                        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>金額：<strong style={{ color: 'var(--text-accent)', fontSize: '14px' }}>¥{Number(r.ocrAmount).toLocaleString()}</strong></p>
                        {r.ocrApplied ? <span style={{ fontSize: '12px', color: 'var(--success-color)', fontWeight: '600' }}>✓ 反映済み</span> : <button className="btn btn-secondary btn-sm" onClick={() => applyOcrToLine(r.id, r.ocrAmount)} style={{ fontSize: '12px', padding: '5px 12px' }}>↓ 反映</button>}
                        {r.ocrInvoiceNumber && (<p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>T番号: <strong style={{ fontFamily: 'monospace', color: 'var(--text-accent)' }}>{r.ocrInvoiceNumber}</strong>
                          {invoiceNumber === r.ocrInvoiceNumber ? <span style={{ color: 'var(--success-color)', marginLeft: '6px' }}>✓</span> : <button className="btn btn-secondary btn-sm" onClick={() => setInvoiceNumber(r.ocrInvoiceNumber)} style={{ fontSize: '11px', padding: '2px 8px', marginLeft: '6px' }}>反映</button>}
                        </p>)}
                      </div>)
                    : <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{r.file.type.startsWith('image/') ? '金額を読取できませんでした' : 'PDFはOCR非対応'}</p>}
                  </div>
                  <button onClick={() => setReceipts(prev => prev.filter(x => x.id !== r.id))} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '18px' }}>×</button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="button-group">
          <button className="btn btn-secondary" onClick={handleSaveDraft} disabled={savingDraft}>{savingDraft ? '保存中...' : '下書き保存'}</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting} style={{ width: 'auto', flex: 1 }}>{submitting ? '提出中...' : '申請を提出'}</button>
        </div>
      </div>
    </div>
  );
}
