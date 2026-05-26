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

  let targetUrl = '';
  let requestMethod = 'GET';

  try {
    const body = await req.json();
    const { baseUrl, token, endpoint, method, body: requestBody } = body;

    requestMethod = method || 'GET';

    if (!baseUrl || !token) {
      return jsonResponse({ error: 'baseUrl and token are required' }, 400);
    }

    // Normalize: strip trailing slash from baseUrl, ensure leading slash on endpoint
    const cleanBase = baseUrl.replace(/\/$/, '');
    const rawEndpoint = endpoint || '/sessions';
    const cleanEndpoint = rawEndpoint.startsWith('/') ? rawEndpoint : `/${rawEndpoint}`;
    targetUrl = `${cleanBase}${cleanEndpoint}`;

    console.log('[unoapi-proxy] →', requestMethod, targetUrl);

    const response = await fetch(targetUrl, {
      method: requestMethod,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token,
      },
      ...(requestBody && requestMethod !== 'GET' ? { body: JSON.stringify(requestBody) } : {}),
    });

    console.log('[unoapi-proxy] Response status:', response.status);

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
        details: data,
        targetUrl,
        method: requestMethod,
      }, response.status);
    }

    return jsonResponse(data);
  } catch (error: any) {
    console.error('[unoapi-proxy] Error:', requestMethod, targetUrl, error);
    return jsonResponse({
      error: error.message,
      type: error.constructor?.name || typeof error,
      targetUrl,
      method: requestMethod,
      details: error.cause || error.stack,
      hint: 'Verifique se o servidor UnoAPI está acessível pela internet e se a URL está correta.',
    }, 500);
  }
});