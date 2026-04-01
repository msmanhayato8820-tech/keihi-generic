// Google Drive upload service
// Uses Google Identity Services + Drive API (loaded via CDN in layout.tsx)

export interface DriveSettings {
  clientId: string;
  apiKey?: string;
  folderId: string;
}

export function getDriveSettings(): DriveSettings | null {
  if (typeof window === 'undefined') return null;
  try {
    const s = JSON.parse(localStorage.getItem('googleDriveSettings') || '{}');
    if (!s.clientId || !s.folderId) return null;
    return s as DriveSettings;
  } catch {
    return null;
  }
}

export function saveDriveSettings(settings: DriveSettings) {
  localStorage.setItem('googleDriveSettings', JSON.stringify(settings));
}

// Cached token client and access token
let _tokenClient: any = null;
let _accessToken: string | null = null;

async function getTokenClient(clientId: string): Promise<any> {
  const g = (window as any).google;
  if (!g?.accounts?.oauth2) {
    throw new Error('Google Identity Services が読み込まれていません。ページを再読み込みしてください。');
  }
  if (_tokenClient) return _tokenClient;
  _tokenClient = g.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: 'https://www.googleapis.com/auth/drive.file',
    callback: () => {},
  });
  return _tokenClient;
}

async function getAccessToken(clientId: string): Promise<string> {
  if (_accessToken) return _accessToken;
  const tokenClient = await getTokenClient(clientId);
  return new Promise((resolve, reject) => {
    tokenClient.callback = (res: any) => {
      if (res.access_token) {
        _accessToken = res.access_token;
        // Clear after 55 minutes (token expires in 1 hour)
        setTimeout(() => { _accessToken = null; }, 55 * 60 * 1000);
        resolve(res.access_token);
      } else {
        reject(new Error('アクセストークンの取得に失敗しました'));
      }
    };
    tokenClient.error_callback = (err: any) => {
      if (err?.type === 'popup_failed_to_open') {
        reject(new Error('ポップアップがブロックされています。ブラウザでこのサイトのポップアップを許可してください。'));
      } else if (err?.type === 'popup_closed') {
        reject(new Error('認証がキャンセルされました。'));
      } else {
        reject(new Error('認証エラー: ' + (err?.type || JSON.stringify(err))));
      }
    };
    tokenClient.requestAccessToken({ prompt: '' });
  });
}

export async function uploadFileToDrive(
  file: File,
  description: string
): Promise<{ id: string; name: string }> {
  const settings = getDriveSettings();
  if (!settings) {
    throw new Error('Google Drive設定が未完了です（設定ページでClientIDとフォルダIDを保存してください）');
  }

  const token = await getAccessToken(settings.clientId);
  const cleanFolderId = settings.folderId.split('?')[0].trim();
  const today = new Date().toISOString().split('T')[0];
  const uploadName = `${today}_${description || 'receipt'}_${file.name}`;

  const metadata = { name: uploadName, parents: [cleanFolderId] };
  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', file);

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name',
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    }
  );

  if (res.status === 401) {
    _accessToken = null;
    throw new Error('認証が期限切れです。再度お試しください。');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `アップロード失敗 (HTTP ${res.status})`);
  }
  return res.json();
}
