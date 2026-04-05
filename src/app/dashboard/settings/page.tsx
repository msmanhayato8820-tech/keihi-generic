'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { useDB } from '@/lib/db';
import { saveDriveSettings, getDriveSettings } from '@/lib/gdrive';
import { DEFAULT_GAS_URL, TAX_TYPES } from '@/data/mock';
import { STORAGE_PROVIDERS, StorageProvider, getActiveProvider, setActiveProvider, getS3Settings, saveS3Settings, getOneDriveSettings, saveOneDriveSettings, getBoxSettings, saveBoxSettings, getDropboxSettings, saveDropboxSettings, getB2Settings, saveB2Settings, getR2Settings, saveR2Settings } from '@/lib/storage';
import { getCompanySettings, saveCompanySettings, applyCompanyColors, getDemoAccounts, saveDemoAccounts, getDefaultDemoAccounts, getDefaultCompanySettings, CompanySettings, DemoAccount } from '@/lib/company';

function TaxRateEditor() {
  const [rates, setRates] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('customTaxTypes');
      if (stored) return JSON.parse(stored);
    }
    return TAX_TYPES.map(t => ({ ...t }));
  });
  const [saved, setSaved] = useState(false);
  const [newName, setNewName] = useState('');
  const [newRate, setNewRate] = useState('');

  const updateRate = (id: string, field: string, value: string | number) => {
    setRates((prev: any[]) => prev.map((r: any) => r.id === id ? { ...r, [field]: value } : r));
    setSaved(false);
  };

  const addRate = () => {
    if (!newName.trim()) return;
    const id = 'tax_custom_' + Date.now();
    setRates((prev: any[]) => [...prev, { id, name: newName.trim(), rate: Number(newRate) / 100, label: `${newRate}%` }]);
    setNewName(''); setNewRate('');
    setSaved(false);
  };

  const removeRate = (id: string) => {
    if (['tax_10', 'tax_8', 'tax_exempt', 'tax_non'].includes(id)) return; // デフォルトは削除不可
    setRates((prev: any[]) => prev.filter((r: any) => r.id !== id));
    setSaved(false);
  };

  const handleSave = () => {
    localStorage.setItem('customTaxTypes', JSON.stringify(rates));
    setSaved(true);
  };

  const handleReset = () => {
    setRates(TAX_TYPES.map(t => ({ ...t })));
    localStorage.removeItem('customTaxTypes');
    setSaved(true);
  };

  return (
    <div>
      <table style={{ marginBottom: '16px' }}>
        <thead>
          <tr><th>税区分名</th><th>税率</th><th>ラベル</th><th></th></tr>
        </thead>
        <tbody>
          {rates.map((r: any) => (
            <tr key={r.id}>
              <td>
                <input type="text" className="form-control" value={r.name}
                  onChange={e => updateRate(r.id, 'name', e.target.value)}
                  style={{ fontSize: '13px', padding: '6px 10px' }} />
              </td>
              <td style={{ width: '100px' }}>
                <input type="number" className="form-control" value={Math.round(r.rate * 100)}
                  onChange={e => { updateRate(r.id, 'rate', Number(e.target.value) / 100); updateRate(r.id, 'label', `${e.target.value}%`); }}
                  style={{ fontSize: '13px', padding: '6px 10px', width: '80px' }} step="1" min="0" max="100" />
              </td>
              <td style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{r.label}</td>
              <td>
                {!['tax_10', 'tax_8', 'tax_exempt', 'tax_non'].includes(r.id) && (
                  <button className="btn btn-danger btn-sm" onClick={() => removeRate(r.id)}>削除</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Add new */}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', marginBottom: '16px' }}>
        <div style={{ flex: 1 }}>
          <label className="form-label">新しい税区分</label>
          <input type="text" className="form-control" value={newName} onChange={e => setNewName(e.target.value)} placeholder="例: 課税 15%" style={{ fontSize: '13px', padding: '8px 10px' }} />
        </div>
        <div style={{ width: '100px' }}>
          <label className="form-label">税率(%)</label>
          <input type="number" className="form-control" value={newRate} onChange={e => setNewRate(e.target.value)} placeholder="15" min="0" max="100" style={{ fontSize: '13px', padding: '8px 10px' }} />
        </div>
        <button className="btn btn-secondary" style={{ width: 'auto' }} onClick={addRate}>追加</button>
      </div>

      <div style={{ display: 'flex', gap: '8px' }}>
        <button className="btn btn-primary" style={{ width: 'auto' }} onClick={handleSave}>税率設定を保存</button>
        <button className="btn btn-secondary" onClick={handleReset}>デフォルトに戻す</button>
        {saved && <span style={{ fontSize: '12px', color: 'var(--success-color)', fontWeight: '600', alignSelf: 'center' }}>✓ 保存しました</span>}
      </div>

      <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '10px' }}>
        ※ インボイス制度や税率改正時に税区分を追加・変更できます。デフォルト税区分（10%/8%/非課税/不課税）は削除できません。
      </p>
    </div>
  );
}

export default function SettingsPage() {
  const { user } = useAuth();
  const db = useDB();

  // Company settings (基本設定)
  const [companyName, setCompanyName2] = useState('会社名');
  const [systemName, setSystemName] = useState('経費管理システム');
  const [domain, setDomain] = useState('example.co.jp');
  const [logoLetter, setLogoLetter] = useState('K');
  const [primaryColor, setPrimaryColor] = useState('#3b82f6');
  const [secondaryColor, setSecondaryColor] = useState('#8b5cf6');

  // Demo accounts
  const [demoAccounts, setDemoAccounts] = useState<DemoAccount[]>([]);
  const [editingAccountId, setEditingAccountId] = useState<number | null>(null);

  // Storage provider
  const [storageProvider, setStorageProvider] = useState<StorageProvider>('none');
  // Google Drive settings
  const [clientId, setClientId] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [folderId, setFolderId] = useState('');
  // S3 settings
  const [s3Region, setS3Region] = useState('ap-northeast-1');
  const [s3Bucket, setS3Bucket] = useState('');
  const [s3AccessKey, setS3AccessKey] = useState('');
  const [s3SecretKey, setS3SecretKey] = useState('');
  const [s3Prefix, setS3Prefix] = useState('receipts');
  // OneDrive settings
  const [odClientId, setOdClientId] = useState('');
  const [odFolderId, setOdFolderId] = useState('');
  // Box settings
  const [boxToken, setBoxToken] = useState('');
  const [boxFolderId, setBoxFolderId] = useState('');
  // Dropbox settings
  const [dropboxToken, setDropboxToken] = useState('');
  const [dropboxFolder, setDropboxFolder] = useState('/receipts');
  // Backblaze B2 settings
  const [b2KeyId, setB2KeyId] = useState('');
  const [b2Key, setB2Key] = useState('');
  const [b2BucketId, setB2BucketId] = useState('');
  const [b2BucketName, setB2BucketName] = useState('');
  const [b2Region, setB2Region] = useState('us-west-004');
  // Cloudflare R2 settings
  const [r2AccountId, setR2AccountId] = useState('');
  const [r2AccessKeyId, setR2AccessKeyId] = useState('');
  const [r2SecretKey, setR2SecretKey] = useState('');
  const [r2Bucket, setR2Bucket] = useState('');

  // GAS settings
  const [gasUrl, setGasUrl] = useState('');

  // Slack settings
  const [slackWebhookUrl, setSlackWebhookUrl] = useState('');

  // Teams settings
  const [teamsWebhookUrl, setTeamsWebhookUrl] = useState('');
  const [teamsSubmitted, setTeamsSubmitted] = useState(true);
  const [teamsApproved, setTeamsApproved] = useState(true);
  const [teamsRejected, setTeamsRejected] = useState(true);

  // Email settings
  const [emailSmtp, setEmailSmtp] = useState('');
  const [emailPort, setEmailPort] = useState('587');
  const [emailUser, setEmailUser] = useState('');
  const [emailPass, setEmailPass] = useState('');
  const [emailFrom, setEmailFrom] = useState('');
  const [emailTo, setEmailTo] = useState('');
  const [emailUseTls, setEmailUseTls] = useState(true);
  const [emailUseGasRelay, setEmailUseGasRelay] = useState(false);
  const [emailSubmitted, setEmailSubmitted] = useState(true);
  const [emailApproved, setEmailApproved] = useState(true);
  const [emailRejected, setEmailRejected] = useState(true);

  // Gemini OCR settings
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [geminiModel, setGeminiModel] = useState('gemini-2.0-flash');
  const [ocrProvider, setOcrProvider] = useState<'tesseract' | 'gemini'>('tesseract');

  // Category management (admin only)
  const [catName, setCatName] = useState('');
  const [catIcon, setCatIcon] = useState('📦');
  const [editingCatId, setEditingCatId] = useState<number | null>(null);
  const [editCatName, setEditCatName] = useState('');
  const [editCatIcon, setEditCatIcon] = useState('');

  const [saved, setSaved] = useState('');

  useEffect(() => {
    // Company settings
    const cs = getCompanySettings();
    setCompanyName2(cs.companyName); setSystemName(cs.systemName); setDomain(cs.domain);
    setLogoLetter(cs.logoLetter); setPrimaryColor(cs.primaryColor); setSecondaryColor(cs.secondaryColor);

    // Demo accounts
    const accounts = getDemoAccounts();
    setDemoAccounts(accounts.map(a => ({
      id: a.id,
      name: a.name,
      email: a.email.includes('@') ? a.email.split('@')[0] : a.email,
      role: a.role as DemoAccount['role'],
      dept: a.dept,
      section: (a as any).section || '',
    })));

    // Storage
    setStorageProvider(getActiveProvider());
    const ds = getDriveSettings();
    if (ds) { setClientId(ds.clientId); setApiKey(ds.apiKey || ''); setFolderId(ds.folderId); }
    const s3 = getS3Settings();
    if (s3) { setS3Region(s3.region); setS3Bucket(s3.bucket); setS3AccessKey(s3.accessKeyId); setS3SecretKey(s3.secretAccessKey); setS3Prefix(s3.prefix); }
    const od = getOneDriveSettings();
    if (od) { setOdClientId(od.clientId); setOdFolderId(od.folderId || ''); }
    const bx = getBoxSettings();
    if (bx) { setBoxToken(bx.accessToken); setBoxFolderId(bx.folderId); }
    const dbx = getDropboxSettings();
    if (dbx) { setDropboxToken(dbx.accessToken); setDropboxFolder(dbx.folderPath); }
    const b2 = getB2Settings();
    if (b2) { setB2KeyId(b2.applicationKeyId); setB2Key(b2.applicationKey); setB2BucketId(b2.bucketId); setB2BucketName(b2.bucketName); setB2Region(b2.region); }
    const r2 = getR2Settings();
    if (r2) { setR2AccountId(r2.accountId); setR2AccessKeyId(r2.accessKeyId); setR2SecretKey(r2.secretAccessKey); setR2Bucket(r2.bucketName); }

    const storedGas = localStorage.getItem('gasScriptUrl') || DEFAULT_GAS_URL;
    setGasUrl(storedGas);
    // Slack
    setSlackWebhookUrl(localStorage.getItem('slackWebhookUrl') || '');

    // Teams
    try {
      const ts = JSON.parse(localStorage.getItem('teamsSettings') || '{}');
      if (ts.webhookUrl) setTeamsWebhookUrl(ts.webhookUrl);
      if (ts.triggers) {
        setTeamsSubmitted(ts.triggers.submitted ?? true);
        setTeamsApproved(ts.triggers.approved ?? true);
        setTeamsRejected(ts.triggers.rejected ?? true);
      }
    } catch {}

    // Email
    try {
      const em = JSON.parse(localStorage.getItem('emailSettings') || '{}');
      if (em.smtp) setEmailSmtp(em.smtp);
      if (em.port) setEmailPort(em.port);
      if (em.user) setEmailUser(em.user);
      if (em.pass) setEmailPass(em.pass);
      if (em.from) setEmailFrom(em.from);
      if (em.to) setEmailTo(em.to);
      if (em.useTls !== undefined) setEmailUseTls(em.useTls);
      if (em.useGasRelay !== undefined) setEmailUseGasRelay(em.useGasRelay);
      if (em.triggers) {
        setEmailSubmitted(em.triggers.submitted ?? true);
        setEmailApproved(em.triggers.approved ?? true);
        setEmailRejected(em.triggers.rejected ?? true);
      }
    } catch {}

    // Gemini OCR
    const storedGeminiKey = localStorage.getItem('geminiApiKey') || '';
    const storedGeminiModel = localStorage.getItem('geminiModel') || 'gemini-2.0-flash';
    const storedOcrProvider = localStorage.getItem('ocrProvider');
    setGeminiApiKey(storedGeminiKey);
    setGeminiModel(storedGeminiModel);
    setOcrProvider(storedOcrProvider === 'gemini' ? 'gemini' : 'tesseract');
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

  const handleEditCategory = (id: number) => {
    const cat = db.categories.find(c => c.id === id);
    if (!cat) return;
    setEditingCatId(id);
    setEditCatName(cat.name);
    setEditCatIcon(cat.icon);
  };

  const handleSaveEditCategory = async () => {
    if (editingCatId === null || !editCatName.trim()) return;
    const updated = db.categories.map(c =>
      c.id === editingCatId ? { ...c, name: editCatName.trim(), icon: editCatIcon } : c
    );
    await db.saveCategories(updated);
    setEditingCatId(null);
    db.showToast('カテゴリを更新しました', 'success');
  };

  const handleReorderCategory = async (id: number, direction: 'up' | 'down') => {
    const idx = db.categories.findIndex(c => c.id === id);
    if (idx < 0) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= db.categories.length) return;
    const newCats = [...db.categories];
    [newCats[idx], newCats[swapIdx]] = [newCats[swapIdx], newCats[idx]];
    await db.saveCategories(newCats);
  };

  // Company settings save
  const handleSaveCompanySettings = () => {
    const settings: CompanySettings = { companyName, systemName, domain, logoLetter, primaryColor, secondaryColor };
    saveCompanySettings(settings);
    applyCompanyColors(settings);
    setSaved('company');
    db.showToast('基本設定を保存しました', 'success');
  };

  const handleResetCompanySettings = () => {
    const defaults = getDefaultCompanySettings();
    setCompanyName2(defaults.companyName); setSystemName(defaults.systemName); setDomain(defaults.domain);
    setLogoLetter(defaults.logoLetter); setPrimaryColor(defaults.primaryColor); setSecondaryColor(defaults.secondaryColor);
    saveCompanySettings(defaults);
    applyCompanyColors(defaults);
    db.showToast('基本設定をデフォルトにリセットしました', 'info');
  };

  // Demo account helpers
  const handleSaveDemoAccount = (id: number, updated: Partial<DemoAccount>) => {
    setDemoAccounts(prev => {
      const newAccounts = prev.map(a => a.id === id ? { ...a, ...updated } : a);
      saveDemoAccounts(newAccounts);
      return newAccounts;
    });
    setEditingAccountId(null);
    db.showToast('アカウントを更新しました', 'success');
  };

  const handleDeleteDemoAccount = (id: number) => {
    if (!confirm('このアカウントを削除しますか？')) return;
    setDemoAccounts(prev => {
      const newAccounts = prev.filter(a => a.id !== id);
      saveDemoAccounts(newAccounts);
      return newAccounts;
    });
    db.showToast('アカウントを削除しました', 'info');
  };

  const handleAddDemoAccount = () => {
    const maxId = demoAccounts.reduce((m, a) => Math.max(m, a.id), 0);
    const newAccount: DemoAccount = {
      id: maxId + 1,
      name: '新規ユーザー',
      email: 'user' + (maxId + 1),
      role: 'employee',
      dept: 1,
      section: '',
    };
    setDemoAccounts(prev => {
      const newAccounts = [...prev, newAccount];
      saveDemoAccounts(newAccounts);
      return newAccounts;
    });
    setEditingAccountId(newAccount.id);
  };

  const handleResetDemoAccounts = () => {
    const defaults = getDefaultDemoAccounts();
    setDemoAccounts(defaults);
    saveDemoAccounts(defaults);
    db.showToast('デモアカウントをデフォルトにリセットしました', 'info');
  };

  return (
    <div>
      <h1 className="page-title">設定</h1>

      {/* ===== 基本設定 - 管理者のみ ===== */}
      {user.role === 'admin' && (
        <div className="settings-section">
          <div className="settings-title">🏢 基本設定</div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '20px', lineHeight: '1.6' }}>
            会社情報とシステムのブランディングを設定します。テーマカラーはシステム全体に反映されます。
          </p>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">会社名</label>
              <input type="text" className="form-control" value={companyName} onChange={e => setCompanyName2(e.target.value)} placeholder="会社名" />
            </div>
            <div className="form-group">
              <label className="form-label">システム名</label>
              <input type="text" className="form-control" value={systemName} onChange={e => setSystemName(e.target.value)} placeholder="経費管理システム" />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">メールドメイン</label>
            <input type="text" className="form-control" value={domain} onChange={e => setDomain(e.target.value)} placeholder="example.co.jp" />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">ロゴ文字</label>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <input type="text" className="form-control" value={logoLetter} onChange={e => setLogoLetter(e.target.value)} maxLength={1} style={{ width: '60px', textAlign: 'center', fontSize: '18px', fontWeight: '700' }} />
                <div style={{
                  width: '48px', height: '48px', borderRadius: '12px',
                  background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontSize: '20px', fontWeight: '700', flexShrink: 0,
                }}>
                  {logoLetter}
                </div>
              </div>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">テーマカラー</label>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input type="color" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} style={{ width: '40px', height: '36px', border: 'none', cursor: 'pointer', borderRadius: '6px' }} />
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{primaryColor}</span>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">アクセントカラー</label>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input type="color" value={secondaryColor} onChange={e => setSecondaryColor(e.target.value)} style={{ width: '40px', height: '36px', border: 'none', cursor: 'pointer', borderRadius: '6px' }} />
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{secondaryColor}</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button className="btn btn-primary" style={{ width: 'auto' }} onClick={handleSaveCompanySettings}>基本設定を保存</button>
            <button className="btn btn-secondary" onClick={handleResetCompanySettings}>デフォルトに戻す</button>
          </div>
          {saved === 'company' && <p className="success-message" style={{ marginTop: '10px' }}>✓ 保存しました</p>}
        </div>
      )}

      {/* ===== デモアカウント管理 - 管理者のみ ===== */}
      {user.role === 'admin' && (
        <div className="settings-section">
          <div className="settings-title">👥 デモアカウント管理</div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '20px', lineHeight: '1.6' }}>
            デモ用ログインアカウントを管理します。メールはローカル部分のみ入力してください（ドメインは基本設定に連動）。
          </p>

          <table style={{ marginBottom: '16px' }}>
            <thead>
              <tr><th>名前</th><th>メール</th><th>ロール</th><th>部署ID</th><th>課</th><th></th></tr>
            </thead>
            <tbody>
              {demoAccounts.map(a => (
                <tr key={a.id}>
                  {editingAccountId === a.id ? (
                    <>
                      <td><input type="text" className="form-control" defaultValue={a.name} style={{ fontSize: '13px', padding: '6px 10px' }}
                        onChange={e => { a.name = e.target.value; }} /></td>
                      <td><input type="text" className="form-control" defaultValue={a.email} style={{ fontSize: '13px', padding: '6px 10px' }}
                        onChange={e => { a.email = e.target.value; }} /></td>
                      <td>
                        <select className="form-control" defaultValue={a.role} style={{ fontSize: '13px', padding: '6px 10px' }}
                          onChange={e => { a.role = e.target.value as DemoAccount['role']; }}>
                          <option value="admin">admin</option>
                          <option value="manager">manager</option>
                          <option value="accountant">accountant</option>
                          <option value="employee">employee</option>
                        </select>
                      </td>
                      <td><input type="number" className="form-control" defaultValue={a.dept} style={{ fontSize: '13px', padding: '6px 10px', width: '60px' }}
                        onChange={e => { a.dept = Number(e.target.value); }} /></td>
                      <td><input type="text" className="form-control" defaultValue={a.section} style={{ fontSize: '13px', padding: '6px 10px' }}
                        onChange={e => { a.section = e.target.value; }} /></td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <button className="btn btn-primary btn-sm" style={{ marginRight: '4px' }} onClick={() => handleSaveDemoAccount(a.id, { name: a.name, email: a.email, role: a.role, dept: a.dept, section: a.section })}>保存</button>
                        <button className="btn btn-secondary btn-sm" onClick={() => setEditingAccountId(null)}>キャンセル</button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td style={{ fontSize: '13px' }}>{a.name}</td>
                      <td style={{ fontSize: '13px', fontFamily: 'monospace' }}>{a.email}</td>
                      <td style={{ fontSize: '13px' }}>{a.role}</td>
                      <td style={{ fontSize: '13px' }}>{a.dept}</td>
                      <td style={{ fontSize: '13px' }}>{a.section}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <button className="btn btn-secondary btn-sm" style={{ marginRight: '4px' }} onClick={() => setEditingAccountId(a.id)}>編集</button>
                        <button className="btn btn-danger btn-sm" onClick={() => handleDeleteDemoAccount(a.id)}>削除</button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-primary" style={{ width: 'auto' }} onClick={handleAddDemoAccount}>+ アカウント追加</button>
            <button className="btn btn-secondary" onClick={handleResetDemoAccounts}>デフォルトに戻す</button>
          </div>
        </div>
      )}

      {/* ===== Storage Provider Settings - 管理者のみ ===== */}
      {user.role !== 'admin' && (
        <div className="settings-section" style={{ opacity: 0.5, pointerEvents: 'none' }}>
          <div className="settings-title">☁️ クラウドストレージ設定</div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>🔒 この設定は管理者のみ変更できます。</p>
        </div>
      )}
      {user.role === 'admin' && <div className="settings-section">
        <div className="settings-title">☁️ クラウドストレージ設定</div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '16px', lineHeight: '1.6' }}>
          領収書の自動アップロード先を選択します。電子帳簿保存法に対応したクラウドストレージを推奨します。
        </p>

        {/* Provider selector */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '20px' }}>
          {STORAGE_PROVIDERS.map(p => (
            <button key={p.id} onClick={() => { setStorageProvider(p.id); setActiveProvider(p.id); }}
              style={{
                padding: '12px 8px', borderRadius: '12px', textAlign: 'center', cursor: 'pointer',
                background: storageProvider === p.id ? 'rgba(59,130,246,0.1)' : 'var(--bg-alt)',
                border: `2px solid ${storageProvider === p.id ? 'rgba(59,130,246,0.5)' : 'var(--border)'}`,
                transition: 'all 0.2s',
              }}>
              <span style={{ fontSize: '24px', display: 'block', marginBottom: '4px' }}>{p.icon}</span>
              <span style={{ fontSize: '11px', fontWeight: '700', color: storageProvider === p.id ? 'var(--text-accent)' : 'var(--text-primary)' }}>{p.name}</span>
            </button>
          ))}
        </div>

        {/* S3 Settings */}
        {storageProvider === 's3' && (
          <div style={{ background: 'var(--bg-alt)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px' }}>
            <h4 style={{ fontSize: '14px', fontWeight: '700', color: '#FF9900', marginBottom: '12px' }}>☁️ AWS S3 設定</h4>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              IAMユーザーに s3:PutObject 権限が必要です。バケットのCORS設定も確認してください。
            </p>
            <div className="form-row">
              <div className="form-group"><label className="form-label">リージョン</label>
                <select className="form-control" value={s3Region} onChange={e => setS3Region(e.target.value)}>
                  <option value="ap-northeast-1">ap-northeast-1（東京）</option>
                  <option value="ap-northeast-3">ap-northeast-3（大阪）</option>
                  <option value="us-east-1">us-east-1（バージニア）</option>
                  <option value="us-west-2">us-west-2（オレゴン）</option>
                </select>
              </div>
              <div className="form-group"><label className="form-label">バケット名</label><input type="text" className="form-control" value={s3Bucket} onChange={e => setS3Bucket(e.target.value)} placeholder="my-company-receipts" /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">アクセスキー ID</label><input type="text" className="form-control" value={s3AccessKey} onChange={e => setS3AccessKey(e.target.value)} placeholder="AKIA..." /></div>
              <div className="form-group"><label className="form-label">シークレットキー</label><input type="password" className="form-control" value={s3SecretKey} onChange={e => setS3SecretKey(e.target.value)} placeholder="..." /></div>
            </div>
            <div className="form-group"><label className="form-label">プレフィックス（フォルダパス）</label><input type="text" className="form-control" value={s3Prefix} onChange={e => setS3Prefix(e.target.value)} placeholder="receipts/2026" /></div>
            <button className="btn btn-primary" style={{ width: 'auto' }} onClick={() => {
              saveS3Settings({ region: s3Region, bucket: s3Bucket, accessKeyId: s3AccessKey, secretAccessKey: s3SecretKey, prefix: s3Prefix });
              setSaved('storage'); db.showToast('S3設定を保存しました', 'success');
            }}>S3設定を保存</button>
            <div style={{ marginTop: '12px', padding: '10px', background: 'rgba(255,153,0,0.1)', borderRadius: '8px', fontSize: '11px', color: 'var(--text-secondary)' }}>
              💡 推奨: S3バージョニングを有効にすると電子帳簿保存法の改ざん防止要件を満たせます
            </div>
          </div>
        )}

        {/* Google Drive Settings */}
        {storageProvider === 'google_drive' && (
          <div style={{ background: 'var(--bg-alt)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px' }}>
            <h4 style={{ fontSize: '14px', fontWeight: '700', color: '#4285F4', marginBottom: '12px' }}>📁 Google Drive 設定</h4>
            <div className="form-group"><label className="form-label">クライアント ID</label><input type="text" className="form-control" value={clientId} onChange={e => setClientId(e.target.value)} placeholder="xxx.apps.googleusercontent.com" /></div>
            <div className="form-group"><label className="form-label">API キー</label><input type="text" className="form-control" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="AIza..." /></div>
            <div className="form-group"><label className="form-label">フォルダ ID</label><input type="text" className="form-control" value={folderId} onChange={e => setFolderId(e.target.value)} placeholder="Google Drive フォルダの ID" /></div>
            <button className="btn btn-primary" style={{ width: 'auto' }} onClick={() => { saveDriveSettings({ clientId, apiKey, folderId }); setSaved('storage'); db.showToast('Drive設定を保存しました', 'success'); }}>Drive設定を保存</button>
          </div>
        )}

        {/* OneDrive Settings */}
        {storageProvider === 'onedrive' && (
          <div style={{ background: 'var(--bg-alt)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px' }}>
            <h4 style={{ fontSize: '14px', fontWeight: '700', color: '#0078D4', marginBottom: '12px' }}>☁️ OneDrive 設定</h4>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '16px' }}>Azure AD にアプリを登録し、Files.ReadWrite スコープを許可してください。</p>
            <div className="form-group"><label className="form-label">アプリケーション (クライアント) ID</label><input type="text" className="form-control" value={odClientId} onChange={e => setOdClientId(e.target.value)} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" /></div>
            <div className="form-group"><label className="form-label">フォルダ ID（空欄=ルート）</label><input type="text" className="form-control" value={odFolderId} onChange={e => setOdFolderId(e.target.value)} placeholder="任意" /></div>
            <button className="btn btn-primary" style={{ width: 'auto' }} onClick={() => {
              saveOneDriveSettings({ clientId: odClientId, folderId: odFolderId });
              setSaved('storage'); db.showToast('OneDrive設定を保存しました', 'success');
            }}>OneDrive設定を保存</button>
          </div>
        )}

        {/* Box Settings */}
        {storageProvider === 'box' && (
          <div style={{ background: 'var(--bg-alt)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px' }}>
            <h4 style={{ fontSize: '14px', fontWeight: '700', color: '#0061D5', marginBottom: '12px' }}>📦 Box 設定</h4>
            <div className="form-group"><label className="form-label">アクセストークン</label><input type="password" className="form-control" value={boxToken} onChange={e => setBoxToken(e.target.value)} placeholder="Developer Token" /></div>
            <div className="form-group"><label className="form-label">フォルダ ID</label><input type="text" className="form-control" value={boxFolderId} onChange={e => setBoxFolderId(e.target.value)} placeholder="0 (ルートフォルダ)" /></div>
            <button className="btn btn-primary" style={{ width: 'auto' }} onClick={() => {
              saveBoxSettings({ accessToken: boxToken, folderId: boxFolderId });
              setSaved('storage'); db.showToast('Box設定を保存しました', 'success');
            }}>Box設定を保存</button>
          </div>
        )}

        {/* Dropbox Settings */}
        {storageProvider === 'dropbox' && (
          <div style={{ background: 'var(--bg-alt)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px' }}>
            <h4 style={{ fontSize: '14px', fontWeight: '700', color: '#0061FF', marginBottom: '12px' }}>📁 Dropbox 設定</h4>
            <div className="form-group"><label className="form-label">アクセストークン</label><input type="password" className="form-control" value={dropboxToken} onChange={e => setDropboxToken(e.target.value)} placeholder="sl...." /></div>
            <div className="form-group"><label className="form-label">フォルダパス</label><input type="text" className="form-control" value={dropboxFolder} onChange={e => setDropboxFolder(e.target.value)} placeholder="/receipts" /></div>
            <button className="btn btn-primary" style={{ width: 'auto' }} onClick={() => {
              saveDropboxSettings({ accessToken: dropboxToken, folderPath: dropboxFolder });
              setSaved('storage'); db.showToast('Dropbox設定を保存しました', 'success');
            }}>Dropbox設定を保存</button>
          </div>
        )}

        {/* Backblaze B2 Settings */}
        {storageProvider === 'backblaze_b2' && (
          <div style={{ background: 'var(--bg-alt)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px' }}>
            <h4 style={{ fontSize: '14px', fontWeight: '700', color: '#E21E1E', marginBottom: '12px' }}>🔥 Backblaze B2 設定</h4>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Application Key ID</label><input type="text" className="form-control" value={b2KeyId} onChange={e => setB2KeyId(e.target.value)} placeholder="005a..." /></div>
              <div className="form-group"><label className="form-label">Application Key</label><input type="password" className="form-control" value={b2Key} onChange={e => setB2Key(e.target.value)} placeholder="K005..." /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Bucket ID</label><input type="text" className="form-control" value={b2BucketId} onChange={e => setB2BucketId(e.target.value)} placeholder="4a48..." /></div>
              <div className="form-group"><label className="form-label">Bucket Name</label><input type="text" className="form-control" value={b2BucketName} onChange={e => setB2BucketName(e.target.value)} placeholder="my-receipts" /></div>
            </div>
            <div className="form-group">
              <label className="form-label">Region</label>
              <select className="form-control" value={b2Region} onChange={e => setB2Region(e.target.value)}>
                <option value="us-west-004">us-west-004</option>
                <option value="eu-central-003">eu-central-003</option>
              </select>
            </div>
            <button className="btn btn-primary" style={{ width: 'auto' }} onClick={() => {
              saveB2Settings({ applicationKeyId: b2KeyId, applicationKey: b2Key, bucketId: b2BucketId, bucketName: b2BucketName, region: b2Region });
              setSaved('storage'); db.showToast('B2設定を保存しました', 'success');
            }}>B2設定を保存</button>
          </div>
        )}

        {/* Cloudflare R2 Settings */}
        {storageProvider === 'cloudflare_r2' && (
          <div style={{ background: 'var(--bg-alt)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px' }}>
            <h4 style={{ fontSize: '14px', fontWeight: '700', color: '#F6821F', marginBottom: '12px' }}>☁️ Cloudflare R2 設定</h4>
            <div className="form-group"><label className="form-label">Account ID</label><input type="text" className="form-control" value={r2AccountId} onChange={e => setR2AccountId(e.target.value)} placeholder="xxxxxxxxxxxxx" /></div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Access Key ID</label><input type="text" className="form-control" value={r2AccessKeyId} onChange={e => setR2AccessKeyId(e.target.value)} placeholder="..." /></div>
              <div className="form-group"><label className="form-label">Secret Access Key</label><input type="password" className="form-control" value={r2SecretKey} onChange={e => setR2SecretKey(e.target.value)} placeholder="..." /></div>
            </div>
            <div className="form-group"><label className="form-label">Bucket Name</label><input type="text" className="form-control" value={r2Bucket} onChange={e => setR2Bucket(e.target.value)} placeholder="my-receipts" /></div>
            <button className="btn btn-primary" style={{ width: 'auto' }} onClick={() => {
              saveR2Settings({ accountId: r2AccountId, accessKeyId: r2AccessKeyId, secretAccessKey: r2SecretKey, bucketName: r2Bucket });
              setSaved('storage'); db.showToast('R2設定を保存しました', 'success');
            }}>R2設定を保存</button>
          </div>
        )}

        {storageProvider === 'none' && (
          <div style={{ padding: '16px', background: 'var(--bg-alt)', borderRadius: '12px', color: 'var(--text-secondary)', fontSize: '13px' }}>
            クラウドストレージを選択すると、領収書が自動でアップロードされます。電子帳簿保存法対応にはクラウドストレージの利用を推奨します。
          </div>
        )}
        {saved === 'storage' && <p className="success-message" style={{ marginTop: '10px' }}>✓ 保存しました</p>}
      </div>}

      {/* ===== GAS URL Settings - 管理者のみ ===== */}
      {user.role !== 'admin' && (
        <div className="settings-section" style={{ opacity: 0.5, pointerEvents: 'none' }}>
          <div className="settings-title">🔗 Google Apps Script (GAS) URL 設定</div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>🔒 この設定は管理者のみ変更できます。</p>
        </div>
      )}
      {user.role === 'admin' && <div className="settings-section">
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
      </div>}

      {/* ===== Slack通知設定 - 管理者のみ ===== */}
      {user.role === 'admin' && <div className="settings-section">
        <div className="settings-title">💬 Slack通知設定</div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '20px', lineHeight: '1.6' }}>
          経費申請・承認時にSlackチャンネルに自動通知します。<br />
          Slack App の Incoming Webhook URL を設定してください。
        </p>
        <div className="form-group">
          <label className="form-label">Webhook URL</label>
          <input type="url" className="form-control" value={slackWebhookUrl} onChange={e => setSlackWebhookUrl(e.target.value)} placeholder="https://hooks.slack.com/services/T.../B.../..." />
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button className="btn btn-primary" style={{ width: 'auto' }} onClick={() => {
            localStorage.setItem('slackWebhookUrl', slackWebhookUrl);
            setSaved('slack');
            db.showToast('Slack設定を保存しました', 'success');
          }}>Slack設定を保存</button>
          {slackWebhookUrl && <span style={{ fontSize: '12px', color: 'var(--success-color)', fontWeight: '600' }}>✓ 通知ON</span>}
          <button className="btn btn-secondary btn-sm" onClick={async () => {
            if (!slackWebhookUrl) { db.showToast('Webhook URLを入力してください', 'error'); return; }
            try {
              await fetch(slackWebhookUrl, { method: 'POST', body: JSON.stringify({ text: '🧪 テスト通知: 経費精算システムからの接続確認です' }) });
              db.showToast('テスト通知を送信しました', 'success');
            } catch { db.showToast('送信に失敗しました', 'error'); }
          }}>テスト送信</button>
        </div>
        {saved === 'slack' && <p className="success-message" style={{ marginTop: '10px' }}>✓ 保存しました</p>}
        <div style={{ marginTop: '12px', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
          通知タイミング: 経費申請時・承認完了時に自動送信
        </div>
      </div>}

      {/* ===== Microsoft Teams通知設定 - 管理者のみ ===== */}
      {user.role === 'admin' && (
        <div className="settings-section">
          <div className="settings-title">💬 Microsoft Teams通知設定</div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '20px', lineHeight: '1.6' }}>
            経費申請・承認時にTeamsチャンネルに自動通知します。<br />
            Teams の Incoming Webhook URL を設定してください。
          </p>
          <div className="form-group">
            <label className="form-label">Webhook URL</label>
            <input type="url" className="form-control" value={teamsWebhookUrl} onChange={e => setTeamsWebhookUrl(e.target.value)} placeholder="https://xxx.webhook.office.com/webhookb2/..." />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label className="form-label">通知トリガー</label>
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
                <input type="checkbox" checked={teamsSubmitted} onChange={e => setTeamsSubmitted(e.target.checked)} /> 申請時
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
                <input type="checkbox" checked={teamsApproved} onChange={e => setTeamsApproved(e.target.checked)} /> 承認時
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
                <input type="checkbox" checked={teamsRejected} onChange={e => setTeamsRejected(e.target.checked)} /> 差戻し時
              </label>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <button className="btn btn-primary" style={{ width: 'auto' }} onClick={() => {
              localStorage.setItem('teamsSettings', JSON.stringify({
                webhookUrl: teamsWebhookUrl,
                triggers: { submitted: teamsSubmitted, approved: teamsApproved, rejected: teamsRejected },
              }));
              setSaved('teams');
              db.showToast('Teams設定を保存しました', 'success');
            }}>Teams設定を保存</button>
            {teamsWebhookUrl && <span style={{ fontSize: '12px', color: 'var(--success-color)', fontWeight: '600' }}>✓ 通知ON</span>}
            <button className="btn btn-secondary btn-sm" onClick={async () => {
              if (!teamsWebhookUrl) { db.showToast('Webhook URLを入力してください', 'error'); return; }
              try {
                await fetch(teamsWebhookUrl, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ text: '🧪 テスト通知: 経費精算システムからの接続確認です' }),
                });
                db.showToast('テスト通知を送信しました', 'success');
              } catch { db.showToast('送信に失敗しました', 'error'); }
            }}>テスト送信</button>
          </div>
          {saved === 'teams' && <p className="success-message" style={{ marginTop: '10px' }}>✓ 保存しました</p>}
        </div>
      )}

      {/* ===== メール通知設定 - 管理者のみ ===== */}
      {user.role === 'admin' && (
        <div className="settings-section">
          <div className="settings-title">📧 メール通知設定</div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '20px', lineHeight: '1.6' }}>
            経費申請・承認時にメールで通知します。SMTPサーバーまたはGASリレーを使用して送信します。
          </p>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">SMTPサーバー</label>
              <input type="text" className="form-control" value={emailSmtp} onChange={e => setEmailSmtp(e.target.value)} placeholder="smtp.gmail.com" />
            </div>
            <div className="form-group">
              <label className="form-label">ポート</label>
              <input type="text" className="form-control" value={emailPort} onChange={e => setEmailPort(e.target.value)} placeholder="587" />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">ユーザー名</label>
              <input type="text" className="form-control" value={emailUser} onChange={e => setEmailUser(e.target.value)} placeholder="user@example.com" />
            </div>
            <div className="form-group">
              <label className="form-label">パスワード</label>
              <input type="password" className="form-control" value={emailPass} onChange={e => setEmailPass(e.target.value)} placeholder="..." />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">送信元</label>
              <input type="email" className="form-control" value={emailFrom} onChange={e => setEmailFrom(e.target.value)} placeholder="noreply@example.co.jp" />
            </div>
            <div className="form-group">
              <label className="form-label">送信先（カンマ区切り）</label>
              <input type="text" className="form-control" value={emailTo} onChange={e => setEmailTo(e.target.value)} placeholder="admin@example.co.jp, manager@example.co.jp" />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '16px', marginBottom: '16px', flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
              <input type="checkbox" checked={emailUseTls} onChange={e => setEmailUseTls(e.target.checked)} /> TLS/SSL
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
              <input type="checkbox" checked={emailUseGasRelay} onChange={e => setEmailUseGasRelay(e.target.checked)} /> GAS経由で送信
            </label>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label className="form-label">通知トリガー</label>
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
                <input type="checkbox" checked={emailSubmitted} onChange={e => setEmailSubmitted(e.target.checked)} /> 申請時
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
                <input type="checkbox" checked={emailApproved} onChange={e => setEmailApproved(e.target.checked)} /> 承認時
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
                <input type="checkbox" checked={emailRejected} onChange={e => setEmailRejected(e.target.checked)} /> 差戻し時
              </label>
            </div>
          </div>

          <div style={{ padding: '10px 14px', background: 'rgba(245,158,11,0.1)', borderRadius: '8px', fontSize: '12px', color: '#b45309', marginBottom: '16px', lineHeight: '1.6' }}>
            ⚠ クライアントサイドからのSMTP直接送信はできません。GASリレーまたはバックエンドAPIが必要です。
          </div>

          <button className="btn btn-primary" style={{ width: 'auto' }} onClick={() => {
            localStorage.setItem('emailSettings', JSON.stringify({
              smtp: emailSmtp, port: emailPort, user: emailUser, pass: emailPass,
              from: emailFrom, to: emailTo, useTls: emailUseTls, useGasRelay: emailUseGasRelay,
              triggers: { submitted: emailSubmitted, approved: emailApproved, rejected: emailRejected },
            }));
            setSaved('email');
            db.showToast('メール設定を保存しました', 'success');
          }}>メール設定を保存</button>
          {saved === 'email' && <p className="success-message" style={{ marginTop: '10px' }}>✓ 保存しました</p>}
        </div>
      )}

      {/* ===== Gemini OCR Settings - 管理者のみ ===== */}
      {user.role !== 'admin' && (
        <div className="settings-section" style={{ opacity: 0.5, pointerEvents: 'none' }}>
          <div className="settings-title">🤖 OCR設定（領収書読取）</div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>🔒 この設定は管理者のみ変更できます。</p>
        </div>
      )}
      {user.role === 'admin' && <div className="settings-section">
        <div className="settings-title">🤖 OCR設定（領収書読取）</div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '20px', lineHeight: '1.6' }}>
          領収書から金額を自動読取するエンジンを選択します。<br />
          <strong>Tesseract.js</strong>: ブラウザ内OCR（無料・オフライン対応・精度は中程度）<br />
          <strong>Gemini API</strong>: Google AI による高精度読取（API キーが必要・従量課金）
        </p>

        <div className="form-group">
          <label className="form-label">OCRエンジン</label>
          <div style={{ display: 'flex', gap: '10px' }}>
            <label style={{
              flex: 1, display: 'flex', alignItems: 'center', gap: '10px', padding: '14px 16px',
              background: ocrProvider === 'tesseract' ? 'rgba(59,130,246,0.1)' : 'var(--bg-alt)',
              border: `2px solid ${ocrProvider === 'tesseract' ? 'rgba(59,130,246,0.4)' : 'var(--border)'}`,
              borderRadius: '12px', cursor: 'pointer', transition: 'all 0.2s',
            }}>
              <input type="radio" name="ocr" checked={ocrProvider === 'tesseract'} onChange={() => setOcrProvider('tesseract')} />
              <div>
                <p style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)' }}>Tesseract.js</p>
                <p style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>無料・オフライン対応</p>
              </div>
            </label>
            <label style={{
              flex: 1, display: 'flex', alignItems: 'center', gap: '10px', padding: '14px 16px',
              background: ocrProvider === 'gemini' ? 'rgba(59,130,246,0.1)' : 'var(--bg-alt)',
              border: `2px solid ${ocrProvider === 'gemini' ? 'rgba(59,130,246,0.4)' : 'var(--border)'}`,
              borderRadius: '12px', cursor: 'pointer', transition: 'all 0.2s',
            }}>
              <input type="radio" name="ocr" checked={ocrProvider === 'gemini'} onChange={() => setOcrProvider('gemini')} />
              <div>
                <p style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)' }}>Gemini API</p>
                <p style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>高精度・API キー必要</p>
              </div>
            </label>
          </div>
        </div>

        {ocrProvider === 'gemini' && (
          <>
            <div className="form-group">
              <label className="form-label">Gemini API キー</label>
              <input
                type="password" className="form-control"
                value={geminiApiKey} onChange={e => setGeminiApiKey(e.target.value)}
                placeholder="AIza..."
              />
              <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '6px' }}>
                <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-accent)' }}>
                  Google AI Studio
                </a>
                {' '}から無料で取得できます
              </p>
            </div>
            <div className="form-group">
              <label className="form-label">モデル</label>
              <select className="form-control" value={geminiModel} onChange={e => setGeminiModel(e.target.value)}>
                <option value="gemini-2.0-flash">Gemini 2.0 Flash（推奨・高速）</option>
                <option value="gemini-2.5-flash">Gemini 2.5 Flash（最新・高精度）</option>
                <option value="gemini-2.5-pro">Gemini 2.5 Pro（最高精度）</option>
              </select>
            </div>
          </>
        )}

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button className="btn btn-primary" style={{ width: 'auto' }} onClick={() => {
            localStorage.setItem('ocrProvider', ocrProvider);
            localStorage.setItem('geminiApiKey', geminiApiKey);
            localStorage.setItem('geminiModel', geminiModel);
            setSaved('ocr');
            db.showToast('OCR設定を保存しました', 'success');
          }}>
            OCR設定を保存
          </button>
          {ocrProvider === 'gemini' && geminiApiKey && (
            <span style={{ fontSize: '12px', color: 'var(--success-color)', fontWeight: '600' }}>
              ✓ APIキー設定済み
            </span>
          )}
          {ocrProvider === 'gemini' && !geminiApiKey && (
            <span style={{ fontSize: '12px', color: '#f59e0b', fontWeight: '600' }}>
              ⚠ APIキー未設定（Tesseractにフォールバック）
            </span>
          )}
        </div>
        {saved === 'ocr' && <p className="success-message" style={{ marginTop: '10px' }}>✓ 保存しました</p>}

        {ocrProvider === 'gemini' && (
          <div style={{ marginTop: '16px', padding: '14px', background: 'var(--bg-alt)', border: '1px solid var(--border)', borderRadius: '12px' }}>
            <p style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '8px' }}>Gemini OCR の利点</p>
            <ul style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.8', paddingLeft: '16px', margin: 0 }}>
              <li>手書き領収書も高精度で読取</li>
              <li>金額だけでなく日付・店名・品目も抽出可能</li>
              <li>PDF領収書にも対応</li>
              <li>複数言語（日本語+英語）の混在に強い</li>
              <li>マネーフォワードへの仕訳データ自動生成に活用可能</li>
            </ul>
          </div>
        )}
      </div>}

      {/* ===== Category management - admin only ===== */}
      {user.role === 'admin' && (
        <div className="settings-section">
          <div className="settings-title">📝 経費カテゴリ管理</div>
          <table style={{ marginBottom: '20px' }}>
            <thead>
              <tr><th>アイコン</th><th>カテゴリ名</th><th></th></tr>
            </thead>
            <tbody>
              {db.categories.map((c, idx) => (
                <tr key={c.id}>
                  {editingCatId === c.id ? (
                    <>
                      <td>
                        <input type="text" className="form-control" value={editCatIcon} onChange={e => setEditCatIcon(e.target.value)} maxLength={2} style={{ width: '50px', fontSize: '20px', textAlign: 'center', padding: '4px' }} />
                      </td>
                      <td>
                        <input type="text" className="form-control" value={editCatName} onChange={e => setEditCatName(e.target.value)} style={{ fontSize: '13px', padding: '6px 10px' }} />
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <button className="btn btn-primary btn-sm" style={{ marginRight: '4px' }} onClick={handleSaveEditCategory}>保存</button>
                        <button className="btn btn-secondary btn-sm" onClick={() => setEditingCatId(null)}>キャンセル</button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td style={{ fontSize: '20px' }}>{c.icon}</td>
                      <td>{c.name}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <button className="btn btn-secondary btn-sm" style={{ marginRight: '4px', padding: '2px 6px', fontSize: '11px' }} disabled={idx === 0} onClick={() => handleReorderCategory(c.id, 'up')}>▲</button>
                        <button className="btn btn-secondary btn-sm" style={{ marginRight: '4px', padding: '2px 6px', fontSize: '11px' }} disabled={idx === db.categories.length - 1} onClick={() => handleReorderCategory(c.id, 'down')}>▼</button>
                        <button className="btn btn-secondary btn-sm" style={{ marginRight: '4px' }} onClick={() => handleEditCategory(c.id)}>編集</button>
                        <button className="btn btn-danger btn-sm" onClick={() => handleDeleteCategory(c.id)}>削除</button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>

          {/* Icon picker + Add */}
          <div style={{ marginBottom: '16px' }}>
            <label className="form-label">アイコンを選択</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px', padding: '12px', background: 'var(--bg-alt)', borderRadius: '10px', border: '1px solid var(--border)' }}>
              {['🚌','🚄','✈️','🏨','🍽','🍺','📝','📱','💼','📚','🖥','📮','📦','🚗','⛽','🏥','💊','🎓','🏢','📊','🔧','🎁','👔','🧾','💡','📸','🖨','🛒','☕','🍱','🎫','📎'].map(e => (
                <button key={e} onClick={() => setCatIcon(e)}
                  style={{
                    fontSize: '20px', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    borderRadius: '8px', border: catIcon === e ? '2px solid var(--text-accent)' : '1px solid transparent',
                    background: catIcon === e ? 'rgba(59,130,246,0.15)' : 'transparent', cursor: 'pointer',
                  }}>{e}</button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
            <div style={{ flex: '0 0 80px' }}>
              <label className="form-label">アイコン</label>
              <input type="text" className="form-control" value={catIcon} onChange={e => setCatIcon(e.target.value)} maxLength={2} style={{ fontSize: '20px', textAlign: 'center' }} />
            </div>
            <div style={{ flex: 1 }}>
              <label className="form-label">カテゴリ名</label>
              <input type="text" className="form-control" value={catName} onChange={e => setCatName(e.target.value)} placeholder="カテゴリ名を入力" />
            </div>
            <button className="btn btn-primary" style={{ width: 'auto' }} onClick={handleAddCategory}>追加</button>
          </div>

          {/* Import / Export */}
          <div style={{ display: 'flex', gap: '8px', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
            <button className="btn btn-secondary btn-sm" onClick={() => {
              const json = JSON.stringify(db.categories, null, 2);
              const blob = new Blob([json], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a'); a.href = url; a.download = `カテゴリ_${new Date().toISOString().slice(0, 10)}.json`; a.click();
              URL.revokeObjectURL(url);
              db.showToast('カテゴリをエクスポートしました', 'success');
            }}>📤 エクスポート</button>
            <button className="btn btn-secondary btn-sm" onClick={() => {
              const input = document.createElement('input');
              input.type = 'file'; input.accept = '.json';
              input.onchange = async (e) => {
                const file = (e.target as HTMLInputElement).files?.[0];
                if (!file) return;
                try {
                  const text = await file.text();
                  const imported = JSON.parse(text);
                  if (Array.isArray(imported) && imported.every((c: any) => c.id && c.name && c.icon)) {
                    await db.saveCategories(imported);
                    db.showToast(`${imported.length}件のカテゴリをインポートしました`, 'success');
                  } else { db.showToast('無効なフォーマットです', 'error'); }
                } catch { db.showToast('ファイルの読み込みに失敗しました', 'error'); }
              };
              input.click();
            }}>📥 インポート</button>
          </div>
        </div>
      )}

      {/* ===== Tax rate management - admin only ===== */}
      {user.role === 'admin' && (
        <div className="settings-section">
          <div className="settings-title">💰 税率設定</div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '16px', lineHeight: '1.6' }}>
            税率が変更された場合にここから更新できます。変更は新規申請から適用されます。
          </p>
          <TaxRateEditor />
        </div>
      )}

      {/* ===== Profile info ===== */}
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
