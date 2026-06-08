import { PrismaClient } from '@prisma/client';
import { campaignQueue, createWorker } from '../queue/index.js';
import { normalizeUrl } from '../lib/url.js';

const prisma = new PrismaClient();

interface ApiCredentials {
  baseUrl: string;
  apiKey?: string;
  token?: string;
  accountId?: number;
}

interface MessagePayload {
  to: string;
  text: string;
  type: string;
  mediaUrl?: string;
  mediaCaption?: string;
  mediaFilename?: string;
  contactName?: string;
}

async function loadApiSettings(userId: string): Promise<Record<string, ApiCredentials>> {
  const settings = await prisma.apiSetting.findMany({ where: { userId } });
  const map: Record<string, ApiCredentials> = {};

  for (const s of settings) {
    const parsed = s.settings as any;
    map[s.provider] = {
      baseUrl: normalizeUrl(parsed.baseUrl || ''),
      apiKey: parsed.apiKey,
      token: parsed.token,
      accountId: parsed.accountId ? Number(parsed.accountId) : undefined,
    };
  }

  const wuzapi = await (prisma as any).wuzapiSetting.findUnique({ where: { userId } });
  if (wuzapi) {
    map.wuzapi = { baseUrl: normalizeUrl(wuzapi.baseUrl), token: wuzapi.adminToken };
  }

  return map;
}

async function evoFetch(creds: ApiCredentials, url: string, body?: any) {
  const res = await fetch(url, {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json', apikey: creds.apiKey || '' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`Evolution API ${res.status}: ${await res.text()}`);
  return res.json();
}

async function sendViaEvolution(creds: ApiCredentials, instanceName: string, msg: MessagePayload) {
  const b = { number: msg.to, options: { delay: 1, presence: 'composing' } };
  const base = creds.baseUrl;
  const name = instanceName;

  if (msg.type === 'TEXT' || msg.type === 'text') {
    return evoFetch(creds, `${base}/message/sendText/${name}`, { ...b, text: msg.text });
  }
  if (['IMAGE', 'image', 'AUDIO', 'audio', 'VIDEO', 'video', 'DOCUMENT', 'document'].includes(msg.type)) {
    return evoFetch(creds, `${base}/message/sendMedia/${name}`, { number: msg.to, options: { mediatype: msg.type.toLowerCase(), media: msg.mediaUrl, caption: msg.mediaCaption, fileName: msg.mediaFilename } });
  }
  if (msg.type === 'BUTTONS' || msg.type === 'buttons') {
    return evoFetch(creds, `${base}/message/sendButtons/${name}`, { number: msg.to, options: { title: msg.text, description: msg.mediaCaption, footer: '', buttons: [] } });
  }
  if (msg.type === 'CONTACT' || msg.type === 'contact') {
    return evoFetch(creds, `${base}/message/sendContact/${name}`, { number: msg.to, options: { displayName: msg.contactName || msg.text, vcard: '' } });
  }
  return evoFetch(creds, `${base}/message/sendText/${name}`, { ...b, text: msg.text });
}

async function sendViaEvolutionGo(creds: ApiCredentials, instanceName: string, msg: MessagePayload) {
  const base = creds.baseUrl;
  const name = instanceName;
  const headers = { 'Content-Type': 'application/json', apikey: creds.apiKey || '', Authorization: `Bearer ${creds.apiKey || ''}` };

  async function goFetch(url: string, body?: any) {
    const res = await fetch(url, {
      method: body ? 'POST' : 'GET',
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error(`Evolution Go API ${res.status}: ${await res.text()}`);
    return res.json();
  }

  if (msg.type === 'TEXT' || msg.type === 'text') {
    return goFetch(`${base}/message/sendText/${name}`, { number: msg.to, text: msg.text, delay: 1, presence: 'composing' });
  }
  if (['IMAGE', 'image', 'AUDIO', 'audio', 'VIDEO', 'video', 'DOCUMENT', 'document'].includes(msg.type)) {
    return goFetch(`${base}/message/sendMedia/${name}`, { number: msg.to, mediatype: msg.type.toLowerCase(), media: msg.mediaUrl, caption: msg.mediaCaption, fileName: msg.mediaFilename });
  }
  if (msg.type === 'BUTTONS' || msg.type === 'buttons') {
    return goFetch(`${base}/message/sendButtons/${name}`, { number: msg.to, title: msg.text, description: msg.mediaCaption, footer: '', buttons: [] });
  }
  if (msg.type === 'LIST' || msg.type === 'list') {
    return goFetch(`${base}/message/sendList/${name}`, { number: msg.to, title: msg.text, description: msg.mediaCaption, buttonText: 'Ver opções', sections: [] });
  }
  if (msg.type === 'CONTACT' || msg.type === 'contact') {
    return goFetch(`${base}/message/sendContact/${name}`, { number: msg.to, contact: { displayName: msg.contactName || msg.text, vcard: '' } });
  }
  if (msg.type === 'CAROUSEL' || msg.type === 'carousel') {
    return goFetch(`${base}/send/carousel/${name}`, { number: msg.to, cards: [] });
  }
  return goFetch(`${base}/message/sendText/${name}`, { number: msg.to, text: msg.text, delay: 1, presence: 'composing' });
}

async function sendViaUnoapi(creds: ApiCredentials, instanceName: string, msg: MessagePayload) {
  const url = `${creds.baseUrl}/v15.0/${instanceName}/messages`;
  const basePayload: any = { messaging_product: 'whatsapp', to: msg.to };

  async function waFetch(payload: any) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: creds.token || '' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`UnoAPI ${res.status}: ${await res.text()}`);
    return res.json();
  }

  if (msg.type === 'TEXT' || msg.type === 'text') {
    return waFetch({ ...basePayload, type: 'text', text: { body: msg.text } });
  }
  if (msg.type === 'IMAGE' || msg.type === 'image') {
    return waFetch({ ...basePayload, type: 'image', image: { link: msg.mediaUrl || msg.text, caption: msg.mediaCaption } });
  }
  if (msg.type === 'AUDIO' || msg.type === 'audio') {
    return waFetch({ ...basePayload, type: 'audio', audio: { link: msg.mediaUrl || msg.text } });
  }
  if (msg.type === 'VIDEO' || msg.type === 'video') {
    return waFetch({ ...basePayload, type: 'video', video: { link: msg.mediaUrl || msg.text, caption: msg.mediaCaption } });
  }
  if (msg.type === 'DOCUMENT' || msg.type === 'document') {
    return waFetch({ ...basePayload, type: 'document', document: { link: msg.mediaUrl || msg.text, caption: msg.mediaCaption, filename: msg.mediaFilename || 'document' } });
  }
  return waFetch({ ...basePayload, type: 'text', text: { body: msg.text } });
}

async function sendViaChatwoot(creds: ApiCredentials, instanceName: string, msg: MessagePayload) {
  const accountId = creds.accountId || 1;
  const baseUrl = creds.baseUrl;
  const headers = { 'Content-Type': 'application/json', api_access_token: creds.token || '' };
  const to = msg.to;

  const contactRes = await fetch(`${baseUrl}/api/v1/accounts/${accountId}/contacts?phone=${encodeURIComponent(to)}`, { headers });
  const contactData = await contactRes.json();
  let contactId: number | null = null;
  if (contactData.payload?.length > 0) {
    contactId = contactData.payload[0].id;
  } else {
    const createRes = await fetch(`${baseUrl}/api/v1/accounts/${accountId}/contacts`, {
      method: 'POST', headers,
      body: JSON.stringify({ name: msg.contactName || to, phone_number: to, inbox_id: Number(instanceName) }),
    });
    const createData = await createRes.json();
    contactId = createData.payload?.contact?.id;
  }

  if (!contactId) throw new Error('Chatwoot: could not find or create contact');

  const convRes = await fetch(`${baseUrl}/api/v1/accounts/${accountId}/contacts/${contactId}/conversations`, { headers });
  const convData = await convRes.json();
  let conversationId: number | null = convData.payload?.[0]?.id || null;

  if (!conversationId) {
    const createConvRes = await fetch(`${baseUrl}/api/v1/accounts/${accountId}/conversations`, {
      method: 'POST', headers,
      body: JSON.stringify({ contact_id: contactId, inbox_id: Number(instanceName) }),
    });
    const createConvData = await createConvRes.json();
    conversationId = createConvData.id;
  }

  if (!conversationId) throw new Error('Chatwoot: could not find or create conversation');

  const msgRes = await fetch(`${baseUrl}/api/v1/accounts/${accountId}/conversations/${conversationId}/messages`, {
    method: 'POST', headers,
    body: JSON.stringify({ content: msg.text, message_type: 'outgoing' }),
  });
  if (!msgRes.ok) throw new Error(`Chatwoot API ${msgRes.status}: ${await msgRes.text()}`);
  return msgRes.json();
}

async function sendViaWuzapi(creds: ApiCredentials, instanceName: string, msg: MessagePayload) {
  const instance = await (prisma as any).wuzapiInstance.findFirst({ where: { name: instanceName } });
  const token = instance?.userToken || creds.token || '';
  const baseUrl = creds.baseUrl;

  async function wuzapiCall(endpoint: string, payload: any) {
    const res = await fetch(`${baseUrl}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', token },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`WuzAPI ${res.status}: ${await res.text()}`);
    return res.json();
  }

  if (msg.type === 'TEXT' || msg.type === 'text') {
    return wuzapiCall('/chat/send/text', { Phone: msg.to, Body: msg.text });
  }
  if (msg.type === 'IMAGE' || msg.type === 'image') {
    return wuzapiCall('/chat/send/image', { Phone: msg.to, Image: msg.mediaUrl || msg.text, Caption: msg.mediaCaption || '' });
  }
  if (msg.type === 'AUDIO' || msg.type === 'audio') {
    return wuzapiCall('/chat/send/audio', { Phone: msg.to, Audio: msg.mediaUrl || msg.text, PTT: false });
  }
  if (msg.type === 'VIDEO' || msg.type === 'video') {
    return wuzapiCall('/chat/send/video', { Phone: msg.to, Video: msg.mediaUrl || msg.text, Caption: msg.mediaCaption || '' });
  }
  if (msg.type === 'DOCUMENT' || msg.type === 'document') {
    return wuzapiCall('/chat/send/document', { Phone: msg.to, Document: msg.mediaUrl || msg.text, FileName: msg.mediaFilename || 'document', Caption: msg.mediaCaption || '' });
  }
  if (msg.type === 'BUTTONS' || msg.type === 'buttons') {
    return wuzapiCall('/chat/send/buttons', { Phone: msg.to, Title: msg.text, Body: msg.mediaCaption || '', Buttons: [] });
  }
  if (msg.type === 'LIST' || msg.type === 'list') {
    return wuzapiCall('/chat/send/list', { Phone: msg.to, ButtonText: 'Ver opções', Desc: msg.mediaCaption || '', TopText: msg.text, FooterText: '', Sections: [] });
  }
  if (msg.type === 'CONTACT' || msg.type === 'contact') {
    return wuzapiCall('/chat/send/contact', { Phone: msg.to, Contact: { Name: msg.contactName || msg.text, Vcard: '' } });
  }
  return wuzapiCall('/chat/send/text', { Phone: msg.to, Body: msg.text });
}

const senders: Record<string, Function> = {
  evolution: sendViaEvolution,
  'evolution-go': sendViaEvolutionGo,
  unoapi: sendViaUnoapi,
  chatwoot: sendViaChatwoot,
  wuzapi: sendViaWuzapi,
};

export function startCampaignWorker() {
  const worker = createWorker(async (job) => {
    const { campaignId } = job.data;

    const campaign = await (prisma as any).campaign.findUnique({
      where: { id: campaignId },
      include: {
        messages: {
          where: { status: 'PENDING' },
          orderBy: { createdAt: 'asc' },
          take: 1,
        },
      },
    });

    if (!campaign || campaign.status !== 'RUNNING') return;

    const msg = campaign.messages[0];
    if (!msg) {
      await prisma.campaign.update({
        where: { id: campaignId },
        data: { status: 'COMPLETED', completedAt: new Date() },
      });
      return;
    }

    const apiSettings = await loadApiSettings(campaign.userId);

    const userInstance = await (prisma as any).userInstance.findFirst({
      where: { userId: campaign.userId, status: 'CONNECTED' },
    });

    if (!userInstance) {
      await failMessage(msg, campaignId, 'Nenhuma instância conectada');
      await enqueueNextOrComplete(campaignId);
      return;
    }

    const source = userInstance.source as keyof typeof senders;
    const sender = senders[source];
    if (!sender) {
      await failMessage(msg, campaignId, `API não suportada: ${source}`);
      await enqueueNextOrComplete(campaignId);
      return;
    }

    const creds = apiSettings[source === 'evolution-go' ? 'evolution-go' : source];
    if (!creds || !creds.baseUrl) {
      await failMessage(msg, campaignId, `Credenciais não encontradas para ${source}`);
      await enqueueNextOrComplete(campaignId);
      return;
    }

    const messagePayload: MessagePayload = {
      to: msg.contactPhone,
      text: msg.content,
      type: msg.messageType || 'TEXT',
      mediaUrl: msg.mediaUrl || undefined,
      mediaCaption: msg.mediaCaption || undefined,
      mediaFilename: msg.mediaFilename || undefined,
      contactName: msg.contactName || undefined,
    };

    try {
      let result = await sender(creds, userInstance.instanceName, messagePayload);

      await (prisma as any).campaignMessage.update({
        where: { id: msg.id },
        data: { status: 'SENT', sentAt: new Date(), externalId: String(result?.id || result?.key?.id || '') },
      });

      await (prisma as any).campaign.update({
        where: { id: campaignId },
        data: { sentCount: { increment: 1 } },
      });

      const delay = Number((campaign.config as any)?.delayBetween) || 3000;
      await campaignQueue.add(campaignId, { campaignId }, { delay, jobId: campaignId });
    } catch (err: any) {
      if (msg.attempts < msg.maxRetries) {
        await (prisma as any).campaignMessage.update({
          where: { id: msg.id },
          data: { attempts: { increment: 1 }, error: err.message },
        });
        const retryDelay = 5000 * (msg.attempts + 1);
        await campaignQueue.add(campaignId, { campaignId }, { delay: retryDelay, jobId: campaignId });
      } else {
        await (prisma as any).campaignMessage.update({
          where: { id: msg.id },
          data: { status: 'FAILED', attempts: { increment: 1 }, error: err.message },
        });
        await (prisma as any).campaign.update({
          where: { id: campaignId },
          data: { failedCount: { increment: 1 } },
        });
        await enqueueNextOrComplete(campaignId);
      }
    }
  });

  worker.on('error', (err) => console.error('[CampaignWorker] error:', err));
  return worker;
}

async function failMessage(msg: any, campaignId: string, error: string) {
  await (prisma as any).campaignMessage.update({
    where: { id: msg.id },
    data: { status: 'FAILED', error },
  });
  await (prisma as any).campaign.update({
    where: { id: campaignId },
    data: { failedCount: { increment: 1 } },
  });
}

async function enqueueNextOrComplete(campaignId: string) {
  const pending = await (prisma as any).campaignMessage.count({
    where: { campaignId, status: 'PENDING' },
  });
  if (pending > 0) {
    await campaignQueue.add(campaignId, { campaignId }, { jobId: campaignId });
  } else {
    await (prisma as any).campaign.update({
      where: { id: campaignId },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });
  }
}
