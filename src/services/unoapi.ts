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
  buttons?: Array<{ id: string; title: string }>;
  list?: {
    buttonText: string;
    sections: Array<{
      title: string;
      rows: Array<{ id: string; title: string; description?: string }>;
    }>;
  };
  header?: string;
  footer?: string;
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
async function proxyCall(creds: UnoApiCredentials, endpoint: string, method = 'GET', requestBody?: any): Promise<{ ok: boolean; data: any }> {
  try {
    const { data, error } = await supabase.functions.invoke('unoapi-proxy', {
      body: { 
        baseUrl: creds.baseUrl, 
        token: creds.token, 
        endpoint,
        method,
        body: requestBody,
      },
    });
    if (error) return { ok: false, data: null };
    return { ok: true, data };
  } catch {
    return { ok: false, data: null };
  }
}

// Proxy send message (avoids CORS issues)
async function proxySendMessage(creds: UnoApiCredentials, phoneNumberId: string, payload: any): Promise<any> {
  const endpoint = `/v15.0/${phoneNumberId}/messages`;
  const result = await proxyCall(creds, endpoint, 'POST', payload);
  
  if (!result.ok || !result.data) {
    throw new Error(result.data?.error || 'Erro ao enviar mensagem via proxy');
  }
  
  if (result.data.error) {
    throw new Error(result.data.error);
  }
  
  return result.data;
}

// Auto-detect Evolution API by trying its fetchInstances endpoint
async function detectEvolutionApi(creds: UnoApiCredentials): Promise<boolean> {
  try {
    const { data, error } = await supabase.functions.invoke('evolution-proxy', {
      body: { action: 'fetchInstances', baseUrl: creds.baseUrl, apiKey: creds.token },
    });
    if (error) return false;
    return data && Array.isArray(data.instances);
  } catch {
    return false;
  }
}

// Fetch instances via Evolution API proxy
async function fetchEvolutionInstances(creds: UnoApiCredentials): Promise<{ instances: UnoApiInstance[]; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('evolution-proxy', {
      body: { action: 'fetchInstances', baseUrl: creds.baseUrl, apiKey: creds.token },
    });
    if (error) return { instances: [], error: error.message };
    if (data?.instances && Array.isArray(data.instances)) {
      const instances: UnoApiInstance[] = data.instances.map((inst: any) => ({
        phone: inst.phone || inst.instanceName || '',
        status: (inst.status === 'open' || inst.status === 'connected') ? 'connected' as const : 'disconnected' as const,
        name: inst.profileName || inst.instanceName || undefined,
      }));
      return { instances };
    }
    return { instances: [], error: 'Nenhuma instância encontrada na Evolution API.' };
  } catch (err: any) {
    return { instances: [], error: err.message };
  }
}

// Test connection by sending a ping
export async function testConnection(creds: UnoApiCredentials): Promise<boolean> {
  // Try Evolution API first
  const isEvolution = await detectEvolutionApi(creds);
  if (isEvolution) {
    // Save detection result
    localStorage.setItem('api_type_detected', 'evolution');
    return true;
  }
  localStorage.setItem('api_type_detected', 'unoapi');
  const result = await proxyCall(creds, 'ping');
  if (result.ok && result.data) {
    const text = typeof result.data === 'string' ? result.data : (result.data.text || JSON.stringify(result.data));
    return text.includes('pong');
  }
  return false;
}

// Fetch connected instances/phone numbers
export async function fetchInstances(creds: UnoApiCredentials): Promise<{ instances: UnoApiInstance[]; error?: string }> {
  // Check if this is an Evolution API
  const detectedType = localStorage.getItem('api_type_detected');
  if (detectedType === 'evolution') {
    return fetchEvolutionInstances(creds);
  }

  // Try Evolution API detection as fallback
  const isEvolution = await detectEvolutionApi(creds);
  if (isEvolution) {
    localStorage.setItem('api_type_detected', 'evolution');
    return fetchEvolutionInstances(creds);
  }

  try {
    const result = await proxyCall(creds, 'sessions');
    
    if (result.ok && result.data) {
      const data = result.data;
      console.log('[UnoAPI] /sessions response:', data);

      // Handle error response from proxy
      if (data.error) {
        return { instances: [], error: data.error?.title || data.error };
      }

      // FORMATO 1: UnoAPI retorna { data: [{ display_phone_number, status, ... }] }
      if (data?.data && Array.isArray(data.data)) {
        const instances: UnoApiInstance[] = data.data
          .filter((item: any) => item.display_phone_number || item.phone)
          .map((item: any) => ({
            phone: item.display_phone_number || item.phone,
            status: (item.status === 'online' || item.status === 'connected' || item.status === 'open')
              ? 'connected' as const
              : 'disconnected' as const,
            name: item.pushName || item.name || undefined,
          }));
        if (instances.length > 0) {
          console.log('[UnoAPI] Found instances:', instances);
          return { instances };
        }
      }

      // FORMATO 2: Objeto com phone numbers como chaves
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

      // FORMATO 3: Array direto
      if (Array.isArray(data)) {
        const instances = data.map((item: any) => ({
          phone: item.display_phone_number || item.phone || item.id,
          status: (item.status === 'connected' || item.status === 'open' || item.status === 'online')
            ? 'connected' as const
            : 'disconnected' as const,
          name: item.pushName || item.name || undefined,
        }));
        if (instances.length > 0) return { instances };
      }

      // If still nothing found, return error
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
  const payload = {
    messaging_product: 'whatsapp',
    to,
    type: 'text',
    text: { body },
  };
  
  try {
    return await proxySendMessage(creds, phoneNumberId, payload);
  } catch (err) {
    // Fallback to direct fetch if proxy fails
    console.warn('[unoapi] Proxy failed, trying direct fetch:', err);
    const res = await fetch(buildApiUrl(creds.baseUrl, phoneNumberId), {
      method: 'POST',
      headers: getHeaders(creds.token),
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const errorData = await res.text();
      throw new Error(`Erro ao enviar texto: ${res.status} - ${errorData}`);
    }
    return await res.json();
  }
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
  
  try {
    return await proxySendMessage(creds, phoneNumberId, payload);
  } catch (err) {
    console.warn('[unoapi] Proxy failed for image, trying direct fetch:', err);
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
}

// Send audio message
export async function sendAudioMessage(
  creds: UnoApiCredentials,
  phoneNumberId: string,
  to: string,
  audioUrl: string
): Promise<any> {
  const payload = {
    messaging_product: 'whatsapp',
    to,
    type: 'audio',
    audio: { link: audioUrl },
  };
  
  try {
    return await proxySendMessage(creds, phoneNumberId, payload);
  } catch (err) {
    console.warn('[unoapi] Proxy failed for audio, trying direct fetch:', err);
    const res = await fetch(buildApiUrl(creds.baseUrl, phoneNumberId), {
      method: 'POST',
      headers: getHeaders(creds.token),
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const errorData = await res.text();
      throw new Error(`Erro ao enviar áudio: ${res.status} - ${errorData}`);
    }
    return await res.json();
  }
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
  
  try {
    return await proxySendMessage(creds, phoneNumberId, payload);
  } catch (err) {
    console.warn('[unoapi] Proxy failed for video, trying direct fetch:', err);
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
  
  try {
    return await proxySendMessage(creds, phoneNumberId, payload);
  } catch (err) {
    console.warn('[unoapi] Proxy failed for document, trying direct fetch:', err);
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
}

// Send interactive buttons message
export async function sendInteractiveButtons(
  creds: UnoApiCredentials,
  phoneNumberId: string,
  to: string,
  body: string,
  buttons: Array<{ id: string; title: string }>,
  header?: string,
  footer?: string
): Promise<any> {
  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text: body },
      action: {
        buttons: buttons.map(btn => ({
          type: 'reply',
          reply: { id: btn.id, title: btn.title },
        })),
      },
    },
  };

  if (header) {
    payload.interactive.header = { type: 'text', text: header };
  }
  if (footer) {
    payload.interactive.footer = { text: footer };
  }

  try {
    return await proxySendMessage(creds, phoneNumberId, payload);
  } catch (err) {
    console.warn('[unoapi] Proxy failed for buttons, trying direct fetch:', err);
    const res = await fetch(buildApiUrl(creds.baseUrl, phoneNumberId), {
      method: 'POST',
      headers: getHeaders(creds.token),
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const errorData = await res.text();
      throw new Error(`Erro ao enviar botões: ${res.status} - ${errorData}`);
    }
    return await res.json();
  }
}

// Send interactive list message
export async function sendInteractiveList(
  creds: UnoApiCredentials,
  phoneNumberId: string,
  to: string,
  body: string,
  buttonText: string,
  sections: Array<{
    title: string;
    rows: Array<{ id: string; title: string; description?: string }>;
  }>,
  header?: string,
  footer?: string
): Promise<any> {
  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'interactive',
    interactive: {
      type: 'list',
      body: { text: body },
      action: {
        button: buttonText,
        sections: sections.map(section => ({
          title: section.title,
          rows: section.rows.map(row => ({
            id: row.id,
            title: row.title,
            description: row.description || '',
          })),
        })),
      },
    },
  };

  if (header) {
    payload.interactive.header = { type: 'text', text: header };
  }
  if (footer) {
    payload.interactive.footer = { text: footer };
  }

  try {
    return await proxySendMessage(creds, phoneNumberId, payload);
  } catch (err) {
    console.warn('[unoapi] Proxy failed for list, trying direct fetch:', err);
    const res = await fetch(buildApiUrl(creds.baseUrl, phoneNumberId), {
      method: 'POST',
      headers: getHeaders(creds.token),
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const errorData = await res.text();
      throw new Error(`Erro ao enviar lista: ${res.status} - ${errorData}`);
    }
    return await res.json();
  }
}

// Generic send based on media type
export async function sendUnoApiMessage(
  creds: UnoApiCredentials,
  phoneNumberId: string,
  to: string,
  message: UnoApiMessage
): Promise<any> {
  // Check for interactive buttons
  if (message.buttons && message.buttons.length > 0) {
    return sendInteractiveButtons(
      creds,
      phoneNumberId,
      to,
      message.content,
      message.buttons,
      message.header,
      message.footer
    );
  }

  // Check for interactive list
  if (message.list) {
    return sendInteractiveList(
      creds,
      phoneNumberId,
      to,
      message.content,
      message.list.buttonText,
      message.list.sections,
      message.header,
      message.footer
    );
  }

  // Text only (no media)
  if (!message.media || message.media.type === 'text') {
    return sendTextMessage(creds, phoneNumberId, to, message.content);
  }

  // Media messages
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
