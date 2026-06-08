import { api } from '@/lib/api';
import { getCurrentUserId } from '@/lib/jwt';

const STORAGE_KEY = 'google_places_key';

export interface GoogleSettings {
  apiKey: string;
}

export async function saveGoogleSettings(settings: GoogleSettings): Promise<void> {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  const userId = getCurrentUserId();
  if (userId) {
    await api.post('/settings/google', { apiKey: settings.apiKey });
  }
}

export function loadGoogleSettings(): GoogleSettings | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return null;
}

export async function loadGoogleSettingsWithFallback(): Promise<GoogleSettings | null> {
  const local = loadGoogleSettings();
  if (local?.apiKey) return local;

  try {
    const userId = getCurrentUserId();
    if (userId) {
      const response = await api.get('/settings/google');
      if (response.data?.apiKey) {
        const settings = { apiKey: response.data.apiKey };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
        return settings;
      }
    }
  } catch {}

  return null;
}

export async function clearGoogleSettings(): Promise<void> {
  localStorage.removeItem(STORAGE_KEY);
  const userId = getCurrentUserId();
  if (userId) {
    await api.delete('/settings/google');
  }
}
