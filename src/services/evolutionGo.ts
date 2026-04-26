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
  await supabase.from('user_settings').upsert({
    user_id: user.id,
    key: 'evolution-go',
    value: creds as unknown as object
  }, { onConflict: 'user_id,key' });
}

async function loadEvoGoFromDb(): Promise<EvolutionGoCredentials | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from('user_settings').select('value').eq('user_id', user.id).eq('key', 'evolution-go').single();
  return (data?.value ?? null) as EvolutionGoCredentials | null;
}

export async function saveEvolutionGoCredentials(creds: EvolutionGoCredentials): Promise<void> {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(creds));
  await saveEvoGoToDb(creds);
}

export async function loadEvolutionGoCredentials(): Promise<EvolutionGoCredentials | null> {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return null;
  try { return JSON.parse(stored); } catch { return null; }
}

export async function loadEvolutionGoCredentialsWithFallback(): Promise<EvolutionGoCredentials | null> {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) { try { return JSON.parse(stored); } catch { return null; } }
  return loadEvoGoFromDb();
}

export async function clearEvolutionGoCredentials(): Promise<void> {
  localStorage.removeItem(STORAGE_KEY);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from('user_settings').delete().eq('user_id', user.id).eq('key', 'evolution-go');
}

export function isEvolutionGoConnected(): boolean {
  const creds = loadEvolutionGoCredentials();
  return !!(creds?.baseUrl && creds?.apiKey);
}

// ── Generic proxy call ──
async function evolutionGoCall(payload: Record<string, any>): Promise<any> {
  const { data, error } = await supabase.functions.invoke('evolution-go-proxy', {
    body: payload,
  });
  if (error) throw new Error(error.message || 'Erro na chamada Evolution Go');
  if (data?.error) throw new Error(data.error);
  return data;
}

// ── ETAPA 1: Listar instâncias ──
export async function fetchEvolutionGoInstances(creds: EvolutionGoCredentials): Promise<EvolutionGoInstance[]> {
  const data = await evolutionGoCall({
    action: 'fetchInstances',
    baseUrl: creds.baseUrl,
    apiKey: creds.apiKey,
  });
  return data.instances || [];
}

// ── ETAPA 1: Encontrar ou criar instância (anti-duplicação) ──
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

// ── ETAPA 2: Gerar QR Code ──
export async function getEvolutionGoQRCode(creds: EvolutionGoCredentials, instanceName: string): Promise<{ qrcode: string; pairingCode: string }> {
  return evolutionGoCall({
    action: 'connect',
    baseUrl: creds.baseUrl,
    apiKey: creds.apiKey,
    instanceName,
  });
}

// ── ETAPA 2: Verificar status da conexão ──
export async function getEvolutionGoInstanceStatus(
  creds: EvolutionGoCredentials,
  instanceName: string
): Promise<{ instanceName: string; status: string; connected: boolean }> {
  return evolutionGoCall({
    action: 'connectionState',
    baseUrl: creds.baseUrl,
    apiKey: creds.apiKey,
    instanceName,
  });
}

// ── ETAPA 2: Logout ──
export async function logoutEvolutionGoInstance(creds: EvolutionGoCredentials, instanceName: string): Promise<void> {
  await evolutionGoCall({
    action: 'logout',
    baseUrl: creds.baseUrl,
    apiKey: creds.apiKey,
    instanceName,
  });
}

// ── ETAPA 3: Enviar mensagem com validação de status ──
export interface EvolutionGoMessage {
  type: 'text' | 'image' | 'audio' | 'video' | 'document' | 'buttons' | 'link' | 'list' | 'carousel';
  content: string;
  mediaUrl?: string;
  caption?: string;
  filename?: string;
  title?: string;
  footer?: string;
  btnTitle?: string;
  btnFooter?: string;
  buttons?: { type: 'url' | 'phone' | 'reply'; label: string; value: string }[];
  linkUrl?: string;
  // Para list:
  sections?: { title: string; rows: { id?: string; title: string; description: string }[] }[];
  // Para carousel:
  cards?: {
    image?: string;
    title?: string;
    description?: string;
    footer?: string;
    buttons?: { type: 'url' | 'phone' | 'reply'; label: string; value: string }[];
  }[];
}

export async function sendEvolutionGoMessage(
  creds: EvolutionGoCredentials,
  instanceName: string,
  to: string,
  message: EvolutionGoMessage
): Promise<any> {
  return evolutionGoCall({
    action: 'sendMessage',
    baseUrl: creds.baseUrl,
    apiKey: creds.apiKey,
    instanceName,
    to,
    message,
  });
}

// ── WEBHOOK: Configurar webhook ──
export async function setEvolutionGoWebhook(
  creds: EvolutionGoCredentials,
  instanceName: string,
  webhookUrl: string
): Promise<{ success: boolean; webhookUrl: string }> {
  return evolutionGoCall({
    action: 'setWebhook',
    baseUrl: creds.baseUrl,
    apiKey: creds.apiKey,
    instanceName,
    webhookUrl,
    events: ['MESSAGES_UPSERT', 'MESSAGES_UPDATE', 'CONNECTION_UPDATE'],
  });
}

// ── WEBHOOK: Remover webhook ──
export async function removeEvolutionGoWebhook(
  creds: EvolutionGoCredentials,
  instanceName: string
): Promise<{ success: boolean }> {
  return evolutionGoCall({
    action: 'removeWebhook',
    baseUrl: creds.baseUrl,
    apiKey: creds.apiKey,
    instanceName,
  });
}

// ── WEBHOOK: Buscar configuração atual ──
export async function getEvolutionGoWebhook(
  creds: EvolutionGoCredentials,
  instanceName: string
): Promise<{ enabled: boolean; url: string; events: string[] }> {
  return evolutionGoCall({
    action: 'getWebhook',
    baseUrl: creds.baseUrl,
    apiKey: creds.apiKey,
    instanceName,
  });
}