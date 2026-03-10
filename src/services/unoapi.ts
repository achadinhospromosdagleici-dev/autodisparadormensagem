// UnoAPI Service
// Sends WhatsApp messages (text, image, audio, document, video) via UnoAPI Cloud API
// API follows WhatsApp Cloud API format: https://github.com/clairton/unoapi-cloud

export interface UnoApiCredentials {
  baseUrl: string;       // e.g. https://your-unoapi.com
  token: string;         // Authorization token
  phoneNumberId: string; // Your WhatsApp phone number (sender)
}

export type MediaType = 'text' | 'image' | 'audio' | 'video' | 'document';

export interface MediaAttachment {
  type: MediaType;
  url?: string;           // link for media
  caption?: string;       // caption for image/video/document
  filename?: string;      // filename for document
  mimeType?: string;
}

export interface UnoApiMessage {
  content: string;
  media?: MediaAttachment;
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

function buildApiUrl(creds: UnoApiCredentials): string {
  return `${creds.baseUrl}/v15.0/${creds.phoneNumberId}/messages`;
}

// Test connection by sending a ping
export async function testConnection(creds: UnoApiCredentials): Promise<boolean> {
  try {
    const res = await fetch(`${creds.baseUrl}/ping`, {
      headers: getHeaders(creds.token),
    });
    if (res.ok) {
      const text = await res.text();
      return text.includes('pong');
    }
    return false;
  } catch {
    return false;
  }
}

// Send text message
export async function sendTextMessage(
  creds: UnoApiCredentials,
  to: string,
  body: string
): Promise<any> {
  const res = await fetch(buildApiUrl(creds), {
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

  const res = await fetch(buildApiUrl(creds), {
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
  to: string,
  audioUrl: string
): Promise<any> {
  const res = await fetch(buildApiUrl(creds), {
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

  const res = await fetch(buildApiUrl(creds), {
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

  const res = await fetch(buildApiUrl(creds), {
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
  to: string,
  message: UnoApiMessage
): Promise<any> {
  if (!message.media || message.media.type === 'text') {
    return sendTextMessage(creds, to, message.content);
  }

  const { type, url, caption, filename } = message.media;
  if (!url) {
    // If no media URL, fall back to text
    return sendTextMessage(creds, to, message.content);
  }

  switch (type) {
    case 'image':
      return sendImageMessage(creds, to, url, caption || message.content);
    case 'audio':
      return sendAudioMessage(creds, to, url);
    case 'video':
      return sendVideoMessage(creds, to, url, caption || message.content);
    case 'document':
      return sendDocumentMessage(creds, to, url, filename, caption || message.content);
    default:
      return sendTextMessage(creds, to, message.content);
  }
}

// Verify if a contact has WhatsApp
export async function verifyContact(
  creds: UnoApiCredentials,
  phoneNumber: string
): Promise<{ valid: boolean; waId?: string }> {
  try {
    const res = await fetch(`${creds.baseUrl}/${creds.phoneNumberId}/contacts`, {
      method: 'POST',
      headers: getHeaders(creds.token),
      body: JSON.stringify({
        blocking: 'wait',
        contacts: [phoneNumber],
        force_check: true,
      }),
    });
    if (!res.ok) return { valid: false };
    const data = await res.json();
    const contact = data.contacts?.[0];
    return {
      valid: contact?.status === 'valid',
      waId: contact?.wa_id,
    };
  } catch {
    return { valid: false };
  }
}
