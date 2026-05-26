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

interface GroupResult {
  name: string;
  link: string;
  source: string;
}

function extractLinks(html: string, baseUrl: string): GroupResult[] {
  const results: GroupResult[] = [];
  const linkRegex = /href=["'](https?:\/\/chat\.whatsapp\.com\/[^"']+)["']/gi;
  let match;
  while ((match = linkRegex.exec(html)) !== null) {
    const link = match[1];
    if (!results.find(r => r.link === link)) {
      const nameMatch = html.substring(Math.max(0, match.index - 200), match.index).match(/<title>([^<]+)|alt=["']([^"']+)|>([^<]{3,50})<\//i);
      const name = nameMatch?.[1] || nameMatch?.[2] || nameMatch?.[3] || 'Grupo WhatsApp';
      results.push({ name: name.trim(), link, source: baseUrl });
    }
  }
  return results;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { keyword } = await req.json();
    if (!keyword || typeof keyword !== 'string') {
      return jsonResponse({ error: 'keyword is required' }, 400);
    }

    const kw = encodeURIComponent(keyword);
    const allResults: GroupResult[] = [];
    const seen = new Set<string>();

    const sources = [
      `https://www.gruposwhatsapp.com/search?q=${kw}`,
      `https://gruposwhatsapp.net/?s=${kw}`,
      `https://gruposwhatsapp.io/?s=${kw}`,
    ];

    for (const url of sources) {
      try {
        const res = await fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
          signal: AbortSignal.timeout(8000),
        });
        if (res.ok) {
          const html = await res.text();
          const links = extractLinks(html, url);
          for (const l of links) {
            if (!seen.has(l.link)) {
              seen.add(l.link);
              allResults.push(l);
            }
          }
        }
      } catch {
      }
    }

    return jsonResponse({ groups: allResults, total: allResults.length });
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : 'Unknown error' }, 500);
  }
});
