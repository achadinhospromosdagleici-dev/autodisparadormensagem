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
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const endpoint = formData.get('endpoint') as string || Deno.env.get('S3_ENDPOINT') || 'https://s3minio.bigcreditos.com.br';
    const accessKey = formData.get('accessKey') as string || Deno.env.get('S3_ACCESS_KEY') || 'ztyD3jX470hl2UsCvXMb';
    const secretKey = formData.get('secretKey') as string || Deno.env.get('S3_SECRET_KEY') || 'eA7uptli3Q4EqIOlkce0Rku532hvyVbSbndaZ6Uh';
    const bucket = formData.get('bucket') as string || Deno.env.get('S3_BUCKET') || 'chatwoot';
    const region = formData.get('region') as string || Deno.env.get('S3_REGION') || 'ENAM';
    
    if (!file) {
      return new Response(JSON.stringify({ error: 'No file provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[s3-upload] Config:', { endpoint, bucket, region, hasAccessKey: !!accessKey, hasSecretKey: !!secretKey });

    const fileName = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const path = `campaign/${fileName}`;
    const url = `${endpoint.replace(/\/$/, '')}/${bucket}/${path}`;

    const body = await file.arrayBuffer();

    const date = new Date();
    const amzDate = date.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.substring(0, 8);

    async function hmac(key: string | Uint8Array, data: string): Promise<Uint8Array> {
      const keyData = typeof key === 'string' ? new TextEncoder().encode(key) : key;
      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );
      const signature = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(data));
      return new Uint8Array(signature);
    }

    async function sha256(data: string | ArrayBuffer): Promise<string> {
      const dataBuffer = typeof data === 'string' ? new TextEncoder().encode(data) : data;
      const hash = await crypto.subtle.digest('SHA-256', dataBuffer);
      return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
    }

    const algorithm = 'AWS4-HMAC-SHA256';
    const credentialScope = `${dateStamp}/${region}/s3/aws4_request`;

    const host = new URL(endpoint).host;
    const canonicalUri = `/${bucket}/${path}`;
    const canonicalQuerystring = '';

    const payloadHash = await sha256(body);

    const canonicalHeaders = [
      `host:${host}`,
      `x-amz-content-sha256:${payloadHash}`,
      `x-amz-date:${amzDate}`,
    ].join('\n');

    const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';

    const canonicalRequest = [
      'PUT',
      canonicalUri,
      canonicalQuerystring,
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join('\n');

    const canonicalRequestHash = await sha256(canonicalRequest);

    const stringToSign = [
      algorithm,
      amzDate,
      credentialScope,
      canonicalRequestHash,
    ].join('\n');

    const kSecret = 'AWS4' + secretKey;
    const kDate = await hmac(kSecret, dateStamp);
    const kRegion = await hmac(kDate, region);
    const kService = await hmac(kRegion, 's3');
    const kSigning = await hmac(kService, 'aws4_request');
    const signature = Array.from(await hmac(kSigning, stringToSign)).map(b => b.toString(16).padStart(2, '0')).join('');

    const authorization = `${algorithm} Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    console.log('[s3-upload] Uploading to:', url);

    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': authorization,
        'Content-Type': file.type,
        'x-amz-content-sha256': payloadHash,
        'x-amz-date': amzDate,
      },
      body: body,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[s3-upload] S3 error:', response.status, errorText);
      return new Response(JSON.stringify({ error: `Upload failed: ${response.status}`, details: errorText }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[s3-upload] Success:', url);

    return new Response(JSON.stringify({
      url: url,
      path: path,
      fileName: file.name,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('[s3-upload] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});