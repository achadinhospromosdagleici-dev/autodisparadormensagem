import { api } from '@/lib/api';
import { loadGoogleSettingsWithFallback } from './googleSettings';

export interface Business {
  name: string;
  address: string;
  phone: string;
  rating: number;
  website: string;
  placeId: string;
  cnpj: string;
  razaoSocial: string;
  cnae: string;
}

export async function searchBusinesses(keyword: string, maxResults: number = 20): Promise<Business[]> {
  try {
    const settings = await loadGoogleSettingsWithFallback();
    if (!settings?.apiKey) return [];

    const response = await api.post('/proxy/places', { keyword, maxResults, apiKey: settings.apiKey });
    return response.data?.businesses || [];
  } catch (err) {
    console.error('[BusinessSearch] Error:', err);
    return [];
  }
}
