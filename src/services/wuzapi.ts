import { supabase } from '@/integrations/supabase/client';

export interface WuzapiCredentials {
  baseUrl: string;
  adminToken: string;
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

const STORAGE_KEY = 'wuzapi_credentials';

/**
 * Saves global WuzAPI settings to localStorage and Supabase.
 */
export async function saveWuzapiSettings(creds: WuzapiCredentials): Promise<void> {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(creds));
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  
  await supabase.from('wuzapi_settings').upsert({
    user_id: user.id,
    base_url: creds.baseUrl,
    admin_token: creds.adminToken,
  }, { onConflict: 'user_id' });
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
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    
    const { data, error } = await supabase
      .from('wuzapi_settings')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();
      
    if (error || !data) return null;
    
    const creds = {
      baseUrl: data.base_url,
      adminToken: data.admin_token,
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
 */
export async function loadWuzapiInstances(): Promise<WuzapiInstance[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  
  const { data } = await supabase
    .from('wuzapi_instances')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });
  
  return (data || []) as WuzapiInstance[];
}

/**
 * Clears WuzAPI settings.
 */
export async function clearWuzapiSettings(): Promise<void> {
  localStorage.removeItem(STORAGE_KEY);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  
  await supabase.from('wuzapi_settings').delete().eq('user_id', user.id);
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
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  
  await supabase.from('wuzapi_instances').upsert({
    user_id: user.id,
    settings_id: settingsId,
    user_token: userToken,
    phone,
    name,
    status
  }, { onConflict: 'settings_id,user_token' });
  
  await supabase.from('user_instances').upsert({
    user_id: user.id,
    instance_name: `wuz_${name}`,
    phone,
    profile_name: name,
    status: status === 'connected' ? 'connected' : 'connecting',
    source: 'wuzapi'
  }, { onConflict: 'user_id,instance_name' });
}

/**
 * Updates a WuzAPI instance.
 */
export async function updateWuzapiInstance(
  id: string,
  updates: Partial<WuzapiInstance>
): Promise<void> {
  await supabase.from('wuzapi_instances').update(updates).eq('id', id);
}

/**
 * Deletes a WuzAPI instance.
 */
export async function deleteWuzapiInstance(id: string): Promise<void> {
  const { data } = await supabase
    .from('wuzapi_instances')
    .select('name,user_token')
    .eq('id', id)
    .single();
  
  if (data) {
    await supabase.from('user_instances').delete()
      .eq('user_id', (await supabase.auth.getUser()).data.user?.id || '')
      .eq('instance_name', `wuz_${data.name}`);
  }
  
  await supabase.from('wuzapi_instances').delete().eq('id', id);
}

/**
 * Gets a single WuzAPI instance by ID.
 */
export async function getWuzapiInstanceById(id: string): Promise<WuzapiInstance | null> {
  const { data } = await supabase
    .from('wuzapi_instances')
    .select('*')
    .eq('id', id)
    .single();
  
  return data as WuzapiInstance | null;
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
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { data: settings } = await supabase
    .from('wuzapi_settings')
    .select('id')
    .eq('user_id', user.id)
    .single();

  if (!settings) {
    throw new Error('Configuração global da WuzAPI não encontrada. Configure-a primeiro.');
  }

  // 1. Save to wuzapi_instances
  const { error: wuzErr } = await supabase.from('wuzapi_instances').upsert({
    user_id: user.id,
    settings_id: settings.id,
    user_token: userToken,
    phone,
    name,
    status
  }, { onConflict: 'settings_id,user_token' });

  if (wuzErr) throw wuzErr;

  // 2. Save to centralized user_instances (with wuz_ prefix)
  const { error: userErr } = await supabase.from('user_instances').upsert({
    user_id: user.id,
    instance_name: `wuz_${name}`,
    phone,
    profile_name: name,
    status: status === 'connected' ? 'connected' : 'connecting',
    source: 'wuzapi'
  }, { onConflict: 'user_id,instance_name' });

  if (userErr) throw userErr;
}

/**
 * Deletes WuzAPI instance from both tables.
 */
export async function deleteWuzapiInstanceDb(name: string, userToken: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { data: settings } = await supabase
    .from('wuzapi_settings')
    .select('id')
    .eq('user_id', user.id)
    .single();

  if (settings) {
    await supabase.from('wuzapi_instances').delete().eq('settings_id', settings.id).eq('user_token', userToken);
  }

  await supabase.from('user_instances').delete().eq('user_id', user.id).eq('instance_name', `wuz_${name}`);
}

/**
 * Helper to fetch from WuzAPI with appropriate headers.
 */
async function apiCall(
  baseUrl: string,
  endpoint: string,
  token: string,
  method = 'GET',
  body?: any
): Promise<any> {
  const cleanBase = baseUrl.replace(/\/+$/, '');
  const url = `${cleanBase}${endpoint}`;
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    'Authorization': token,
  };

  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorObj;
    try {
      errorObj = JSON.parse(errorText);
    } catch {
      // ignore
    }
    throw new Error(errorObj?.error || errorText || `API error (${response.status})`);
  }

  return response.json();
}

// ============================================================================
// ADMIN ENDPOINTS
// ============================================================================

export async function testConnection(baseUrl: string, adminToken: string): Promise<boolean> {
  try {
    await listUsers(baseUrl, adminToken);
    return true;
  } catch (err) {
    console.error('[WuzAPI] Admin connection test failed:', err);
    return false;
  }
}

export async function listUsers(baseUrl: string, adminToken: string): Promise<WuzapiUser[]> {
  const data = await apiCall(baseUrl, '/admin/users', adminToken, 'GET');
  return Array.isArray(data) ? data : (data?.users || []);
}

export async function createUser(
  baseUrl: string,
  adminToken: string,
  name: string
): Promise<{ id: number; token: string }> {
  const body = {
    Name: name,
    Webhook: '',
    Events: []
  };
  return apiCall(baseUrl, '/admin/users', adminToken, 'POST', body);
}

export async function deleteUser(baseUrl: string, adminToken: string, userId: number): Promise<void> {
  await apiCall(baseUrl, `/admin/users/${userId}`, adminToken, 'DELETE');
}

// ============================================================================
// SESSION ENDPOINTS
// ============================================================================

export async function connect(baseUrl: string, userToken: string): Promise<{ success: boolean; jid?: string }> {
  return apiCall(baseUrl, '/session/connect', userToken, 'POST');
}

export async function getStatus(
  baseUrl: string,
  userToken: string
): Promise<{ connected: boolean; loggedIn: boolean; jid?: string }> {
  try {
    const status = await apiCall(baseUrl, '/session/status', userToken, 'GET');
    return {
      connected: !!status.connected,
      loggedIn: !!status.loggedIn,
      jid: status.jid || undefined,
    };
  } catch (err) {
    console.error('[WuzAPI] getStatus error:', err);
    return { connected: false, loggedIn: false };
  }
}

export async function getQRCode(baseUrl: string, userToken: string): Promise<string> {
  const res = await apiCall(baseUrl, '/session/qr', userToken, 'GET');
  // Returns base64 image data URL or string containing QR code
  return res.qr || res.qrcode || res.QR || '';
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
    Audio: audioData
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

// ============================================================================
// INSTANCE HELPERS
// ============================================================================

export async function getWuzapiInstanceByName(name: string): Promise<WuzapiInstance | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  
  const { data } = await supabase
    .from('wuzapi_instances')
    .select('*')
    .eq('user_id', user.id)
    .eq('name', name)
    .single();
  
  return data as WuzapiInstance | null;
}

export async function getWuzapiInstanceCredentials(instanceId: string): Promise<{ baseUrl: string; userToken: string } | null> {
  const creds = await loadWuzapiSettings();
  if (!creds) return null;
  
  const { data } = await supabase
    .from('wuzapi_instances')
    .select('user_token')
    .eq('id', instanceId)
    .single();
  
  if (!data) return null;
  
  return {
    baseUrl: creds.baseUrl,
    userToken: data.user_token
  };
}
