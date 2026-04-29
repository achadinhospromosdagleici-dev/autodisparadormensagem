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
    const { action, baseUrl, apiKey, instanceName, phoneNumber, to, message, webhookUrl, events } = await req.json();

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
        const endpoints = [
          `${base}/instance/all`,
          `${base}/manager/api/instance/list`,
          `${base}/api/instance/list`,
        ];
        
        let lastError = '';
        let data: any = null;
        
        for (const endpoint of endpoints) {
          try {
            const res = await fetch(endpoint, { headers, method: 'GET' });
            if (res.ok) {
              data = await res.json();
              break;
            }
            lastError = await res.text();
          } catch (e) {
            lastError = String(e);
          }
        }
        
        if (!data) {
          return jsonResponse({ 
            error: 'Nenhuma instância encontrada', 
            detail: lastError,
            tried: endpoints,
            baseUrl: base 
          }, 200);
        }

        const instances = data?.data || data?.instances || data || [];

        const normalized = (Array.isArray(instances) ? instances : []).map((inst: any) => ({
          instanceName: inst.name || '',
          status: inst.connected ? 'open' : 'close',
          phone: inst.jid ? inst.jid.split('@')[0] : '',
          profileName: inst.profileName || '',
          profilePictureUrl: inst.profilePicUrl || '',
        }));

        const enriched = await Promise.all(
          normalized.map(async (inst: any) => {
            if (!inst.instanceName) return inst;
            try {
              const stateRes = await fetch(`${base}/manager/api/instance/connectionState/${inst.instanceName}`, { headers });
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

        // Verificar se instância já existe
        const listRes = await fetch(`${base}/instance/all`, { headers, method: 'GET' });
        let existingInstances: any[] = [];
        if (listRes.ok) {
          const data = await listRes.json();
          existingInstances = data?.data || data?.instances || data || [];
          if (!Array.isArray(existingInstances)) existingInstances = [];
        }

        const existing = existingInstances.find((inst: any) => {
          return inst.name === instanceName;
        });

        if (existing) {
          return jsonResponse({
            action: 'existing',
            instanceName: existing.name,
            status: existing.connected ? 'open' : 'close',
            phone: existing.jid ? existing.jid.split('@')[0] : '',
            message: 'Instância já existe, reutilizando.',
          });
        }

        // Criar nova instância
        const createRes = await fetch(`${base}/instance/create`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            instanceName,
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
          qrcode: created.qrcode?.base64 || created.base64 || created.qrcode || '',
          pairingCode: created.pairingCode || '',
          status: 'close',
        });
      }

      // ── ETAPA 2: Obter QR Code para conexão ──
      case 'connect': {
        if (!instanceName) {
          return jsonResponse({ error: 'instanceName is required' }, 400);
        }

        const connectRes = await fetch(`${base}/manager/api/instance/connect/${instanceName}`, {
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

        const stateRes = await fetch(`${base}/manager/api/instance/connectionState/${instanceName}`, { headers });
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

        await fetch(`${base}/manager/api/instance/logout/${instanceName}`, {
          method: 'DELETE',
          headers,
        });

        return jsonResponse({ success: true, message: 'Instância desconectada' });
      }

      // ── ETAPA 3: Enviar mensagem ──
      case 'sendMessage': {
        if (!instanceName || !to || !message) {
          return jsonResponse({ error: 'instanceName, to, and message are required' }, 400);
        }

        const statusRes = await fetch(`${base}/manager/api/instance/connectionState/${instanceName}`, { headers });
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
          case 'buttons': {
            endpoint = `${base}/message/sendButtons/${instanceName}`;
            const btns = Array.isArray(message.buttons) ? message.buttons : [];
            body = {
              number: to,
              title: message.title || '',
              description: message.content || '',
              footer: message.footer || '',
              buttons: btns.map((b: any, idx: number) => {
                if (b.type === 'url') {
                  return { type: 'url', displayText: b.label, url: b.value };
                }
                if (b.type === 'phone') {
                  return { type: 'call', displayText: b.label, phoneNumber: b.value };
                }
                return { type: 'reply', displayText: b.label, id: b.value || `btn_${idx}` };
              }),
            };
            break;
          }
          case 'link': {
            const linkText = message.linkUrl
              ? `${message.content}\n\n${message.linkUrl}`
              : message.content;
            body = { number: to, text: linkText, linkPreview: true };
            break;
          }
          case 'contact':
            endpoint = `${base}/message/sendContact/${instanceName}`;
            body = {
              number: to,
              contact: [
                {
                  fullName: message.contactName || message.content,
                  phoneNumber: message.contactNumber || '',
                }
              ]
            };
            break;
          case 'list': {
            endpoint = `${base}/message/sendList/${instanceName}`;
            const sections = Array.isArray(message.sections) ? message.sections : [];
            body = {
              number: to,
              title: message.title || '',
              description: message.content || '',
              buttonText: message.btnTitle || 'Selecionar',
              footerText: message.btnFooter || '',
              sections: sections.map((section: any) => ({
                title: section.title,
                rows: (section.rows || []).map((row: any, idx: number) => ({
                  title: row.title,
                  description: row.description || '',
                  rowId: row.rowId || row.id || `row_${idx}`,
                })),
              })),
            };
            break;
          }
          case 'carousel': {
            endpoint = `${base}/send/carousel/${instanceName}`;
            const cards = Array.isArray(message.cards) ? message.cards : [];
            body = {
              number: to,
              cards: cards.map((card: any) => ({
                header: card.image ? { imageUrl: card.image } : undefined,
                body: card.title ? { text: card.title } : undefined,
                footer: card.footer ? { text: card.footer } : undefined,
                action: {
                  buttons: (card.buttons || []).map((b: any, idx: number) => {
                    if (b.type === 'url') {
                      return { type: 'url', displayText: b.label, url: b.value };
                    }
                    if (b.type === 'phone') {
                      return { type: 'call', displayText: b.label, phoneNumber: b.value };
                    }
                    return { type: 'reply', displayText: b.label, id: b.value || `btn_${idx}` };
                  }),
                },
              })),
            };
            break;
          }
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

      // ── WEBHOOK: Configurar webhook ──
      case 'setWebhook': {
        if (!instanceName || !webhookUrl) {
          return jsonResponse({ error: 'instanceName and webhookUrl are required' }, 400);
        }

        const webhookRes = await fetch(`${base}/webhook/${instanceName}`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            enabled: true,
            url: webhookUrl,
            webhookByEvents: false,
            events: events || ['MESSAGES_UPSERT', 'MESSAGES_UPDATE', 'CONNECTION_UPDATE'],
          }),
        });

        if (!webhookRes.ok) {
          const text = await webhookRes.text();
          return jsonResponse({ error: `Erro ao configurar webhook: ${webhookRes.status}`, detail: text }, webhookRes.status);
        }

        const webhookData = await webhookRes.json();
        return jsonResponse({ success: true, webhookUrl, data: webhookData });
      }

      // ─�� WEBHOOK: Remover webhook ──
      case 'removeWebhook': {
        if (!instanceName) {
          return jsonResponse({ error: 'instanceName is required' }, 400);
        }

        const removeRes = await fetch(`${base}/webhook/${instanceName}`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            enabled: false,
          }),
        });

        if (!removeRes.ok) {
          const text = await removeRes.text();
          return jsonResponse({ error: `Erro ao remover webhook: ${removeRes.status}`, detail: text }, removeRes.status);
        }

        return jsonResponse({ success: true, message: 'Webhook removido' });
      }

      // ── WEBHOOK: Buscar configuração atual ──
      case 'getWebhook': {
        if (!instanceName) {
          return jsonResponse({ error: 'instanceName is required' }, 400);
        }

        const getRes = await fetch(`${base}/webhook/find/${instanceName}`, { headers });

        if (!getRes.ok) {
          const text = await getRes.text();
          return jsonResponse({ error: `Erro ao buscar webhook: ${getRes.status}`, detail: text }, getRes.status);
        }

        const getData = await getRes.json();
        return jsonResponse({
          enabled: getData.enabled || false,
          url: getData.url || '',
          events: getData.events || [],
        });
      }

      default:
        return jsonResponse({ error: `Ação desconhecida: ${action}` }, 400);
    }
  } catch (error: any) {
    console.error('[evolution-go-proxy] Error:', error);
    return jsonResponse({ error: error.message }, 500);
  }
});