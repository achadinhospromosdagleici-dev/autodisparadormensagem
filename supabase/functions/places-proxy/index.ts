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
  cnpj: string;
  razaoSocial: string;
  cnae: string;
}

function extractCNPJ(text: string): string | null {
  const match = text.match(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}|\d{14}/);
  if (!match) return null;
  const cnpj = match[0].replace(/\D/g, '');
  return cnpj.length === 14 ? cnpj : null;
}

async function tryFetchCNPJ(website: string): Promise<string | null> {
  if (!website) return null;
  try {
    const res = await fetch(website, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const html = await res.text();
    return extractCNPJ(html);
  } catch {
    return null;
  }
}

async function searchCNPJbyName(name: string, address: string): Promise<string | null> {
  const query = encodeURIComponent(`${name} ${address.split(',')[0] || ''} CNPJ`.trim());
  try {
    const res = await fetch(`https://www.cnpj.biz/busca/${query}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const html = await res.text();
    return extractCNPJ(html);
  } catch {
    return null;
  }
}

async function enrichWithBrasilAPI(cnpj: string): Promise<{ razaoSocial: string; cnae: string; telefone: string } | null> {
  try {
    const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      razaoSocial: data.razao_social || '',
      cnae: data.cnae_fiscal_descricao || '',
      telefone: data.telefone || '',
    };
  } catch {
    return null;
  }
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
      return jsonResponse({ error: 'apiKey is required' }, 400);
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
      let phone = '';
      let website = '';
      let address = place.formatted_address || '';

      const detailUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=name,formatted_phone_number,formatted_address,rating,website&key=${apiKey}&language=pt-BR`;
      try {
        const detailRes = await fetch(detailUrl);
        const detailData = await detailRes.json();
        const d = detailData.result || {};
        phone = d.formatted_phone_number || '';
        website = d.website || '';
        address = d.formatted_address || address;
      } catch {}

      // Try to find CNPJ (multiple sources)
      let cnpj = '';
      let razaoSocial = '';
      let cnae = '';
      let cnpjPhone = '';

      // 1. Try website
      let foundCnpj = await tryFetchCNPJ(website);

      // 2. Try CNPJ directory by name
      if (!foundCnpj) {
        foundCnpj = await searchCNPJbyName(place.name, address);
      }

      if (foundCnpj) {
        cnpj = foundCnpj;
        const enriched = await enrichWithBrasilAPI(foundCnpj);
        if (enriched) {
          razaoSocial = enriched.razaoSocial;
          cnae = enriched.cnae;
          cnpjPhone = enriched.telefone;
        }
      }

      results.push({
        name: place.name || '',
        address,
        phone: cnpjPhone || phone,
        rating: place.rating || 0,
        website,
        placeId: place.place_id,
        cnpj,
        razaoSocial,
        cnae,
      });
    }

    return jsonResponse({ businesses: results, total: results.length });
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : 'Unknown error' }, 500);
  }
});
