// UnoAPI Service
// Sends WhatsApp messages (text, image, audio, document, video) via UnoAPI Cloud API
// API follows WhatsApp Cloud API format: https://github.com/clairton/unoapi-cloud
import { supabase } from '@/integrations/supabase/client';
export interface UnoApiCredentials {
  baseUrl: string;       // e.g. https://your-unoapi.com
  token: string;         // Authorization token
  s3Endpoint?: string;   // S3 endpoint (optional)
  s3AccessKey?: string;  // S3 access key (optional)
  s3SecretKey?: string; // S3 secret key (optional)
  s3Bucket?: string;     // S3 bucket name (optional)
}

// Default S3 configuration values (can be overridden in panel settings)
export const DEFAULT_S3_CONFIG = {
  endpoint: 'https://s3minio.bigcreditos.com.br',
  accessKey: 'ztyD3jX470hl2UsCvXMb',
  secretKey: 'eA7uptli3Q4EqIOlkce0Rku532hvyVbSbndaZ6Uh',
  bucket: 'chatwoot',
  region: 'ENAM',
};

export interface S3Config {
  endpoint: string;
  accessKey: string;
  secretKey: string;
  bucket: string;
  region?: string;
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
  buttons?: Array<{ id: string; title: string; url?: string; phone?: string }>;
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

// Upload file to S3 via edge function
export async function uploadToS3(file: File, s3Config: S3Config): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('endpoint', s3Config.endpoint);
  formData.append('accessKey', s3Config.accessKey);
  formData.append('secretKey', s3Config.secretKey);
  formData.append('bucket', s3Config.bucket);
  if (s3Config.region) {
    formData.append('region', s3Config.region);
  }

  const { data, error } = await supabase.functions.invoke('s3-upload', {
    body: formData,
  });

  if (error) {
    throw new Error(`Upload failed: ${error.message}`);
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  return data.url;
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
  localStorage.setItem('api_type_detected', 'unoapi'); // Force UnoAPI mode
  const result = await proxyCall(creds, 'ping');
  if (result.ok && result.data) {
    const text = typeof result.data === 'string' ? result.data : (result.data.text || JSON.stringify(result.data));
    return text.includes('pong');
  }
  return false;
}

// Force set API type (for testing)
export function forceSetApiType(type: 'unoapi' | 'evolution'): void {
  localStorage.setItem('api_type_detected', type);
}

// Fetch connected instances/phone numbers
export async function fetchInstances(creds: UnoApiCredentials): Promise<{ instances: UnoApiInstance[]; error?: string }> {
  console.log('[UnoAPI] Fetching instances from:', creds.baseUrl);

  try {
    // Use ONLY /sessions endpoint
    const result = await proxyCall(creds, 'sessions');
    
    if (result.ok && result.data) {
      const data = result.data;
      console.log('[UnoAPI] /sessions response:', JSON.stringify(data).substring(0, 1000));

      // Handle error response from proxy
      if (data?.error) {
        return { instances: [], error: data.error?.title || data.error };
      }

      // FORMATO EXATO da UnoAPI: { "data": [{ "display_phone_number": "5531...", "status": "online" }] }
      if (data?.data && Array.isArray(data.data)) {
        const instances: UnoApiInstance[] = data.data
          .filter((item: any) => item.display_phone_number && typeof item.display_phone_number === 'string')
          .map((item: any) => ({
            phone: item.display_phone_number,
            status: (item.status === 'online' || item.status === 'connected' || item.status === 'open')
              ? 'connected' as const
              : 'disconnected' as const,
            name: item.pushName || item.profileName || item.name || undefined,
          }));
        
        console.log('[UnoAPI] Found instances:', instances);
        
        // Only return if we found valid instances, don't fallback to manual
        if (instances.length > 0) {
          return { instances };
        }
      }

      return { instances: [], error: 'Nenhum número encontrado. Verifique se há instâncias conectadas na UnoAPI.' };
    }
    
    return { instances: [], error: 'Erro ao conectar com UnoAPI. Verifique URL e token.' };
  } catch (err: any) {
    console.error('[UnoAPI] Erro ao buscar instâncias:', err);
    return { instances: [], error: `Erro: ${err.message}` };
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
  
  console.log('[unoapi] sendTextMessage:', {
    baseUrl: creds.baseUrl,
    phoneNumberId,
    to,
    body: body.substring(0, 50)
  });
  
  try {
    const result = await proxySendMessage(creds, phoneNumberId, payload);
    console.log('[unoapi] sendTextMessage result:', result);
    return result;
  } catch (err) {
    console.error('[unoapi] sendTextMessage error:', err);
    throw err;
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
  buttons: Array<{ id: string; title: string; url?: string; phone?: string }>,
  header?: string,
  footer?: string,
  mediaHeader?: { type: 'image' | 'video' | 'document'; url: string; filename?: string }
): Promise<any> {
  // Check button types
  const hasUrlButton = buttons.some(b => b.url);
  const hasPhoneButton = buttons.some(b => b.phone);

  const payload: any = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text: body },
      action: {
        buttons: buttons.map(btn => {
          if (btn.url) {
            // URL button format for WhatsApp Cloud API
            // signature is optional for tracking clicks per user
            return {
              type: 'URL',
              url: {
                url: btn.url,
                signature: to, // Add recipient as signature for tracking
              },
              title: btn.title,
            };
          } else if (btn.phone) {
            // Phone number button - opens contact to call
            return {
              type: 'PHONE_NUMBER',
              phone_number: btn.phone,
              title: btn.title,
            };
          } else {
            return {
              type: 'reply',
              reply: { id: btn.id, title: btn.title },
            };
          }
        }),
      },
    },
  };

if (mediaHeader) {
    // Header com mídia (imagem/vídeo/documento) — formato WhatsApp Cloud API
    if (mediaHeader.type === 'image') {
      payload.interactive.header = { type: 'image', image: { link: mediaHeader.url } };
    } else if (mediaHeader.type === 'video') {
      payload.interactive.header = { type: 'video', video: { link: mediaHeader.url } };
    } else if (mediaHeader.type === 'document') {
      payload.interactive.header = {
        type: 'document',
        document: { link: mediaHeader.url, filename: mediaHeader.filename || undefined },
      };
    }
  } else if (header) {
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
  const payload: any = {
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
