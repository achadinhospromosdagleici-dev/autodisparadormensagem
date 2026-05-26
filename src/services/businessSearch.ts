import { supabase } from '@/integrations/supabase/client';
import { loadGoogleSettingsWithFallback } from './googleSettings';

export interface Business {
  name: string;
  address: string;
  phone: string;
  rating: number;
  website: string;
  placeId: string;
}

export async function searchBusinesses(keyword: string, maxResults: number = 20): Promise<Business[]> {
  try {
    const settings = await loadGoogleSettingsWithFallback();
    if (!settings?.apiKey) return [];

    const { data, error } = await supabase.functions.invoke('places-proxy', {
      body: { keyword, maxResults, apiKey: settings.apiKey },
    });
    if (error) throw error;
    return data?.businesses || [];
  } catch (err) {
    console.error('[BusinessSearch] Error:', err);
    return [];
  }
}
