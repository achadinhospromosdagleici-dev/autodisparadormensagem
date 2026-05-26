import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

interface BusinessResult {
  name: string;
  address: string;
  phone: string;
  rating: number;
  website: string;
  placeId: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { keyword, maxResults = 20, apiKey } = await req.json();
    if (!keyword || typeof keyword !== 'string') {
      return jsonResponse({ error: 'keyword is required' }, 400);
    }
    if (!apiKey) {
      return jsonResponse({ error: 'apiKey is required. Configure em Configurações > Google Places.' }, 400);
    }

    const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(keyword + ' Brazil')}&key=${apiKey}&language=pt-BR`;
    const searchRes = await fetch(searchUrl);
    const searchData = await searchRes.json();

    if (!searchData.results || searchData.results.length === 0) {
      return jsonResponse({ businesses: [], total: 0 });
    }

    const places = searchData.results.slice(0, Math.min(maxResults, 50));
    const results: BusinessResult[] = [];

    for (const place of places) {
      const detailUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=name,formatted_phone_number,formatted_address,rating,website&key=${apiKey}&language=pt-BR`;
      try {
        const detailRes = await fetch(detailUrl);
        const detailData = await detailRes.json();
        const d = detailData.result || {};
        results.push({
          name: place.name || '',
          address: d.formatted_address || place.formatted_address || '',
          phone: d.formatted_phone_number || '',
          rating: d.rating || place.rating || 0,
          website: d.website || '',
          placeId: place.place_id,
        });
      } catch {
        results.push({
          name: place.name || '',
          address: place.formatted_address || '',
          phone: '',
          rating: place.rating || 0,
          website: '',
          placeId: place.place_id,
        });
      }
    }

    return jsonResponse({ businesses: results, total: results.length });
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : 'Unknown error' }, 500);
  }
});
