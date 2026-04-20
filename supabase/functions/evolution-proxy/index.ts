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
    const { action, baseUrl, apiKey, instanceName, phoneNumber, to, message } = await req.json();

    if (!baseUrl || !apiKey) {
      return jsonResponse({ error: 'baseUrl and apiKey are required' }, 400);
    }

    const headers = {
      'Content-Type': 'application/json',
      apikey: apiKey,
    };
    const base = baseUrl.replace(/\/$/, '');

    switch (action) {
      // ── ETAPA 1: Listar instâncias ──
      case 'fetchInstances': {
        const res = await fetch(`${base}/instance/fetchInstances`, { headers });
        if (!res.ok) {
          const text = await res.text();
          return jsonResponse({ error: `Erro ao buscar instâncias: ${res.status}`, detail: text }, res.status);
        }
        const instances = await res.json();

        // Normalize to consistent format
        const normalized = (Array.isArray(instances) ? instances : []).map((inst: any) => ({
          instanceName: inst.instance?.instanceName || inst.instanceName || inst.name || '',
          status: inst.instance?.status || inst.status || 'close',
          phone: inst.instance?.owner || inst.owner || inst.phone || '',
          profileName: inst.instance?.profileName || inst.profileName || '',
          profilePictureUrl: inst.instance?.profilePictureUrl || inst.profilePictureUrl || '',
        }));

       // Enrich each instance with real connectionState
       const enriched = await Promise.all(
         normalized.map(async (inst: any) => {
           if (!inst.instanceName) return inst;
           try {
             const stateRes = await fetch(`${base}/instance/connectionState/${inst.instanceName}`, { headers });
             if (stateRes.ok) {
               const stateData = await stateRes.json();
               const state = stateData?.instance?.state || stateData?.state || inst.status;
               return {
                 ...inst,
                 status: state === 'open' || state === 'connected' ? 'open' : state,
                 phone: inst.phone || stateData?.instance?.owner || '',
               };
             }
           } catch {}
           return inst;
         })
       );

       return jsonResponse({ instances: enriched });
      }

      // ── ETAPA 1: Verificar duplicação antes de criar ──
      case 'findOrCreate': {
        if (!instanceName) {
          return jsonResponse({ error: 'instanceName is required' }, 400);
        }

        // 1. Fetch all existing instances
        const listRes = await fetch(`${base}/instance/fetchInstances`, { headers });
        let existingInstances: any[] = [];
        if (listRes.ok) {
          existingInstances = await listRes.json();
          if (!Array.isArray(existingInstances)) existingInstances = [];
        }

        // 2. Check for existing instance with same name
        const existing = existingInstances.find((inst: any) => {
          const name = inst.instance?.instanceName || inst.instanceName || inst.name || '';
          return name === instanceName;
        });

        if (existing) {
          const status = existing.instance?.status || existing.status || 'close';
          return jsonResponse({
            action: 'existing',
            instanceName: existing.instance?.instanceName || existing.instanceName,
            status,
            phone: existing.instance?.owner || existing.owner || '',
            message: 'Instância já existe, reutilizando.',
          });
        }

        // 3. Create new instance
        const createRes = await fetch(`${base}/instance/create`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            instanceName,
            integration: 'WHATSAPP-BAILEYS',
            qrcode: true,
          }),
        });

        if (!createRes.ok) {
          const text = await createRes.text();
          return jsonResponse({ error: `Erro ao criar instância: ${createRes.status}`, detail: text }, createRes.status);
        }

        const created = await createRes.json();
        return jsonResponse({
          action: 'created',
          instanceName,
          qrcode: created.qrcode?.base64 || created.base64 || '',
          pairingCode: created.qrcode?.pairingCode || created.pairingCode || '',
          status: 'close',
        });
      }

      // ── ETAPA 2: Obter QR Code para conexão ──
      case 'connect': {
        if (!instanceName) {
          return jsonResponse({ error: 'instanceName is required' }, 400);
        }

        const connectRes = await fetch(`${base}/instance/connect/${instanceName}`, {
          headers,
        });

        if (!connectRes.ok) {
          const text = await connectRes.text();
          return jsonResponse({ error: `Erro ao conectar: ${connectRes.status}`, detail: text }, connectRes.status);
        }

        const data = await connectRes.json();
        return jsonResponse({
          qrcode: data.base64 || data.qrcode?.base64 || '',
          pairingCode: data.pairingCode || data.code || '',
        });
      }

      // ── ETAPA 2: Verificar status da conexão ──
      case 'connectionState': {
        if (!instanceName) {
          return jsonResponse({ error: 'instanceName is required' }, 400);
        }

        const stateRes = await fetch(`${base}/instance/connectionState/${instanceName}`, { headers });
        if (!stateRes.ok) {
          const text = await stateRes.text();
          return jsonResponse({ error: `Erro ao verificar status: ${stateRes.status}`, detail: text }, stateRes.status);
        }

        const stateData = await stateRes.json();
        const state = stateData?.instance?.state || stateData?.state || 'close';
        return jsonResponse({
          instanceName,
          status: state,
          connected: state === 'open' || state === 'connected',
        });
      }

      // ── ETAPA 2: Desconectar/Logout instância ──
      case 'logout': {
        if (!instanceName) {
          return jsonResponse({ error: 'instanceName is required' }, 400);
        }

        await fetch(`${base}/instance/logout/${instanceName}`, {
          method: 'DELETE',
          headers,
        });

        return jsonResponse({ success: true, message: 'Instância desconectada' });
      }

      // ── ETAPA 3: Enviar mensagem com validação de status ──
      case 'sendMessage': {
        if (!instanceName || !to || !message) {
          return jsonResponse({ error: 'instanceName, to, and message are required' }, 400);
        }

        // 1. Validate instance status before sending
        const statusRes = await fetch(`${base}/instance/connectionState/${instanceName}`, { headers });
        if (statusRes.ok) {
          const statusData = await statusRes.json();
          const state = statusData?.instance?.state || statusData?.state || 'close';
          if (state !== 'open' && state !== 'connected') {
            return jsonResponse({
              error: 'Instância não está conectada',
              status: state,
              suggestion: 'reconnect',
              message: 'Reconecte a instância antes de enviar mensagens.',
            }, 422);
          }
        }

        // 2. Build message payload based on type
        const msgType = message.type || 'text';
        let endpoint = `${base}/message/sendText/${instanceName}`;
        let body: any;

        switch (msgType) {
          case 'text':
            body = { number: to, text: message.content };
            break;
          case 'image':
            endpoint = `${base}/message/sendMedia/${instanceName}`;
            body = {
              number: to,
              mediatype: 'image',
              media: message.mediaUrl,
              caption: message.caption || message.content,
            };
            break;
          case 'audio':
            endpoint = `${base}/message/sendWhatsAppAudio/${instanceName}`;
            body = { number: to, audio: message.mediaUrl };
            break;
          case 'video':
            endpoint = `${base}/message/sendMedia/${instanceName}`;
            body = {
              number: to,
              mediatype: 'video',
              media: message.mediaUrl,
              caption: message.caption || message.content,
            };
            break;
          case 'document':
            endpoint = `${base}/message/sendMedia/${instanceName}`;
            body = {
              number: to,
              mediatype: 'document',
              media: message.mediaUrl,
              caption: message.caption || '',
              fileName: message.filename || 'document',
            };
            break;
          default:
            body = { number: to, text: message.content };
        }

        const sendRes = await fetch(endpoint, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        });

        if (!sendRes.ok) {
          const text = await sendRes.text();
          return jsonResponse({ error: `Erro ao enviar: ${sendRes.status}`, detail: text }, sendRes.status);
        }

        const sendData = await sendRes.json();
        return jsonResponse({ success: true, data: sendData });
      }

      default:
        return jsonResponse({ error: `Ação desconhecida: ${action}` }, 400);
    }
  } catch (error: any) {
    console.error('[evolution-proxy] Error:', error);
    return jsonResponse({ error: error.message }, 500);
  }
});
