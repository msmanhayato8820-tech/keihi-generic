'use client';
import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useDB } from '@/lib/db';
import { User, UserRole } from '@/types';

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: 'admin', label: '管理者' },
  { value: 'manager', label: '部長' },
  { value: 'accountant', label: '経理' },
  { value: 'employee', label: '一般社員' },
];

const EMPTY_USER: Omit<User, 'id'> = {
  name: '', email: '', role: 'employee', dept: 1, section: '',
};

export default function UsersPage() {
  const { user } = useAuth();
  const db = useDB();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [form, setForm] = useState<Omit<User, 'id'>>(EMPTY_USER);
  const [saving, setSaving] = useState(false);

  if (!user || user.role !== 'admin') {
    return (
      <div>
        <h1 className="page-title">ユーザー管理</h1>
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px', padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
          管理者のみアクセスできます
        </div>
      </div>
    );
  }

  const openNew = () => {
    setEditing(null);
    setForm(EMPTY_USER);
    setModalOpen(true);
  };

  const openEdit = (u: User) => {
    setEditing(u);
    setForm({ name: u.name, email: u.email, role: u.role, dept: u.dept, section: u.section || '' });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.email.trim()) {
      db.showToast('名前とメールは必須です', 'error');
      return;
    }
    setSaving(true);
    try {
      const id = editing ? editing.id : (db.users.reduce((m, u) => Math.max(m, u.id), 0) + 1);
      await db.upsertUser({ id, ...form });
      db.showToast(editing ? 'ユーザーを更新しました' : 'ユーザーを追加しました', 'success');
      setModalOpen(false);
    } catch {
      db.showToast('エラーが発生しました', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (u: User) => {
    if (!confirm(`${u.name} を削除しますか？`)) return;
    await db.deleteUser(u.id);
    db.showToast('ユーザーを削除しました', 'info');
  };

  const roleLabel = (role: string) =>
    ROLE_OPTIONS.find(r => r.value === role)?.label || role;

  return (
    <div>
      <h1 className="page-title">ユーザー管理</h1>

      <div className="table-card">
        <div className="table-header">
          <h2 className="chart-title">ユーザー一覧 ({db.users.length}名)</h2>
          <button className="btn btn-primary" style={{ width: 'auto', padding: '8px 18px', fontSize: '13px' }} onClick={openNew}>
            + ユーザー追加
          </button>
        </div>
        <table>
          <thead>
            <tr>
              <th>名前</th>
              <th>メール</th>
              <th>役割</th>
              <th>部署</th>
              <th>課</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {db.users.length === 0 ? (
              <tr><td colSpan={6} className="no-data">ユーザーがいません</td></tr>
            ) : db.users.map(u => (
              <tr key={u.id}>
                <td style={{ fontWeight: '600' }}>{u.name}</td>
                <td style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{u.email}</td>
                <td><span className="user-role-badge">{roleLabel(u.role)}</span></td>
                <td style={{ fontSize: '13px' }}>{db.departments.find(d => d.id === u.dept)?.name || '-'}</td>
                <td style={{ fontSize: '13px' }}>{u.section || '-'}</td>
                <td>
                  <div className="inline-actions">
                    <button className="btn btn-secondary btn-sm" onClick={() => openEdit(u)}>編集</button>
                    <button className="btn btn-danger btn-sm" onClick={() => handleDelete(u)}>削除</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Modal */}
      {modalOpen && (
        <div className="modal" onClick={e => { if (e.target === e.currentTarget) setModalOpen(false); }}>
          <div className="modal-content">
            <button className="modal-close" onClick={() => setModalOpen(false)}>×</button>
            <h2 className="modal-title">{editing ? 'ユーザー編集' : 'ユーザー追加'}</h2>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">名前</label>
                <input
                  type="text" className="form-control"
                  value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="山田 太郎"
                />
              </div>
              <div className="form-group">
                <label className="form-label">メールアドレス</label>
                <input
                  type="email" className="form-control"
                  value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="user@example.co.jp"
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">役割</label>
                <select className="form-control" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value as UserRole }))}>
                  {ROLE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">部署</label>
                <select className="form-control" value={form.dept} onChange={e => setForm(f => ({ ...f, dept: Number(e.target.value), section: '' }))}>
                  {db.departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">課</label>
              <select className="form-control" value={form.section || ''} onChange={e => setForm(f => ({ ...f, section: e.target.value }))}>
                <option value="">選択してください</option>
                {(db.departments.find(d => d.id === form.dept)?.sections || []).map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div className="button-group">
              <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>キャンセル</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ flex: 1 }}>
                {saving ? '保存中...' : (editing ? '更新' : '追加')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
