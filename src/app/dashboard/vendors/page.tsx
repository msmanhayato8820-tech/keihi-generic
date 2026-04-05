'use client';
import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useDB } from '@/lib/db';
import { Vendor } from '@/types';

export default function VendorsPage() {
  const { user } = useAuth();
  const db = useDB();
  const [editing, setEditing] = useState<Vendor | null>(null);
  const [name, setName] = useState('');
  const [invoiceNum, setInvoiceNum] = useState('');
  const [isQualified, setIsQualified] = useState(true);
  const [category, setCategory] = useState('');
  const [phone, setPhone] = useState('');
  const [search, setSearch] = useState('');

  if (!user) return null;

  const filtered = db.vendors.filter(v => !search || v.name.toLowerCase().includes(search.toLowerCase()) || (v.invoiceNumber || '').includes(search));

  const resetForm = () => { setName(''); setInvoiceNum(''); setIsQualified(true); setCategory(''); setPhone(''); setEditing(null); };

  const handleSave = async () => {
    if (!name.trim()) { db.showToast('取引先名を入力してください', 'error'); return; }
    const maxId = editing ? editing.id : db.vendors.reduce((m, v) => Math.max(m, v.id), 0) + 1;
    await db.upsertVendor({ id: editing?.id || maxId, name: name.trim(), invoiceNumber: invoiceNum || undefined, isQualified, category, phone });
    db.showToast(editing ? '取引先を更新しました' : '取引先を追加しました', 'success');
    resetForm();
  };

  const handleEdit = (v: Vendor) => {
    setEditing(v); setName(v.name); setInvoiceNum(v.invoiceNumber || ''); setIsQualified(v.isQualified); setCategory(v.category || ''); setPhone(v.phone || '');
  };

  const handleDelete = async (id: number) => {
    if (!confirm('この取引先を削除しますか？')) return;
    await db.deleteVendor(id);
    db.showToast('取引先を削除しました', 'info');
  };

  const handleExport = () => {
    const json = JSON.stringify(db.vendors, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `取引先マスタ_${new Date().toISOString().slice(0, 10)}.json`; a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    const input = document.createElement('input'); input.type = 'file'; input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]; if (!file) return;
      try {
        const data = JSON.parse(await file.text());
        if (Array.isArray(data)) { for (const v of data) await db.upsertVendor(v); db.showToast(`${data.length}件インポートしました`, 'success'); }
      } catch { db.showToast('ファイルの読み込みに失敗しました', 'error'); }
    };
    input.click();
  };

  return (
    <div>
      <h1 className="page-title">取引先マスタ</h1>

      {/* Add/Edit form */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px', padding: '20px', marginBottom: '20px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '12px' }}>
          {editing ? '取引先を編集' : '取引先を追加'}
        </h3>
        <div className="form-row">
          <div className="form-group"><label className="form-label">取引先名 *</label><input type="text" className="form-control" value={name} onChange={e => setName(e.target.value)} placeholder="例：JR東日本" /></div>
          <div className="form-group"><label className="form-label">T番号</label><input type="text" className="form-control" value={invoiceNum} onChange={e => setInvoiceNum(e.target.value.toUpperCase())} placeholder="T1234567890123" maxLength={14} style={{ fontFamily: 'monospace' }} /></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label className="form-label">カテゴリ</label><input type="text" className="form-control" value={category} onChange={e => setCategory(e.target.value)} placeholder="例：交通、宿泊、消耗品" /></div>
          <div className="form-group"><label className="form-label">電話番号</label><input type="text" className="form-control" value={phone} onChange={e => setPhone(e.target.value)} placeholder="03-xxxx-xxxx" /></div>
        </div>
        <div className="form-group">
          <label className="form-label">適格事業者</label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', background: isQualified ? 'rgba(16,185,129,0.1)' : 'var(--bg-alt)', border: `2px solid ${isQualified ? 'rgba(16,185,129,0.4)' : 'var(--border)'}`, borderRadius: '8px', cursor: 'pointer', fontSize: '13px' }}>
              <input type="radio" checked={isQualified} onChange={() => setIsQualified(true)} /> ✓ 適格事業者
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', background: !isQualified ? 'rgba(245,158,11,0.1)' : 'var(--bg-alt)', border: `2px solid ${!isQualified ? 'rgba(245,158,11,0.4)' : 'var(--border)'}`, borderRadius: '8px', cursor: 'pointer', fontSize: '13px' }}>
              <input type="radio" checked={!isQualified} onChange={() => setIsQualified(false)} /> △ 免税事業者
            </label>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-primary" style={{ width: 'auto' }} onClick={handleSave}>{editing ? '更新' : '追加'}</button>
          {editing && <button className="btn btn-secondary" onClick={resetForm}>キャンセル</button>}
        </div>
      </div>

      {/* Search + Export/Import */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', alignItems: 'center' }}>
        <input type="text" className="form-control" value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 取引先名・T番号で検索" style={{ flex: 1 }} />
        <button className="btn btn-secondary btn-sm" onClick={handleExport}>📤 エクスポート</button>
        <button className="btn btn-secondary btn-sm" onClick={handleImport}>📥 インポート</button>
      </div>

      <div className="table-card">
        <table>
          <thead>
            <tr><th>取引先名</th><th>適格区分</th><th>T番号</th><th>カテゴリ</th><th></th></tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? <tr><td colSpan={5} className="no-data">取引先がありません</td></tr> :
            filtered.map(v => (
              <tr key={v.id}>
                <td style={{ fontWeight: '600' }}>{v.name}</td>
                <td>
                  {v.isQualified
                    ? <span style={{ fontSize: '12px', color: '#10b981', fontWeight: '700', background: 'rgba(16,185,129,0.1)', padding: '2px 8px', borderRadius: '6px' }}>✓ 適格</span>
                    : <span style={{ fontSize: '12px', color: '#f59e0b', fontWeight: '700', background: 'rgba(245,158,11,0.1)', padding: '2px 8px', borderRadius: '6px' }}>△ 免税</span>
                  }
                </td>
                <td style={{ fontFamily: 'monospace', fontSize: '12px' }}>{v.invoiceNumber || '-'}</td>
                <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{v.category || '-'}</td>
                <td>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => handleEdit(v)}>編集</button>
                    <button className="btn btn-danger btn-sm" onClick={() => handleDelete(v.id)}>削除</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={{ padding: '12px 16px', fontSize: '12px', color: 'var(--text-secondary)' }}>{filtered.length}件</p>
      </div>
    </div>
  );
}
