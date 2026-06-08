import { FastifyInstance } from 'fastify';

function normalizeUrl(url: string): string {
  if (!url) return url;
  return url.startsWith('http://') || url.startsWith('https://') ? url : `https://${url}`;
}

export async function evolutionRoutes(app: FastifyInstance) {
  app.post('/', async (request, reply) => {
    const { action, baseUrl: rawBaseUrl, apiKey, instanceName, to, message, webhookUrl, events } = request.body as any;
    const baseUrl = normalizeUrl(rawBaseUrl);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'apikey': apiKey,
    };

    try {
      switch (action) {
        case 'fetchInstances': {
          const res = await fetch(`${baseUrl}/instance/fetchInstances`, { headers });
          const data = await res.json() as any[];
          return data.map((inst) => ({ ...inst, connectionState: inst.connectionState || 'close' }));
        }
        case 'findOrCreate': {
          const listRes = await fetch(`${baseUrl}/instance/fetchInstances`, { headers });
          const instances = await listRes.json() as any[];
          const existing = instances.find((i: any) => i.instance?.name === instanceName);
          if (existing) return existing;
          const createRes = await fetch(`${baseUrl}/instance/create`, { method: 'POST', headers, body: JSON.stringify({ instanceName, qrcode: true }) });
          return createRes.json();
        }
        case 'connect': {
          const res = await fetch(`${baseUrl}/instance/connect/${instanceName}`, { method: 'GET', headers });
          return res.json();
        }
        case 'connectionState': {
          const res = await fetch(`${baseUrl}/instance/connectionState/${instanceName}`, { method: 'GET', headers });
          return res.json();
        }
        case 'logout': {
          const res = await fetch(`${baseUrl}/instance/logout/${instanceName}`, { method: 'DELETE', headers });
          return res.json();
        }
        case 'sendMessage': {
          const msgType = message?.type || 'text';
          const toNumber = to;
          if (['image', 'audio', 'video', 'document'].includes(msgType)) {
            const res = await fetch(`${baseUrl}/message/sendMedia/${instanceName}`, { method: 'POST', headers, body: JSON.stringify({ number: toNumber, options: { mediatype: msgType, media: message?.content, caption: message?.caption, fileName: message?.fileName } }) });
            return res.json();
          }
          if (msgType === 'buttons') {
            const res = await fetch(`${baseUrl}/message/sendButtons/${instanceName}`, { method: 'POST', headers, body: JSON.stringify({ number: toNumber, options: { title: message?.title, description: message?.description, footer: message?.footer, buttons: message?.buttons } }) });
            return res.json();
          }
          if (msgType === 'contact') {
            const res = await fetch(`${baseUrl}/message/sendContact/${instanceName}`, { method: 'POST', headers, body: JSON.stringify({ number: toNumber, options: message?.contact }) });
            return res.json();
          }
          const res = await fetch(`${baseUrl}/message/sendText/${instanceName}`, { method: 'POST', headers, body: JSON.stringify({ number: toNumber, options: { delay: 1, presence: 'composing' }, text: message?.text || message?.content || '' }) });
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
