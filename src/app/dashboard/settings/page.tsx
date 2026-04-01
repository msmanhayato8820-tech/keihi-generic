'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { useDB } from '@/lib/db';
import { saveDriveSettings, getDriveSettings } from '@/lib/gdrive';
import { DEFAULT_GAS_URL } from '@/data/mock';

export default function SettingsPage() {
  const { user } = useAuth();
  const db = useDB();

  // Google Drive settings
  const [clientId, setClientId] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [folderId, setFolderId] = useState('');

  // GAS settings
  const [gasUrl, setGasUrl] = useState('');

  // Category management (admin only)
  const [catName, setCatName] = useState('');
  const [catIcon, setCatIcon] = useState('📦');

  const [saved, setSaved] = useState('');

  useEffect(() => {
    const ds = getDriveSettings();
    if (ds) { setClientId(ds.clientId); setApiKey(ds.apiKey || ''); setFolderId(ds.folderId); }
    const storedGas = localStorage.getItem('gasScriptUrl') || DEFAULT_GAS_URL;
    setGasUrl(storedGas);
  }, []);

  if (!user) return null;

  const handleSaveDrive = () => {
    saveDriveSettings({ clientId, apiKey, folderId });
    setSaved('drive');
    db.showToast('Google Drive設定を保存しました', 'success');
  };

  const handleSaveGas = () => {
    localStorage.setItem('gasScriptUrl', gasUrl);
    setSaved('gas');
    db.showToast('GAS URL設定を保存しました', 'success');
  };

  const handleResetGas = () => {
    setGasUrl(DEFAULT_GAS_URL);
    localStorage.setItem('gasScriptUrl', DEFAULT_GAS_URL);
    db.showToast('GAS URLをデフォルトにリセットしました', 'info');
  };

  const handleAddCategory = async () => {
    if (!catName.trim()) return;
    const maxId = db.categories.reduce((m, c) => Math.max(m, c.id), 0);
    const newCats = [...db.categories, { id: maxId + 1, name: catName.trim(), icon: catIcon }];
    await db.saveCategories(newCats);
    setCatName('');
    db.showToast('カテゴリを追加しました', 'success');
  };

  const handleDeleteCategory = async (id: number) => {
    if (!confirm('このカテゴリを削除しますか？')) return;
    await db.saveCategories(db.categories.filter(c => c.id !== id));
    db.showToast('カテゴリを削除しました', 'info');
  };

  return (
    <div>
      <h1 className="page-title">設定</h1>

      {/* Google Drive Settings */}
      <div className="settings-section">
        <div className="settings-title">📁 Google Drive 連携設定</div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '20px', lineHeight: '1.6' }}>
          領収書を Google Drive に自動アップロードするための設定です。
          Google Cloud Console で OAuth2 クライアント ID と API キーを取得してください。
        </p>
        <div className="form-group">
          <label className="form-label">クライアント ID (Client ID)</label>
          <input
            type="text" className="form-control"
            value={clientId} onChange={e => setClientId(e.target.value)}
            placeholder="xxx.apps.googleusercontent.com"
          />
        </div>
        <div className="form-group">
          <label className="form-label">API キー (API Key)</label>
          <input
            type="text" className="form-control"
            value={apiKey} onChange={e => setApiKey(e.target.value)}
            placeholder="AIza..."
          />
        </div>
        <div className="form-group">
          <label className="form-label">フォルダ ID (Folder ID)</label>
          <input
            type="text" className="form-control"
            value={folderId} onChange={e => setFolderId(e.target.value)}
            placeholder="Google Drive フォルダの ID"
          />
          <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '6px' }}>
            Drive フォルダのURLから取得: drive.google.com/drive/folders/<strong>フォルダID</strong>
          </p>
        </div>
        <button className="btn btn-primary" style={{ width: 'auto' }} onClick={handleSaveDrive}>
          Drive設定を保存
        </button>
        {saved === 'drive' && <p className="success-message" style={{ marginTop: '10px' }}>✓ 保存しました</p>}
      </div>

      {/* GAS URL Settings */}
      <div className="settings-section">
        <div className="settings-title">🔗 Google Apps Script (GAS) URL 設定</div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '20px', lineHeight: '1.6' }}>
          スプレッドシートと連携するための GAS Web App URL を設定します。
          デモモードでは接続せずにモックデータを使用します。
        </p>
        <div className="form-group">
          <label className="form-label">GAS Web App URL</label>
          <input
            type="url" className="form-control"
            value={gasUrl} onChange={e => setGasUrl(e.target.value)}
            placeholder="https://script.google.com/macros/s/..."
          />
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn btn-primary" style={{ width: 'auto' }} onClick={handleSaveGas}>
            URL を保存
          </button>
          <button className="btn btn-secondary" onClick={handleResetGas}>
            デフォルトに戻す
          </button>
        </div>
        {saved === 'gas' && <p className="success-message" style={{ marginTop: '10px' }}>✓ 保存しました</p>}
      </div>

      {/* Category management - admin only */}
      {user.role === 'admin' && (
        <div className="settings-section">
          <div className="settings-title">📝 経費カテゴリ管理</div>
          <table style={{ marginBottom: '20px' }}>
            <thead>
              <tr><th>アイコン</th><th>カテゴリ名</th><th></th></tr>
            </thead>
            <tbody>
              {db.categories.map(c => (
                <tr key={c.id}>
                  <td style={{ fontSize: '20px' }}>{c.icon}</td>
                  <td>{c.name}</td>
                  <td>
                    <button className="btn btn-danger btn-sm" onClick={() => handleDeleteCategory(c.id)}>削除</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
            <div style={{ flex: '0 0 80px' }}>
              <label className="form-label">アイコン</label>
              <input type="text" className="form-control" value={catIcon} onChange={e => setCatIcon(e.target.value)} maxLength={2} />
            </div>
            <div style={{ flex: 1 }}>
              <label className="form-label">カテゴリ名</label>
              <input
                type="text" className="form-control"
                value={catName} onChange={e => setCatName(e.target.value)}
                placeholder="カテゴリ名を入力"
              />
            </div>
            <button className="btn btn-primary" style={{ width: 'auto' }} onClick={handleAddCategory}>
              追加
            </button>
          </div>
        </div>
      )}

      {/* Profile info */}
      <div className="settings-section">
        <div className="settings-title">👤 プロフィール</div>
        <div className="detail-row">
          <div className="detail-label">名前</div>
          <div className="detail-value">{user.name}</div>
        </div>
        <div className="detail-row">
          <div className="detail-label">メール</div>
          <div className="detail-value">{user.email}</div>
        </div>
        <div className="detail-row">
          <div className="detail-label">部署</div>
          <div className="detail-value">{db.departments.find(d => d.id === user.dept)?.name || '-'}</div>
        </div>
        <div className="detail-row">
          <div className="detail-label">役割</div>
          <div className="detail-value">
            <span className="user-role-badge">
              {{ admin: '管理者', manager: '部長', accountant: '経理', employee: '一般社員' }[user.role] || user.role}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
