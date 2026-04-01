// Google Drive upload service
// Loaded via CDN scripts - this provides TypeScript types and wrapper

export interface DriveSettings {
  clientId: string;
  apiKey: string;
  folderId: string;
}

export function getDriveSettings(): DriveSettings | null {
  if (typeof window === 'undefined') return null;
  const s = JSON.parse(localStorage.getItem('googleDriveSettings') || '{}');
  if (!s.clientId || !s.folderId) return null;
  return s;
}

export function saveDriveSettings(settings: DriveSettings) {
  localStorage.setItem('googleDriveSettings', JSON.stringify(settings));
}
