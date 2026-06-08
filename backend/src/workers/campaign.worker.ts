import { PrismaClient } from '@prisma/client';
import { campaignQueue, createWorker } from '../queue/index.js';

const prisma = new PrismaClient();

interface ApiCredentials {
  baseUrl: string;
  apiKey?: string;
  token?: string;
  accountId?: number;
}

async function loadApiSettings(userId: string): Promise<Record<string, ApiCredentials>> {
  const settings = await prisma.apiSetting.findMany({ where: { userId } });
  const map: Record<string, ApiCredentials> = {};

  for (const s of settings) {
    const parsed = s.settings as any;
    map[s.provider] = {
      baseUrl: parsed.baseUrl || '',
      apiKey: parsed.apiKey,
      token: parsed.token,
      accountId: parsed.accountId ? Number(parsed.accountId) : undefined,
    };
  }

  const wuzapi = await (prisma as any).wuzapiSetting.findUnique({ where: { userId } });
  if (wuzapi) {
    map.wuzapi = { baseUrl: wuzapi.baseUrl, token: wuzapi.adminToken };
  }

  return map;
}

async function sendViaEvolution(
  creds: ApiCredentials, instanceName: string, to: string, text: string,
) {
  const url = `${creds.baseUrl}/message/sendText/${instanceName}`;
  const body = { number: to, text, options: { delay: 1, presence: 'composing' } };
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: creds.apiKey || '' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Evolution API ${res.status}: ${await res.text()}`);
  return res.json();
}

async function sendViaEvolutionGo(
  creds: ApiCredentials, instanceName: string, to: string, text: string,
) {
  const url = `${creds.baseUrl}/message/sendText/${instanceName}`;
  const body = { number: to, text, delay: 1, presence: 'composing' };
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: creds.apiKey || '',
      Authorization: `Bearer ${creds.apiKey || ''}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Evolution Go API ${res.status}: ${await res.text()}`);
  return res.json();
}

async function sendViaUnoapi(
  creds: ApiCredentials, instanceName: string, to: string, text: string,
) {
  const url = `${creds.baseUrl}/api/${instanceName}/messages/send`;
  const body = { content: text, to };
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${creds.token || ''}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`UnoAPI ${res.status}: ${await res.text()}`);
  return res.json();
}

async function sendViaChatwoot(
  creds: ApiCredentials, instanceName: string, to: string, text: string, contactName?: string,
) {
  const accountId = creds.accountId || 1;
  const baseUrl = creds.baseUrl;
  const headers = { 'Content-Type': 'application/json', api_access_token: creds.token || '' };

  const contactRes = await fetch(
    `${baseUrl}/api/v1/accounts/${accountId}/contacts?phone=${encodeURIComponent(to)}`,
    { headers },
  );
  const contactData = await contactRes.json();
  let contactId: number | null = null;
  if (contactData.payload?.length > 0) {
    contactId = contactData.payload[0].id;
  } else {
    const createRes = await fetch(`${baseUrl}/api/v1/accounts/${accountId}/contacts`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ name: contactName || to, phone_number: to, inbox_id: Number(instanceName) }),
    });
    const createData = await createRes.json();
    contactId = createData.payload?.contact?.id;
  }

  if (!contactId) throw new Error('Chatwoot: could not find or create contact');

  const convRes = await fetch(`${baseUrl}/api/v1/accounts/${accountId}/contacts/${contactId}/conversations`, {
    headers,
  });
  const convData = await convRes.json();
  let conversationId: number | null = convData.payload?.[0]?.id || null;

  if (!conversationId) {
    const createConvRes = await fetch(`${baseUrl}/api/v1/accounts/${accountId}/conversations`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ contact_id: contactId, inbox_id: Number(instanceName) }),
    });
    const createConvData = await createConvRes.json();
    conversationId = createConvData.id;
  }

  if (!conversationId) throw new Error('Chatwoot: could not find or create conversation');

  const msgRes = await fetch(
    `${baseUrl}/api/v1/accounts/${accountId}/conversations/${conversationId}/messages`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({ content: text, message_type: 'outgoing' }),
    },
  );
  if (!msgRes.ok) throw new Error(`Chatwoot API ${msgRes.status}: ${await msgRes.text()}`);
  return msgRes.json();
}

async function sendViaWuzapi(
  creds: ApiCredentials, instanceName: string, to: string, text: string,
) {
  const instance = await (prisma as any).wuzapiInstance.findFirst({
    where: { name: instanceName },
  });
  const token = instance?.userToken || creds.token || '';
  const url = `${creds.baseUrl}/api/send`;
  const body = { phone: to, message: text, instanceName };
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', token },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`WuzAPI ${res.status}: ${await res.text()}`);
  return res.json();
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

    let contactName = msg.contactName || undefined;

    try {
      let result: any;

      if (source === 'chatwoot') {
        result = await sendViaChatwoot(creds, userInstance.instanceName, msg.contactPhone, msg.content, contactName);
      } else if (source === 'wuzapi') {
        result = await sendViaWuzapi(creds, userInstance.instanceName, msg.contactPhone, msg.content);
      } else if (source === 'evolution-go') {
        result = await sendViaEvolutionGo(creds, userInstance.instanceName, msg.contactPhone, msg.content);
      } else if (source === 'evolution') {
        result = await sendViaEvolution(creds, userInstance.instanceName, msg.contactPhone, msg.content);
      } else {
        result = await sendViaUnoapi(creds, userInstance.instanceName, msg.contactPhone, msg.content);
      }

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
