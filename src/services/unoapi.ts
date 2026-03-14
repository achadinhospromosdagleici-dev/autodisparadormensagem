// UnoAPI Service
// Sends WhatsApp messages (text, image, audio, document, video) via UnoAPI Cloud API
// API follows WhatsApp Cloud API format: https://github.com/clairton/unoapi-cloud
import { supabase } from '@/integrations/supabase/client';
export interface UnoApiCredentials {
  baseUrl: string;       // e.g. https://your-unoapi.com
  token: string;         // Authorization token
}

export type MediaType = 'text' | 'image' | 'audio' | 'video' | 'document';

export interface MediaAttachment {
  type: MediaType;
  url?: string;
  caption?: string;
  filename?: string;
  mimeType?: string;
}

export interface UnoApiMessage {
  content: string;
  media?: MediaAttachment;
}

export interface UnoApiInstance {
  phone: string;
  status: 'connected' | 'disconnected' | 'unknown';
  name?: string;
}

const STORAGE_KEY = 'unoapi_credentials';

export function saveUnoApiCredentials(credentials: UnoApiCredentials): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(credentials));
}

export function loadUnoApiCredentials(): UnoApiCredentials | null {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return null;
  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

export function clearUnoApiCredentials(): void {
  localStorage.removeItem(STORAGE_KEY);
}

function getHeaders(token: string) {
  return {
    'Content-Type': 'application/json',
    Authorization: token,
  };
}

function buildApiUrl(baseUrl: string, phoneNumberId: string): string {
  return `${baseUrl}/v15.0/${phoneNumberId}/messages`;
}

// Proxy call via edge function (avoids CORS)
async function proxyCall(creds: UnoApiCredentials, endpoint: string): Promise<{ ok: boolean; data: any }> {
  try {
    const { data, error } = await supabase.functions.invoke('unoapi-proxy', {
      body: { baseUrl: creds.baseUrl, token: creds.token, endpoint },
    });
    if (error) return { ok: false, data: null };
    return { ok: true, data };
  } catch {
    return { ok: false, data: null };
  }
}

// Test connection by sending a ping
export async function testConnection(creds: UnoApiCredentials): Promise<boolean> {
  const result = await proxyCall(creds, 'ping');
  if (result.ok && result.data) {
    const text = typeof result.data === 'string' ? result.data : (result.data.text || JSON.stringify(result.data));
    return text.includes('pong');
  }
  return false;
}

// Fetch connected instances/phone numbers
export async function fetchInstances(creds: UnoApiCredentials): Promise<{ instances: UnoApiInstance[]; error?: string }> {
  try {
    const result = await proxyCall(creds, 'sessions');
    
    if (result.ok && result.data) {
      const data = result.data;
      console.log('[UnoAPI] /sessions response:', data);

      // Handle error response from proxy
      if (data.error) {
        return { instances: [], error: data.error };
      }
      
      // /sessions returns an object with phone numbers as keys
      if (data && typeof data === 'object' && !Array.isArray(data) && !data.text) {
        const instances = Object.entries(data)
          .filter(([key]) => key !== 'error' && key !== 'text')
          .map(([phone, config]: [string, any]) => ({
            phone,
            status: (config?.status === 'connected' || config?.status === 'open' || config?.status === 'online' || config?.authToken) 
              ? 'connected' as const 
              : 'disconnected' as const,
            name: config?.pushName || config?.name || undefined,
          }));
        if (instances.length > 0) return { instances };
      }

      // If it returns an array
      if (Array.isArray(data)) {
        const instances = data.map((item: any) => {
          const phone = typeof item === 'string' ? item : (item.phone || item.id || item.phoneNumber || item.number || String(item));
          return {
            phone,
            status: (item?.status === 'connected' || item?.status === 'open' || item?.status === 'online' || item?.authToken)
              ? 'connected' as const
              : typeof item === 'string' ? 'connected' as const : 'disconnected' as const,
            name: item?.pushName || item?.name || undefined,
          };
        });
        return { instances };
      }
    }

    return { instances: [], error: 'Nenhum número encontrado na API. Verifique se a URL e token estão corretos.' };
  } catch (err: any) {
    console.error('[UnoAPI] Erro ao buscar instâncias:', err);
    return { 
      instances: [], 
      error: `Erro: ${err.message}` 
    };
  }
}

// Manual instances storage
const MANUAL_INSTANCES_KEY = 'unoapi_manual_instances';

export function saveManualInstances(instances: UnoApiInstance[]): void {
  localStorage.setItem(MANUAL_INSTANCES_KEY, JSON.stringify(instances));
}

export function loadManualInstances(): UnoApiInstance[] {
  const stored = localStorage.getItem(MANUAL_INSTANCES_KEY);
  if (!stored) return [];
  try { return JSON.parse(stored); } catch { return []; }
}

export function clearManualInstances(): void {
  localStorage.removeItem(MANUAL_INSTANCES_KEY);
}

// Send text message
export async function sendTextMessage(
  creds: UnoApiCredentials,
  phoneNumberId: string,
  to: string,
  body: string
): Promise<any> {
  const res = await fetch(buildApiUrl(creds.baseUrl, phoneNumberId), {
    method: 'POST',
    headers: getHeaders(creds.token),
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body },
    }),
  });
  if (!res.ok) {
    const errorData = await res.text();
    throw new Error(`Erro ao enviar texto: ${res.status} - ${errorData}`);
  }
  return await res.json();
}

// Send image message
export async function sendImageMessage(
  creds: UnoApiCredentials,
  phoneNumberId: string,
  to: string,
  imageUrl: string,
  caption?: string
): Promise<any> {
  const payload: any = {
    messaging_product: 'whatsapp',
    to,
    type: 'image',
    image: { link: imageUrl },
  };
  if (caption) payload.image.caption = caption;

  const res = await fetch(buildApiUrl(creds.baseUrl, phoneNumberId), {
    method: 'POST',
    headers: getHeaders(creds.token),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errorData = await res.text();
    throw new Error(`Erro ao enviar imagem: ${res.status} - ${errorData}`);
  }
  return await res.json();
}

// Send audio message
export async function sendAudioMessage(
  creds: UnoApiCredentials,
  phoneNumberId: string,
  to: string,
  audioUrl: string
): Promise<any> {
  const res = await fetch(buildApiUrl(creds.baseUrl, phoneNumberId), {
    method: 'POST',
    headers: getHeaders(creds.token),
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'audio',
      audio: { link: audioUrl },
    }),
  });
  if (!res.ok) {
    const errorData = await res.text();
    throw new Error(`Erro ao enviar áudio: ${res.status} - ${errorData}`);
  }
  return await res.json();
}

// Send video message
export async function sendVideoMessage(
  creds: UnoApiCredentials,
  phoneNumberId: string,
  to: string,
  videoUrl: string,
  caption?: string
): Promise<any> {
  const payload: any = {
    messaging_product: 'whatsapp',
    to,
    type: 'video',
    video: { link: videoUrl },
  };
  if (caption) payload.video.caption = caption;

  const res = await fetch(buildApiUrl(creds.baseUrl, phoneNumberId), {
    method: 'POST',
    headers: getHeaders(creds.token),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errorData = await res.text();
    throw new Error(`Erro ao enviar vídeo: ${res.status} - ${errorData}`);
  }
  return await res.json();
}

// Send document message
export async function sendDocumentMessage(
  creds: UnoApiCredentials,
  phoneNumberId: string,
  to: string,
  documentUrl: string,
  filename?: string,
  caption?: string
): Promise<any> {
  const payload: any = {
    messaging_product: 'whatsapp',
    to,
    type: 'document',
    document: { link: documentUrl },
  };
  if (filename) payload.document.filename = filename;
  if (caption) payload.document.caption = caption;

  const res = await fetch(buildApiUrl(creds.baseUrl, phoneNumberId), {
    method: 'POST',
    headers: getHeaders(creds.token),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errorData = await res.text();
    throw new Error(`Erro ao enviar documento: ${res.status} - ${errorData}`);
  }
  return await res.json();
}

// Generic send based on media type
export async function sendUnoApiMessage(
  creds: UnoApiCredentials,
  phoneNumberId: string,
  to: string,
  message: UnoApiMessage
): Promise<any> {
  if (!message.media || message.media.type === 'text') {
    return sendTextMessage(creds, phoneNumberId, to, message.content);
  }

  const { type, url, caption, filename } = message.media;
  if (!url) {
    return sendTextMessage(creds, phoneNumberId, to, message.content);
  }

  switch (type) {
    case 'image':
      return sendImageMessage(creds, phoneNumberId, to, url, caption || message.content);
    case 'audio':
      return sendAudioMessage(creds, phoneNumberId, to, url);
    case 'video':
      return sendVideoMessage(creds, phoneNumberId, to, url, caption || message.content);
    case 'document':
      return sendDocumentMessage(creds, phoneNumberId, to, url, filename, caption || message.content);
    default:
      return sendTextMessage(creds, phoneNumberId, to, message.content);
  }
}
