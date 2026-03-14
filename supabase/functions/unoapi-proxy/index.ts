import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { baseUrl, token, endpoint } = await req.json();

    if (!baseUrl || !token) {
      return new Response(JSON.stringify({ error: 'baseUrl and token are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Only allow specific safe endpoints
    const allowedEndpoints = ['sessions', 'ping'];
    const cleanEndpoint = (endpoint || 'sessions').replace(/^\//, '');
    
    if (!allowedEndpoints.includes(cleanEndpoint)) {
      return new Response(JSON.stringify({ error: 'Endpoint not allowed' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const targetUrl = `${baseUrl.replace(/\/$/, '')}/${cleanEndpoint}`;
    
    const response = await fetch(targetUrl, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token,
      },
    });

    const contentType = response.headers.get('content-type') || '';
    let body: string;

    if (contentType.includes('application/json')) {
      const data = await response.json();
      body = JSON.stringify(data);
    } else {
      body = await response.text();
      // Wrap text in JSON
      body = JSON.stringify({ text: body });
    }

    return new Response(body, {
      status: response.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
