import { api } from '@/lib/api';
import { getCurrentUserId } from '@/lib/jwt';
import { normalizeUrl } from '@/lib/utils';

export interface WuzapiCredentials {
  baseUrl: string;
  adminToken: string;
  id?: string;
}

export interface WuzapiInstance {
  id: string;
  name: string;
  phone: string | null;
  status: 'connected' | 'disconnected' | 'connecting';
  user_token: string;
}

export interface WuzapiUser {
  ID: number;
  Name: string;
  Token: string;
  Webhook: string;
  Events: string[];
}

export interface MessageResult {
  success: boolean;
  id?: string;
  error?: string;
}

export interface WuzapiButton {
  DisplayText: string;
  Type: 'quickreply' | 'url' | 'call';
  Url?: string;
  PhoneNumber?: string;
}

export type WuzapiStatus = 'connected' | 'disconnected' | 'connecting';
export type WuzapiInstanceDb = WuzapiInstance;

const STORAGE_KEY = 'wuzapi_credentials';

/**
 * Saves global WuzAPI settings to localStorage and Supabase.
 */
export async function saveWuzapiSettings(creds: WuzapiCredentials): Promise<{ success: boolean; error?: string }> {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(creds));
  const userId = getCurrentUserId();
  if (!userId) return { success: false, error: 'Usuário não autenticado' };

  try {
    await api.post('/settings/wuzapi', {
      baseUrl: normalizeUrl(creds.baseUrl),
      adminToken: creds.adminToken,
    });
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Loads global WuzAPI settings from localStorage or fallback to Supabase.
 */
export async function loadWuzapiSettings(): Promise<WuzapiCredentials | null> {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      // ignore and fetch from DB
    }
  }
  
  try {
    const userId = getCurrentUserId();
    if (!userId) return null;
    
    const response = await api.get('/settings/wuzapi');
    if (!response.data) return null;
    
    const data = response.data;
    const creds: WuzapiCredentials = {
      id: data.id,
      baseUrl: data.baseUrl || data.base_url,
      adminToken: data.adminToken || data.admin_token,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(creds));
    return creds;
  } catch (err) {
    console.error('Error loading wuzapi settings:', err);
    return null;
  }
}

/**
 * Loads all WuzAPI instances for the current user.
 * Also migrates legacy instances from user_instances table (source='wuzapi').
 */
export async function loadWuzapiInstances(): Promise<WuzapiInstance[]> {
  const userId = getCurrentUserId();
  if (!userId) return [];
  
  try {
    const response = await api.get('/wuzapi/instances');
    return (response.data || []) as WuzapiInstance[];
  } catch {
    return [];
  }
}

/**
 * Clears WuzAPI settings.
 */
export async function clearWuzapiSettings(): Promise<void> {
  localStorage.removeItem(STORAGE_KEY);
  const userId = getCurrentUserId();
  if (!userId) return;
  
  await api.delete('/settings/wuzapi');
}

/**
 * Saves/updates a WuzAPI instance.
 */
export async function saveWuzapiInstance(
  settingsId: string,
  userToken: string,
  name: string,
  phone?: string,
  status: 'connected' | 'disconnected' | 'connecting' = 'disconnected'
): Promise<WuzapiInstance | null> {
  const userId = getCurrentUserId();
  if (!userId) return null;
  
  try {
    const response = await api.post('/wuzapi/instances', {
      settingsId,
      userToken,
      name,
      phone,
      status
    });
    return response.data as WuzapiInstance;
  } catch {
    return null;
  }
}

/**
 * Updates a WuzAPI instance.
 */
export async function updateWuzapiInstance(
  id: string,
  updates: Partial<WuzapiInstance>
): Promise<void> {
  await api.put(`/wuzapi/instances/${id}`, updates);
}

/**
 * Deletes a WuzAPI instance.
 */
export async function deleteWuzapiInstance(id: string): Promise<void> {
  await api.delete(`/wuzapi/instances/${id}`);
}

/**
 * Gets a single WuzAPI instance by ID.
 */
export async function getWuzapiInstanceById(id: string): Promise<WuzapiInstance | null> {
  try {
    const response = await api.get(`/wuzapi/instances/${id}`);
    return response.data as WuzapiInstance | null;
  } catch {
    return null;
  }
}

/**
 * Saves/updates WuzAPI instances to wuzapi_instances and user_instances tables.
 */
export async function saveWuzapiInstanceDb(
  userToken: string,
  phone: string | null,
  name: string,
  status: 'connected' | 'disconnected' | 'connecting' = 'disconnected'
): Promise<void> {
  const userId = getCurrentUserId();
  if (!userId) return;

  try {
    await api.post('/wuzapi/instances/full', {
      userToken,
      phone,
      name,
      status
    });
  } catch (err: any) {
    throw new Error(err.response?.data?.message || err.message || 'Erro ao salvar instância WuzAPI');
  }
}

/**
 * Deletes WuzAPI instance from both tables.
 */
export async function deleteWuzapiInstanceDb(name: string, userToken: string): Promise<void> {
  const userId = getCurrentUserId();
  if (!userId) return;

  await api.delete('/wuzapi/instances/by-token', { data: { userToken } });
}

/**
 * Helper to call WuzAPI via Supabase Edge Function (avoids CORS).
 * Admin endpoints use Authorization header, user endpoints use token header.
 */
async function apiCall(
  baseUrl: string,
  endpoint: string,
  token: string,
  method = 'GET',
  body?: any,
  isAdmin = false,
): Promise<any> {
  if (!baseUrl) throw new Error('WuzAPI base URL não configurada');

  console.log('[WuzAPI] apiCall:', method, `${baseUrl}${endpoint}`, { isAdmin });

  const response = await api.post('/proxy/wuzapi', { baseUrl, token, endpoint, method, body, isAdmin });
  const data = response.data;

  if (data?.error) {
    throw new Error(data.details?.error || data.error);
  }

  return data;
}

// ============================================================================
// ADMIN ENDPOINTS
// ============================================================================

export async function testConnection(baseUrl: string, adminToken: string): Promise<{ success: boolean; users?: WuzapiUser[] }> {
  try {
    const users = await listUsers(baseUrl, adminToken);
    return { success: true, users };
  } catch (err) {
    console.error('[WuzAPI] Admin connection test failed:', err);
    return { success: false };
  }
}

export async function listUsers(baseUrl: string, adminToken: string): Promise<WuzapiUser[]> {
  const data = await apiCall(baseUrl, '/admin/users', adminToken, 'GET', undefined, true);
  return Array.isArray(data) ? data : (data?.users || []);
}

export async function createUser(
  baseUrl: string,
  adminToken: string,
  name: string
): Promise<{ id: number; token: string }> {
  const token = crypto.randomUUID().replace(/-/g, '');
  await apiCall(baseUrl, '/admin/users', adminToken, 'POST', {
    name,
    token,
    webhook: '',
    events: 'All',
    expiration: 0,
  }, true);
  return { id: 0, token };
}

export async function deleteUser(baseUrl: string, adminToken: string, userId: number): Promise<void> {
  await apiCall(baseUrl, `/admin/users/${userId}`, adminToken, 'DELETE', undefined, true);
}

// ============================================================================
// SESSION ENDPOINTS
// ============================================================================

export async function connect(baseUrl: string, userToken: string): Promise<{ success: boolean; jid?: string }> {
  return apiCall(baseUrl, '/session/connect', userToken, 'POST', {
    Subscribe: ['Message'],
    Immediate: true,
  });
}

export async function getStatus(
  baseUrl: string,
  userToken: string
): Promise<{ connected: boolean; loggedIn: boolean; jid?: string }> {
  try {
    const raw = await apiCall(baseUrl, '/session/status', userToken, 'GET');
    // WuzAPI sometimes wraps in { code, data, ... }, sometimes returns directly
    const status = raw?.data || raw;
    return {
      connected: !!(status.Connected || status.connected),
      loggedIn: !!(status.LoggedIn || status.loggedIn),
      jid: status.jid || status.Jid || undefined,
    };
  } catch (err) {
    console.error('[WuzAPI] getStatus error:', err);
    return { connected: false, loggedIn: false };
  }
}

export async function getQRCode(baseUrl: string, userToken: string): Promise<string> {
  const res = await apiCall(baseUrl, '/session/qr', userToken, 'GET');
  // Tenta campos do WuzAPI e fallback para outros formatos
  return res?.data?.QRCode || res?.QRCode || res?.qr || res?.qrcode || res?.QR || '';
}

export async function disconnect(baseUrl: string, userToken: string): Promise<void> {
  await apiCall(baseUrl, '/session/disconnect', userToken, 'POST');
}

export async function logout(baseUrl: string, userToken: string): Promise<void> {
  await apiCall(baseUrl, '/session/logout', userToken, 'POST');
}

// ============================================================================
// MESSAGE ENDPOINTS
// ============================================================================

export async function sendText(
  baseUrl: string,
  userToken: string,
  to: string,
  body: string
): Promise<MessageResult> {
  const payload = {
    Phone: to,
    Body: body
  };
  const res = await apiCall(baseUrl, '/chat/send/text', userToken, 'POST', payload);
  return { success: true, id: res.id || res.messageId };
}

export async function sendImage(
  baseUrl: string,
  userToken: string,
  to: string,
  imageData: string,
  caption?: string
): Promise<MessageResult> {
  const payload = {
    Phone: to,
    Image: imageData,
    Caption: caption || ''
  };
  const res = await apiCall(baseUrl, '/chat/send/image', userToken, 'POST', payload);
  return { success: true, id: res.id || res.messageId };
}

export async function sendAudio(
  baseUrl: string,
  userToken: string,
  to: string,
  audioData: string
): Promise<MessageResult> {
  const payload = {
    Phone: to,
    Audio: audioData.replace(/^data:[^,]+,/i, 'data:audio/ogg;base64,'),
    PTT: true,
    MimeType: 'audio/ogg; codecs=opus',
  };
  const res = await apiCall(baseUrl, '/chat/send/audio', userToken, 'POST', payload);
  return { success: true, id: res.id || res.messageId };
}

export async function sendVideo(
  baseUrl: string,
  userToken: string,
  to: string,
  videoData: string,
  caption?: string
): Promise<MessageResult> {
  const payload = {
    Phone: to,
    Video: videoData,
    Caption: caption || ''
  };
  const res = await apiCall(baseUrl, '/chat/send/video', userToken, 'POST', payload);
  return { success: true, id: res.id || res.messageId };
}

export async function sendDocument(
  baseUrl: string,
  userToken: string,
  to: string,
  docData: string,
  filename: string,
  caption?: string
): Promise<MessageResult> {
  const payload = {
    Phone: to,
    Document: docData,
    FileName: filename,
    Caption: caption || ''
  };
  const res = await apiCall(baseUrl, '/chat/send/document', userToken, 'POST', payload);
  return { success: true, id: res.id || res.messageId };
}

export interface WuzapiButton {
  DisplayText: string;
  Type: 'quickreply' | 'url' | 'call';
  Url?: string;
  PhoneNumber?: string;
}

export async function sendTemplate(
  baseUrl: string,
  userToken: string,
  to: string,
  content: string,
  buttons: WuzapiButton[],
  header?: string,
  footer?: string
): Promise<MessageResult> {
  const payload = {
    Phone: to,
    Template: {
      Content: content,
      Header: header || '',
      Footer: footer || '',
      Buttons: buttons
    }
  };
  const res = await apiCall(baseUrl, '/chat/send/template', userToken, 'POST', payload);
  return { success: true, id: res.id || res.messageId };
}

export async function sendContact(
  baseUrl: string,
  userToken: string,
  to: string,
  name: string,
  vcard: string
): Promise<MessageResult> {
  const payload = {
    Phone: to,
    Contact: {
      Name: name,
      Vcard: vcard
    }
  };
  const res = await apiCall(baseUrl, '/chat/send/contact', userToken, 'POST', payload);
  return { success: true, id: res.id || res.messageId };
}

export async function sendSticker(
  baseUrl: string,
  userToken: string,
  to: string,
  stickerData: string,
  packName?: string,
  packPublisher?: string,
  emojis?: string[],
): Promise<MessageResult> {
  const payload: Record<string, unknown> = {
    Phone: to,
    Sticker: stickerData,
  };
  if (packName) payload.PackName = packName;
  if (packPublisher) payload.PackPublisher = packPublisher;
  if (emojis) payload.Emojis = emojis;
  const res = await apiCall(baseUrl, '/chat/send/sticker', userToken, 'POST', payload);
  return { success: true, id: res.id || res.messageId };
}

export async function sendPresence(
  baseUrl: string,
  userToken: string,
  to: string,
  state: 'composing' | 'paused' = 'composing',
): Promise<void> {
  try {
    await apiCall(baseUrl, '/chat/presence', userToken, 'POST', { Phone: to, State: state });
  } catch {
    // non-critical
  }
}

export async function sendLocation(
  baseUrl: string,
  userToken: string,
  to: string,
  latitude: number,
  longitude: number,
  name?: string,
): Promise<MessageResult> {
  const payload: Record<string, unknown> = {
    Phone: to,
    Latitude: latitude,
    Longitude: longitude,
  };
  if (name) payload.Name = name;
  const res = await apiCall(baseUrl, '/chat/send/location', userToken, 'POST', payload);
  return { success: true, id: res.id || res.messageId };
}

export async function sendPoll(
  baseUrl: string,
  userToken: string,
  to: string,
  header: string,
  options: string[],
): Promise<MessageResult> {
  const payload = {
    Group: to,
    Header: header,
    Options: options,
  };
  const res = await apiCall(baseUrl, '/chat/send/poll', userToken, 'POST', payload);
  return { success: true, id: res.id || res.messageId };
}

// ============================================================================
// BUTTONS & LIST ENDPOINTS
// ============================================================================

export async function sendButtons(
  baseUrl: string,
  userToken: string,
  to: string,
  body: string,
  buttons: { DisplayText: string; Type?: 'reply' | 'url' | 'call' | 'copy'; Url?: string; PhoneNumber?: string; CopyCode?: string }[],
  imageDataUrl?: string,
  title?: string,
  footer?: string,
): Promise<MessageResult> {
  const typeMap = { reply: 'reply', url: 'cta_url', call: 'cta_call', copy: 'cta_copy' } as const;
  const payload: Record<string, unknown> = {
    Phone: to,
    Body: body,
    ...(title ? { Title: title } : {}),
    ...(footer ? { Footer: footer } : {}),
    ...(imageDataUrl ? { Image: imageDataUrl } : {}),
    Buttons: buttons.map((b) => ({
      title: b.DisplayText,
      id: b.DisplayText,
      type: typeMap[b.Type ?? 'reply'],
      ...(b.Url ? { url: b.Url } : {}),
      ...(b.PhoneNumber ? { phone_number: b.PhoneNumber } : {}),
      ...(b.CopyCode ? { copy_code: b.CopyCode } : {}),
    })),
  };
  const res = await apiCall(baseUrl, '/chat/send/buttons', userToken, 'POST', payload);
  return { success: true, id: res.id || res.messageId };
}

export async function sendList(
  baseUrl: string,
  userToken: string,
  to: string,
  payload: {
    topText: string;
    desc: string;
    buttonText: string;
    footerText?: string;
    sections: { title: string; rows: { title: string; description?: string; rowId?: string }[] }[];
  },
): Promise<MessageResult> {
  const res = await apiCall(baseUrl, '/chat/send/list', userToken, 'POST', {
    Phone: to,
    ButtonText: payload.buttonText,
    Desc: payload.desc,
    TopText: payload.topText,
    FooterText: payload.footerText ?? '',
    Sections: payload.sections.map((s) => ({
      Title: s.title,
      Rows: s.rows.map((r) => ({
        Title: r.title,
        Description: r.description ?? '',
        RowId: r.rowId ?? r.title,
      })),
    })),
  });
  return { success: true, id: res.id || res.messageId };
}

// ============================================================================
// AVATAR & NUMBER CHECK ENDPOINTS
// ============================================================================

export async function getAvatar(
  baseUrl: string,
  userToken: string,
  jid: string,
): Promise<string> {
  try {
    const res = await apiCall(baseUrl, '/user/avatar', userToken, 'POST', { Phone: jid });
    return res?.data?.URL || res?.URL || '';
  } catch {
    return '';
  }
}

export async function checkPhone(
  baseUrl: string,
  userToken: string,
  phone: string,
): Promise<{ isWhatsApp: boolean; jid?: string }> {
  try {
    const res = await apiCall(baseUrl, '/user/check', userToken, 'POST', { Phone: [phone] });
    const users = res?.data?.Users ?? [];
    const found = users.find((u: { IsInWhatsapp?: boolean }) => u.IsInWhatsapp);
    return {
      isWhatsApp: !!found,
      jid: found?.JID || undefined,
    };
  } catch {
    return { isWhatsApp: false };
  }
}

export function extractPhoneFromJid(jid: string): string {
  return jid.split('@')[0]?.split(':')[0] || jid;
}

/**
 * Retrieves the WhatsApp lid (internal JID) for a phone number.
 * Necessary for contacts that have never been conversed with before.
 */
export async function getUserLid(
  baseUrl: string,
  userToken: string,
  phone: string,
): Promise<{ jid?: string; lid?: string } | null> {
  try {
    const res = await apiCall(baseUrl, `/user/lid/${phone}`, userToken, 'GET');
    const data = res?.data || res;
    return {
      jid: data?.jid || undefined,
      lid: data?.lid || undefined,
    };
  } catch {
    return null;
  }
}

// ============================================================================
// GROUP ENDPOINTS
// ============================================================================

export interface WuzapiGroupParticipant {
  jid: string;
  phone: string;
  isAdmin: boolean;
  isSuperAdmin: boolean;
}

export interface WuzapiGroup {
  jid: string;
  name: string;
  participants: WuzapiGroupParticipant[];
}

export async function listGroups(
  baseUrl: string,
  userToken: string,
): Promise<WuzapiGroup[]> {
  try {
    const res = await apiCall(baseUrl, '/group/list', userToken, 'GET');
    const groups: any[] = res?.data?.Groups || res?.Groups || [];
    return groups.map((g: any) => ({
      jid: g.JID || g.jid || '',
      name: g.Name || g.name || '(Sem nome)',
      participants: (g.Participants || g.participants || []).map((p: any) => ({
        jid: p.JID || p.jid || '',
        phone: extractPhoneFromJid(p.JID || p.jid || ''),
        isAdmin: !!p.IsAdmin || !!p.isAdmin,
        isSuperAdmin: !!p.IsSuperAdmin || !!p.isSuperAdmin,
      })),
    }));
  } catch (err) {
    console.error('[WuzAPI] listGroups error:', err);
    return [];
  }
}

export async function getGroupInfo(
  baseUrl: string,
  userToken: string,
  groupJid: string,
): Promise<WuzapiGroup | null> {
  try {
    const res = await apiCall(baseUrl, `/group/info?groupJID=${encodeURIComponent(groupJid)}`, userToken, 'GET');
    const d = res?.data || res;
    if (!d) return null;
    return {
      jid: d.JID || d.jid || groupJid,
      name: d.Name || d.name || '(Sem nome)',
      participants: (d.Participants || d.participants || []).map((p: any) => ({
        jid: p.JID || p.jid || '',
        phone: extractPhoneFromJid(p.JID || p.jid || ''),
        isAdmin: !!p.IsAdmin || !!p.isAdmin,
        isSuperAdmin: !!p.IsSuperAdmin || !!p.isSuperAdmin,
      })),
    };
  } catch (err) {
    console.error('[WuzAPI] getGroupInfo error:', err);
    return null;
  }
}

// ============================================================================
// INSTANCE HELPERS
// ============================================================================

export async function getWuzapiInstanceByName(name: string): Promise<WuzapiInstance | null> {
  try {
    const response = await api.get(`/wuzapi/instances/by-name/${encodeURIComponent(name)}`);
    return response.data as WuzapiInstance | null;
  } catch {
    return null;
  }
}

export async function getWuzapiInstanceCredentials(instanceId: string): Promise<{ baseUrl: string; userToken: string } | null> {
  const creds = await loadWuzapiSettings();
  if (!creds) return null;
  
  try {
    const response = await api.get(`/wuzapi/instances/${instanceId}/credentials`);
    return response.data as { baseUrl: string; userToken: string } | null;
  } catch {
    return null;
  }
}
