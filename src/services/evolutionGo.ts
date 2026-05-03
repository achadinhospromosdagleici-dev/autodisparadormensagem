// Evolution Go Service
// Manages WhatsApp connection via Evolution Go API

import { supabase } from '@/integrations/supabase/client';

export interface EvolutionGoCredentials {
  baseUrl: string;
  apiKey: string;
  instanceName?: string;
}

export interface EvolutionGoInstance {
  instanceName: string;
  status: string;
  phone: string;
  profileName?: string;
  profilePictureUrl?: string;
}

const STORAGE_KEY = 'evolution_go_credentials';

async function saveEvoGoToDb(creds: EvolutionGoCredentials): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from('evolution_go_settings').upsert({
    user_id: user.id,
    base_url: creds.baseUrl,
    api_key: creds.apiKey,
    instance_name: creds.instanceName,
  }, { onConflict: 'user_id' });
}

async function loadEvoGoFromDb(): Promise<EvolutionGoCredentials | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data, error } = await supabase.from('evolution_go_settings').select('*').eq('user_id', user.id).maybeSingle();
    if (error) {
      console.error('Error loading evolution-go from DB:', error);
      return null;
    }
    if (!data) return null;
    return {
      baseUrl: data.base_url,
      apiKey: data.api_key,
      instanceName: data.instance_name,
    };
  } catch (error) {
    console.error('Error loading evolution-go from DB:', error);
    return null;
  }
}

export async function saveEvolutionGoCredentials(creds: EvolutionGoCredentials): Promise<void> {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(creds));
  await saveEvoGoToDb(creds);
}

export function loadEvolutionGoCredentials(): EvolutionGoCredentials | null {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return null;
  try { return JSON.parse(stored); } catch { return null; }
}

export async function loadEvolutionGoCredentialsWithFallback(): Promise<EvolutionGoCredentials | null> {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) { try { return JSON.parse(stored); } catch { return null; } }
  try {
    return await loadEvoGoFromDb();
  } catch {
    return null;
  }
}

export async function clearEvolutionGoCredentials(): Promise<void> {
  localStorage.removeItem(STORAGE_KEY);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from('evolution_go_settings').delete().eq('user_id', user.id);
}

export function isEvolutionGoConnected(): boolean {
  const creds = loadEvolutionGoCredentials();
  return !!(creds?.baseUrl && creds?.apiKey);
}

export async function isEvolutionGoConnectedAsync(): Promise<boolean> {
  const creds = await loadEvolutionGoCredentialsWithFallback();
  return !!(creds?.baseUrl && creds?.apiKey);
}

// ── Generic proxy call ──
async function evolutionGoCall(payload: Record<string, any>): Promise<any> {
  // ATTEMPT DIRECT CALL BYPASSING PROXY
  if (payload.action === 'sendMessage' && payload.baseUrl && payload.apiKey && payload.to && payload.message) {
    try {
      const base = payload.baseUrl.replace(/\/$/, '');
      
      // Tentar endpoint /send/text primeiro (EvoGo customizado) se for texto
      if (payload.message.type === 'text' || !payload.message.type) {
        try {
          const directRes = await fetch(`${base}/send/text`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': payload.apiKey,
              'apiKey': payload.apiKey,
              'Authorization': `Bearer ${payload.apiKey}`
            },
            body: JSON.stringify({
              number: payload.to,
              textMessage: {
                text: payload.message.content
              },
              delay: 1200
            })
          });
          
          if (directRes.ok) {
            console.log('[Evolution Go] Direct /send/text succeeded!');
            return await directRes.json();
          }
        } catch (e) {
          console.log('[Evolution Go] Direct /send/text failed (CORS or network):', e);
        }
      }

      // Fallback para endpoint padrão Evolution
      const endpoint = `${base}/message/sendText/${payload.instanceName}`;
      try {
        const directRes2 = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': payload.apiKey,
            'apiKey': payload.apiKey,
            'Authorization': `Bearer ${payload.apiKey}`
          },
          body: JSON.stringify({
            number: payload.to,
            textMessage: {
              text: payload.message.content
            },
            delay: 1200
          })
        });
        
        if (directRes2.ok) {
          console.log('[Evolution Go] Direct standard endpoint succeeded!');
          return await directRes2.json();
        }
      } catch (e) {
        console.log('[Evolution Go] Direct standard endpoint failed:', e);
      }
    } catch (err) {
      console.log('[Evolution Go] Direct bypass attempt failed, falling back to proxy...', err);
    }
  }

  // FALLBACK PARA O PROXY (SUPABASE EDGE FUNCTION)
  console.log('[Evolution Go] Calling proxy...');
  const { data, error } = await supabase.functions.invoke('evolution-go-proxy', {
    body: payload,
  });
  
  if (error) {
    console.error('[Evolution Go Call] Error:', error);
    let errorDetails = '';
    if (error.context && typeof error.context.text === 'function') {
      try {
        errorDetails = await error.context.clone().text();
        console.error('[Evolution Go Call] Raw text:', errorDetails);
      } catch (e) {
        // failed to read text
      }
    }
    throw new Error(errorDetails || error.message || 'Erro na chamada Evolution Go');
  }
  
  if (data?.error) throw new Error(data.error);
  return data;
}

// ── Listar instâncias ──
export async function fetchEvolutionGoInstances(creds: EvolutionGoCredentials): Promise<EvolutionGoInstance[]> {
  const data = await evolutionGoCall({
    action: 'fetchInstances',
    baseUrl: creds.baseUrl,
    apiKey: creds.apiKey,
  });
  return data.instances || [];
}

// ── Encontrar ou criar instância ──
export async function findOrCreateEvolutionGoInstance(
  creds: EvolutionGoCredentials,
  instanceName: string
): Promise<{ action: 'existing' | 'created'; instanceName: string; status: string; qrcode?: string; phone?: string }> {
  return evolutionGoCall({
    action: 'findOrCreate',
    baseUrl: creds.baseUrl,
    apiKey: creds.apiKey,
    instanceName,
  });
}

// ── Gerar QR Code ──
export async function getEvolutionGoQRCode(creds: EvolutionGoCredentials, instanceName: string): Promise<{ qrcode: string; pairingCode: string }> {
  return evolutionGoCall({
    action: 'connect',
    baseUrl: creds.baseUrl,
    apiKey: creds.apiKey,
    instanceName,
  });
}

// ── Verificar status ──
export async function getEvolutionGoInstanceStatus(
  creds: EvolutionGoCredentials,
  instanceName: string
): Promise<{ status: string; connected?: boolean; qrcode?: string; phone?: string }> {
  return evolutionGoCall({
    action: 'connectionState',
    baseUrl: creds.baseUrl,
    apiKey: creds.apiKey,
    instanceName,
  });
}

// ── Desconectar ──
export async function logoutEvolutionGoInstance(creds: EvolutionGoCredentials, instanceName: string): Promise<void> {
  await evolutionGoCall({
    action: 'logout',
    baseUrl: creds.baseUrl,
    apiKey: creds.apiKey,
    instanceName,
  });
}

// ── Enviar mensagem ──
export interface EvolutionGoMessage {
  type?: 'text' | 'image' | 'video' | 'audio' | 'document' | 'buttons' | 'list' | 'carousel';
  content: string;
  mediaUrl?: string;
  caption?: string;
  filename?: string;
  title?: string;
  footer?: string;
  btnTitle?: string;
  btnFooter?: string;
  buttons?: Array<{ type: 'url' | 'phone' | 'reply'; label: string; value: string }>;
  linkUrl?: string;
  sections?: Array<{ title: string; rows: Array<{ id?: string; title: string; description: string }> }>;
  cards?: Array<{ image?: string; title?: string; description?: string; footer?: string; buttons?: Array<{ type: 'url' | 'phone' | 'reply'; label: string; value: string }> }>;
}

export async function sendEvolutionGoMessage(
  creds: EvolutionGoCredentials,
  instanceName: string,
  phoneNumber: string,
  message: EvolutionGoMessage
): Promise<any> {
  return evolutionGoCall({
    action: 'sendMessage',
    baseUrl: creds.baseUrl,
    apiKey: creds.apiKey,
    instanceName,
    to: phoneNumber,
    message,
  });
}

// ── Webhook ──
export async function setEvolutionGoWebhook(
  creds: EvolutionGoCredentials,
  instanceName: string,
  webhookUrl: string
): Promise<void> {
  await evolutionGoCall({
    action: 'setWebhook',
    baseUrl: creds.baseUrl,
    apiKey: creds.apiKey,
    instanceName,
    webhookUrl,
  });
}

export async function removeEvolutionGoWebhook(
  creds: EvolutionGoCredentials,
  instanceName: string
): Promise<void> {
  await evolutionGoCall({
    action: 'removeWebhook',
    baseUrl: creds.baseUrl,
    apiKey: creds.apiKey,
    instanceName,
  });
}

export async function getEvolutionGoWebhook(
  creds: EvolutionGoCredentials,
  instanceName: string
): Promise<{ webhookUrl?: string }> {
  return evolutionGoCall({
    action: 'getWebhook',
    baseUrl: creds.baseUrl,
    apiKey: creds.apiKey,
    instanceName,
  });
}