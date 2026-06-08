import { FastifyInstance } from 'fastify';

function normalizeUrl(url: string): string {
  if (!url) return url;
  return url.startsWith('http://') || url.startsWith('https://') ? url : `https://${url}`;
}

export async function evolutionGoRoutes(app: FastifyInstance) {
  app.post('/', async (request, reply) => {
    const { action, baseUrl: rawBaseUrl, apiKey, instanceName, to, message, webhookUrl, events } = request.body as any;
    const baseUrl = normalizeUrl(rawBaseUrl);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'apikey': apiKey,
      'Authorization': `Bearer ${apiKey}`,
    };

    async function fetchFirstSuccessful(urls: string[], options?: any) {
      for (const url of urls) {
        try {
          const res = await fetch(url, options || { method: 'GET', headers });
          if (res.ok) return res.json();
        } catch {}
      }
      return null;
    }

    try {
      switch (action) {
        case 'fetchInstances': {
          const data = await fetchFirstSuccessful([
            `${baseUrl}/instance/all`,
            `${baseUrl}/manager/api/instance/list`,
            `${baseUrl}/api/instance/list`,
          ]);
          return data || [];
        }
        case 'findOrCreate': {
          const data = await fetchFirstSuccessful([
            `${baseUrl}/instance/all`,
            `${baseUrl}/manager/api/instance/list`,
            `${baseUrl}/api/instance/list`,
          ]);
          const list = Array.isArray(data) ? data : [];
          const existing = list.find((i: any) => i.name === instanceName);
          if (existing) return existing;
          const res = await fetch(`${baseUrl}/instance/create`, { method: 'POST', headers, body: JSON.stringify({ instanceName, qrcode: true }) });
          return res.json();
        }
        case 'connect': {
          const res = await fetch(`${baseUrl}/manager/api/instance/connect/${instanceName}`, { method: 'GET', headers });
          return res.json();
        }
        case 'connectionState': {
          const res = await fetch(`${baseUrl}/manager/api/instance/connectionState/${instanceName}`, { method: 'GET', headers });
          return res.json();
        }
        case 'logout': {
          const res = await fetch(`${baseUrl}/manager/api/instance/logout/${instanceName}`, { method: 'DELETE', headers });
          return res.json();
        }
        case 'sendMessage': {
          const msgType = message?.type || 'text';
          const toNumber = to;
          if (['image', 'audio', 'video', 'document'].includes(msgType)) {
            const res = await fetch(`${baseUrl}/message/sendMedia/${instanceName}`, { method: 'POST', headers, body: JSON.stringify({ number: toNumber, mediatype: msgType, media: message?.content, caption: message?.caption, fileName: message?.fileName }) });
            return res.json();
          }
          if (msgType === 'buttons') {
            const res = await fetch(`${baseUrl}/message/sendButtons/${instanceName}`, { method: 'POST', headers, body: JSON.stringify({ number: toNumber, title: message?.title, description: message?.description, footer: message?.footer, buttons: message?.buttons }) });
            return res.json();
          }
          if (msgType === 'list') {
            const res = await fetch(`${baseUrl}/message/sendList/${instanceName}`, { method: 'POST', headers, body: JSON.stringify({ number: toNumber, title: message?.title, description: message?.description, buttonText: message?.buttonText, sections: message?.sections }) });
            return res.json();
          }
          if (msgType === 'carousel') {
            const res = await fetch(`${baseUrl}/send/carousel/${instanceName}`, { method: 'POST', headers, body: JSON.stringify({ number: toNumber, cards: message?.cards }) });
            return res.json();
          }
          if (msgType === 'contact') {
            const res = await fetch(`${baseUrl}/message/sendContact/${instanceName}`, { method: 'POST', headers, body: JSON.stringify({ number: toNumber, contact: message?.contact }) });
            return res.json();
          }
          const res = await fetch(`${baseUrl}/message/sendText/${instanceName}`, { method: 'POST', headers, body: JSON.stringify({ number: toNumber, text: message?.text || message?.content || '', delay: 1, presence: 'composing' }) });
          return res.json();
        }
        case 'setWebhook': {
          const res = await fetch(`${baseUrl}/webhook/${instanceName}`, { method: 'POST', headers, body: JSON.stringify({ url: webhookUrl, events, webhookByEvents: true }) });
          return res.json();
        }
        case 'removeWebhook': {
          const res = await fetch(`${baseUrl}/webhook/${instanceName}`, { method: 'DELETE', headers });
          return res.json();
        }
        case 'getWebhook': {
          const res = await fetch(`${baseUrl}/webhook/find/${instanceName}`, { method: 'GET', headers });
          return res.json();
        }
        default:
          return reply.status(400).send({ error: `Unknown action: ${action}` });
      }
    } catch (error: any) {
      return reply.status(502).send({ error: error.message });
    }
  });
}
