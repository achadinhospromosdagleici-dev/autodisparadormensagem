import { supabase } from '@/integrations/supabase/client';

export interface ScrapedGroup {
  name: string;
  link: string;
  source: string;
}

export async function searchWhatsAppGroups(keyword: string): Promise<ScrapedGroup[]> {
  try {
    const { data, error } = await supabase.functions.invoke('group-scraper', {
      body: { keyword },
    });
    if (error) throw error;
    return data?.groups || [];
  } catch (err) {
    console.error('[GroupScraper] Error:', err);
    return [];
  }
}
