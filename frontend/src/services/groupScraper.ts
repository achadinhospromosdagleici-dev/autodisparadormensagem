import { api } from '@/lib/api';

export interface ScrapedGroup {
  name: string;
  link: string;
  source: string;
}

export async function searchWhatsAppGroups(keyword: string): Promise<ScrapedGroup[]> {
  try {
    const response = await api.post('/proxy/group-scraper', { keyword });
    return response.data?.groups || [];
  } catch (err) {
    console.error('[GroupScraper] Error:', err);
    return [];
  }
}
