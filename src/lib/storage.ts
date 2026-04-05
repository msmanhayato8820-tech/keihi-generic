// Unified storage provider abstraction
// Supports: Google Drive, AWS S3, OneDrive, Box, Dropbox, Backblaze B2, Cloudflare R2

// SECURITY WARNING: The S3 upload path in this file performs AWS Signature V4 signing
// entirely in the browser using credentials (accessKeyId + secretAccessKey) that are
// stored in localStorage. This means:
//   1. AWS credentials are exposed in the browser and accessible to any JavaScript
//      running on the page, including injected scripts.
//   2. Credentials stored in localStorage persist across sessions and are not scoped
//      to a single operation.
//   3. A compromised page (XSS) can silently exfiltrate the credentials.
//
// REQUIRED MIGRATION: Replace the client-side signing approach with server-side
// pre-signed URLs. The backend should generate a short-lived pre-signed PUT URL
// scoped to a single object key and return it to the client. The client then PUTs
// the file directly to that URL without ever receiving AWS credentials.
// See: https://docs.aws.amazon.com/AmazonS3/latest/userguide/PresignedUrlUploadObject.html
//
// Do NOT store secretAccessKey or accessKeyId in localStorage in production.

export type StorageProvider = 'google_drive' | 's3' | 'onedrive' | 'box' | 'dropbox' | 'backblaze_b2' | 'cloudflare_r2' | 'none';

export interface StorageResult {
  provider: StorageProvider;
  fileId: string;
  fileName: string;
  url?: string;
}

export interface S3Settings {
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  prefix: string; // folder path prefix
}

export interface OneDriveSettings {
  clientId: string;
  folderId: string;
}

export interface BoxSettings {
  accessToken: string;
  folderId: string;
}

export interface DropboxSettings {
  accessToken: string;
  folderPath: string; // e.g. "/receipts"
}

export interface B2Settings {
  applicationKeyId: string;
  applicationKey: string;
  bucketId: string;
  bucketName: string;
  region: string; // e.g. "us-west-004"
}

export interface R2Settings {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
}

// Get active provider
export function getActiveProvider(): StorageProvider {
  if (typeof window === 'undefined') return 'none';
  return (localStorage.getItem('storageProvider') as StorageProvider) || 'none';
}

export function setActiveProvider(provider: StorageProvider) {
  localStorage.setItem('storageProvider', provider);
}

// S3 settings
export function getS3Settings(): S3Settings | null {
  if (typeof window === 'undefined') return null;
  try {
    const s = JSON.parse(localStorage.getItem('s3Settings') || '{}');
    if (!s.bucket || !s.accessKeyId) return null;
    return s;
  } catch { return null; }
}

export function saveS3Settings(settings: S3Settings) {
  localStorage.setItem('s3Settings', JSON.stringify(settings));
}

// OneDrive settings
export function getOneDriveSettings(): OneDriveSettings | null {
  if (typeof window === 'undefined') return null;
  try {
    const s = JSON.parse(localStorage.getItem('oneDriveSettings') || '{}');
    if (!s.clientId) return null;
    return s;
  } catch { return null; }
}

export function saveOneDriveSettings(settings: OneDriveSettings) {
  localStorage.setItem('oneDriveSettings', JSON.stringify(settings));
}

// Box settings
export function getBoxSettings(): BoxSettings | null {
  if (typeof window === 'undefined') return null;
  try {
    const s = JSON.parse(localStorage.getItem('boxSettings') || '{}');
    if (!s.accessToken) return null;
    return s;
  } catch { return null; }
}

export function saveBoxSettings(settings: BoxSettings) {
  localStorage.setItem('boxSettings', JSON.stringify(settings));
}

// Dropbox settings
export function getDropboxSettings(): DropboxSettings | null {
  if (typeof window === 'undefined') return null;
  try {
    const s = JSON.parse(localStorage.getItem('dropboxSettings') || '{}');
    if (!s.accessToken) return null;
    return s;
  } catch { return null; }
}

export function saveDropboxSettings(settings: DropboxSettings) {
  localStorage.setItem('dropboxSettings', JSON.stringify(settings));
}

// Backblaze B2 settings
export function getB2Settings(): B2Settings | null {
  if (typeof window === 'undefined') return null;
  try {
    const s = JSON.parse(localStorage.getItem('b2Settings') || '{}');
    if (!s.applicationKeyId || !s.bucketId) return null;
    return s;
  } catch { return null; }
}

export function saveB2Settings(settings: B2Settings) {
  localStorage.setItem('b2Settings', JSON.stringify(settings));
}

// Cloudflare R2 settings
export function getR2Settings(): R2Settings | null {
  if (typeof window === 'undefined') return null;
  try {
    const s = JSON.parse(localStorage.getItem('r2Settings') || '{}');
    if (!s.accountId || !s.accessKeyId) return null;
    return s;
  } catch { return null; }
}

export function saveR2Settings(settings: R2Settings) {
  localStorage.setItem('r2Settings', JSON.stringify(settings));
}

// ===== Upload Functions =====

// Shared S3-compatible SigV4 signing and upload helper
async function s3CompatibleUpload(
  file: File, key: string, host: string, region: string,
  accessKeyId: string, secretAccessKey: string, service: string
): Promise<void> {
  const endpoint = `https://${host}/${encodeURIComponent(key)}`;

  const now = new Date();
  const dateStr = now.toISOString().replace(/[:-]|\.\d{3}/g, '').slice(0, 15) + 'Z';
  const shortDate = dateStr.slice(0, 8);

  // Simple HMAC-SHA256 signing
  const encoder = new TextEncoder();

  async function hmacSHA256(key: BufferSource, msg: string): Promise<ArrayBuffer> {
    const cryptoKey = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    return crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(msg));
  }

  async function sha256(data: ArrayBuffer | string): Promise<string> {
    const buf = typeof data === 'string' ? encoder.encode(data) : data;
    const hash = await crypto.subtle.digest('SHA-256', buf);
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  const fileBuffer = await file.arrayBuffer();
  const payloadHash = await sha256(fileBuffer);

  const scope = `${shortDate}/${region}/${service}/aws4_request`;
  const canonicalHeaders = `content-type:${file.type}\nhost:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${dateStr}\n`;
  const signedHeaders = 'content-type;host;x-amz-content-sha256;x-amz-date';
  const canonicalRequest = `PUT\n/${encodeURIComponent(key)}\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;
  const canonicalRequestHash = await sha256(canonicalRequest);
  const stringToSign = `AWS4-HMAC-SHA256\n${dateStr}\n${scope}\n${canonicalRequestHash}`;

  let signingKey: BufferSource = await hmacSHA256(encoder.encode('AWS4' + secretAccessKey), shortDate);
  signingKey = await hmacSHA256(signingKey, region);
  signingKey = await hmacSHA256(signingKey, service);
  signingKey = await hmacSHA256(signingKey, 'aws4_request');
  const signatureBytes = await hmacSHA256(signingKey, stringToSign);
  const signature = Array.from(new Uint8Array(signatureBytes)).map(b => b.toString(16).padStart(2, '0')).join('');

  const authorization = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const res = await fetch(endpoint, {
    method: 'PUT',
    headers: {
      'Content-Type': file.type,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': dateStr,
      'Authorization': authorization,
    },
    body: fileBuffer,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`アップロード失敗: ${res.status} ${text.slice(0, 200)}`);
  }
}

// AWS S3 upload (browser-direct using pre-signed style or simple PUT)
async function uploadToS3(file: File, description: string): Promise<StorageResult> {
  const settings = getS3Settings();
  if (!settings) throw new Error('S3設定が未完了です');

  const today = new Date().toISOString().split('T')[0];
  const key = `${settings.prefix ? settings.prefix + '/' : ''}${today}_${description || 'receipt'}_${file.name}`;

  const host = `${settings.bucket}.s3.${settings.region}.amazonaws.com`;

  await s3CompatibleUpload(
    file, key, host, settings.region,
    settings.accessKeyId, settings.secretAccessKey, 's3'
  );

  return {
    provider: 's3',
    fileId: key,
    fileName: file.name,
    url: `https://${host}/${encodeURIComponent(key)}`,
  };
}

// OneDrive upload (Microsoft Graph API)
async function uploadToOneDrive(file: File, description: string): Promise<StorageResult> {
  const settings = getOneDriveSettings();
  if (!settings) throw new Error('OneDrive設定が未完了です');

  // Get access token via MSAL popup
  const token = await getOneDriveToken(settings.clientId);
  const today = new Date().toISOString().split('T')[0];
  const fileName = `${today}_${description || 'receipt'}_${file.name}`;

  const uploadUrl = settings.folderId
    ? `https://graph.microsoft.com/v1.0/me/drive/items/${settings.folderId}:/${encodeURIComponent(fileName)}:/content`
    : `https://graph.microsoft.com/v1.0/me/drive/root:/${encodeURIComponent(fileName)}:/content`;

  const res = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': file.type,
    },
    body: file,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`OneDriveアップロード失敗: ${err?.error?.message || res.status}`);
  }

  const data = await res.json();
  return {
    provider: 'onedrive',
    fileId: data.id,
    fileName: data.name,
    url: data.webUrl,
  };
}

let _oneDriveToken: string | null = null;

async function getOneDriveToken(clientId: string): Promise<string> {
  if (_oneDriveToken) return _oneDriveToken;

  // Simple OAuth2 popup flow
  return new Promise((resolve, reject) => {
    const redirectUri = window.location.origin + '/login';
    const scope = 'Files.ReadWrite';
    const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${clientId}&response_type=token&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}&response_mode=fragment`;

    const popup = window.open(authUrl, 'onedrive_auth', 'width=500,height=700');
    if (!popup) { reject(new Error('ポップアップがブロックされています')); return; }

    const interval = setInterval(() => {
      try {
        if (popup.closed) { clearInterval(interval); reject(new Error('認証がキャンセルされました')); return; }
        const hash = popup.location.hash;
        if (hash.includes('access_token=')) {
          clearInterval(interval);
          const token = new URLSearchParams(hash.slice(1)).get('access_token');
          popup.close();
          if (token) { _oneDriveToken = token; setTimeout(() => { _oneDriveToken = null; }, 50 * 60 * 1000); resolve(token); }
          else reject(new Error('トークン取得失敗'));
        }
      } catch {}
    }, 500);
  });
}

// Box upload (Simple token-based)
async function uploadToBox(file: File, description: string): Promise<StorageResult> {
  const settings = getBoxSettings();
  if (!settings) throw new Error('Box設定が未完了です');

  const today = new Date().toISOString().split('T')[0];
  const fileName = `${today}_${description || 'receipt'}_${file.name}`;

  const form = new FormData();
  form.append('attributes', JSON.stringify({ name: fileName, parent: { id: settings.folderId } }));
  form.append('file', file);

  const res = await fetch('https://upload.box.com/api/2.0/files/content', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${settings.accessToken}` },
    body: form,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Boxアップロード失敗: ${err?.message || res.status}`);
  }

  const data = await res.json();
  const entry = data.entries?.[0];
  return {
    provider: 'box',
    fileId: entry?.id || '',
    fileName: entry?.name || fileName,
  };
}

// Dropbox upload (API v2)
async function uploadToDropbox(file: File, description: string): Promise<StorageResult> {
  const settings = getDropboxSettings();
  if (!settings) throw new Error('Dropbox設定が未完了です');

  const today = new Date().toISOString().split('T')[0];
  const fileName = `${today}_${description || 'receipt'}_${file.name}`;
  const path = `${settings.folderPath.replace(/\/$/, '')}/${fileName}`;

  const res = await fetch('https://content.dropboxapi.com/2/files/upload', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${settings.accessToken}`,
      'Dropbox-API-Arg': JSON.stringify({
        path,
        mode: 'add',
        autorename: true,
        mute: false,
      }),
      'Content-Type': 'application/octet-stream',
    },
    body: file,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Dropboxアップロード失敗: ${err?.error_summary || res.status}`);
  }

  const data = await res.json();
  return {
    provider: 'dropbox',
    fileId: data.id || '',
    fileName: data.name || fileName,
    url: data.path_display ? `https://www.dropbox.com/home${data.path_display}` : undefined,
  };
}

// Backblaze B2 upload (S3-compatible)
async function uploadToB2(file: File, description: string): Promise<StorageResult> {
  const settings = getB2Settings();
  if (!settings) throw new Error('Backblaze B2設定が未完了です');

  const today = new Date().toISOString().split('T')[0];
  const key = `${today}_${description || 'receipt'}_${file.name}`;

  const host = `${settings.bucketName}.s3.${settings.region}.backblazeb2.com`;

  await s3CompatibleUpload(
    file, key, host, settings.region,
    settings.applicationKeyId, settings.applicationKey, 's3'
  );

  return {
    provider: 'backblaze_b2',
    fileId: key,
    fileName: file.name,
    url: `https://${host}/${encodeURIComponent(key)}`,
  };
}

// Cloudflare R2 upload (S3-compatible)
async function uploadToR2(file: File, description: string): Promise<StorageResult> {
  const settings = getR2Settings();
  if (!settings) throw new Error('Cloudflare R2設定が未完了です');

  const today = new Date().toISOString().split('T')[0];
  const key = `${today}_${description || 'receipt'}_${file.name}`;

  const host = `${settings.bucketName}.${settings.accountId}.r2.cloudflarestorage.com`;

  await s3CompatibleUpload(
    file, key, host, 'auto',
    settings.accessKeyId, settings.secretAccessKey, 's3'
  );

  return {
    provider: 'cloudflare_r2',
    fileId: key,
    fileName: file.name,
    url: `https://${host}/${encodeURIComponent(key)}`,
  };
}

// ===== Unified Upload =====
export async function uploadFile(file: File, description: string): Promise<StorageResult | null> {
  const provider = getActiveProvider();

  switch (provider) {
    case 'google_drive': {
      // Delegate to existing gdrive.ts
      const { uploadFileToDrive, getDriveSettings } = await import('./gdrive');
      if (!getDriveSettings()) return null;
      const result = await uploadFileToDrive(file, description);
      return { provider: 'google_drive', fileId: result.id, fileName: result.name };
    }
    case 's3':
      return uploadToS3(file, description);
    case 'onedrive':
      return uploadToOneDrive(file, description);
    case 'box':
      return uploadToBox(file, description);
    case 'dropbox':
      return uploadToDropbox(file, description);
    case 'backblaze_b2':
      return uploadToB2(file, description);
    case 'cloudflare_r2':
      return uploadToR2(file, description);
    default:
      return null;
  }
}

// Provider display info
export const STORAGE_PROVIDERS = [
  { id: 'none' as StorageProvider, name: 'なし（ローカルのみ）', icon: '💾', description: 'クラウドにアップロードしない' },
  { id: 's3' as StorageProvider, name: 'AWS S3', icon: '☁️', description: 'Amazon S3バケットに保存（推奨：AWS利用中）', color: '#FF9900' },
  { id: 'google_drive' as StorageProvider, name: 'Google Drive', icon: '📁', description: 'Google Driveフォルダに保存', color: '#4285F4' },
  { id: 'onedrive' as StorageProvider, name: 'OneDrive', icon: '☁️', description: 'Microsoft OneDriveに保存', color: '#0078D4' },
  { id: 'box' as StorageProvider, name: 'Box', icon: '📦', description: 'Box.comに保存', color: '#0061D5' },
  { id: 'dropbox' as StorageProvider, name: 'Dropbox', icon: '📁', description: 'Dropboxに保存', color: '#0061FF' },
  { id: 'backblaze_b2' as StorageProvider, name: 'Backblaze B2', icon: '🔥', description: 'Backblaze B2に保存（S3互換）', color: '#E21E1E' },
  { id: 'cloudflare_r2' as StorageProvider, name: 'Cloudflare R2', icon: '☁️', description: 'Cloudflare R2に保存（エグレス無料）', color: '#F6821F' },
];
