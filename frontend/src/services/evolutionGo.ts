// Evolution Go Service
// Manages WhatsApp connection via Evolution Go API

import { api } from '@/lib/api';
import { getCurrentUserId } from '@/lib/jwt';

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
  const userId = getCurrentUserId();
  if (!userId) return;
  await api.post('/settings/evolution-go', {
    baseUrl: creds.baseUrl,
    apiKey: creds.apiKey,
    instanceName: creds.instanceName,
  });
}

async function loadEvoGoFromDb(): Promise<EvolutionGoCredentials | null> {
  try {
    const userId = getCurrentUserId();
    if (!userId) return null;
    const response = await api.get('/settings/evolution-go');
    if (!response.data) return null;
    const data = response.data;
    return {
      baseUrl: data.baseUrl || data.base_url,
      apiKey: data.apiKey || data.api_key,
      instanceName: data.instanceName || data.instance_name,
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
  const userId = getCurrentUserId();
  if (!userId) return;
  await api.delete('/settings/evolution-go');
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
  console.log('[Evolution Go] Calling proxy...');
  const response = await api.post('/proxy/evolution-go', payload);
  const data = response.data;
  
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
  type?: 'text' | 'image' | 'video' | 'audio' | 'document' | 'buttons' | 'list' | 'carousel' | 'contact';
  content: string;
  mediaUrl?: string;
  caption?: string;
  filename?: string;
  title?: string;
  footer?: string;
  btnTitle?: string;
  btnFooter?: string;
  buttons?: Array<{ type: 'url' | 'phone' | 'reply' | 'copy'; label: string; value: string }>;
  linkUrl?: string;
  sections?: Array<{ title: string; rows: Array<{ id?: string; title: string; description: string }> }>;
  cards?: Array<{ image?: string; title?: string; description?: string; footer?: string; buttons?: Array<{ type: 'url' | 'phone' | 'reply' | 'copy'; label: string; value: string }> }>;
  // Para contact:
  contactName?: string;
  contactNumber?: string;
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