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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { baseUrl, token, endpoint, method, body, isAdmin } = await req.json();

    if (!baseUrl || !token) {
      return jsonResponse({ error: 'baseUrl and token are required' }, 400);
    }

    const cleanBase = baseUrl.replace(/\/+$/, '');
    const rawEndpoint = endpoint || '/';
    const cleanEndpoint = rawEndpoint.startsWith('/') ? rawEndpoint : `/${rawEndpoint}`;
    const targetUrl = `${cleanBase}${cleanEndpoint}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (isAdmin) {
      headers['Authorization'] = token;
    } else {
      headers['token'] = token;
    }

    console.log('[wuzapi-proxy]', method || 'GET', targetUrl);

    const response = await fetch(targetUrl, {
      method: method || 'GET',
      headers,
      ...(body && method !== 'GET' ? { body: JSON.stringify(body) } : {}),
    });

    console.log('[wuzapi-proxy] Response status:', response.status);

    let data: any;
    const contentType = response.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      data = await response.json();
    } else {
      const text = await response.text();
      data = { text, status: response.status };
    }

    if (!response.ok) {
      return jsonResponse({
        error: `HTTP ${response.status}`,
        details: data
      }, response.status);
    }

    return jsonResponse(data);
  } catch (error: any) {
    console.error('[wuzapi-proxy] Error:', error);
    return jsonResponse({ error: error.message }, 500);
  }
});
