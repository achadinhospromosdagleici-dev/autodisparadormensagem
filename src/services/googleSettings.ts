import { supabase } from '@/integrations/supabase/client';

const STORAGE_KEY = 'google_places_key';

export interface GoogleSettings {
  apiKey: string;
}

export async function saveGoogleSettings(settings: GoogleSettings): Promise<void> {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    await supabase.from('google_settings').upsert({
      user_id: user.id,
      api_key: settings.apiKey,
      updated_at: new Date().toISOString(),
    });
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
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase.from('google_settings').select('*').eq('user_id', user.id).maybeSingle();
      if (data?.api_key) {
        const settings = { apiKey: data.api_key };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
        return settings;
      }
    }
  } catch {}

  return null;
}

export async function clearGoogleSettings(): Promise<void> {
  localStorage.removeItem(STORAGE_KEY);
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    await supabase.from('google_settings').delete().eq('user_id', user.id);
  }
}
