// Evolution API Service
// Manages WhatsApp connection via Evolution API with edge function proxy

import { supabase } from '@/integrations/supabase/client';

export interface EvolutionCredentials {
  baseUrl: string;
  apiKey: string;
  instanceName?: string;
}

export interface EvolutionInstance {
  instanceName: string;
  status: string;
  phone: string;
  profileName?: string;
  profilePictureUrl?: string;
}

const STORAGE_KEY = 'evolution_credentials';

export function saveEvolutionCredentials(creds: EvolutionCredentials): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(creds));
}

export function loadEvolutionCredentials(): EvolutionCredentials | null {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return null;
  try { return JSON.parse(stored); } catch { return null; }
}

export function clearEvolutionCredentials(): void {
  localStorage.removeItem(STORAGE_KEY);
}

// ── Generic proxy call ──
async function evolutionCall(payload: Record<string, any>): Promise<any> {
  const { data, error } = await supabase.functions.invoke('evolution-proxy', {
    body: payload,
  });
  if (error) throw new Error(error.message || 'Erro na chamada Evolution');
  if (data?.error) throw new Error(data.error);
  return data;
}

// ── ETAPA 1: Listar instâncias ──
export async function fetchInstances(creds: EvolutionCredentials): Promise<EvolutionInstance[]> {
  const data = await evolutionCall({
    action: 'fetchInstances',
    baseUrl: creds.baseUrl,
    apiKey: creds.apiKey,
  });
  return data.instances || [];
}

// ── ETAPA 1: Encontrar ou criar instância (anti-duplicação) ──
export async function findOrCreateInstance(
  creds: EvolutionCredentials,
  instanceName: string
): Promise<{ action: 'existing' | 'created'; instanceName: string; status: string; qrcode?: string; phone?: string }> {
  return evolutionCall({
    action: 'findOrCreate',
    baseUrl: creds.baseUrl,
    apiKey: creds.apiKey,
    instanceName,
  });
}

// ── ETAPA 2: Gerar QR Code ──
export async function getQRCode(creds: EvolutionCredentials, instanceName: string): Promise<{ qrcode: string; pairingCode: string }> {
  return evolutionCall({
    action: 'connect',
    baseUrl: creds.baseUrl,
    apiKey: creds.apiKey,
    instanceName,
  });
}

// ── ETAPA 2: Verificar status da conexão ──
export async function getInstanceStatus(
  creds: EvolutionCredentials,
  instanceName: string
): Promise<{ instanceName: string; status: string; connected: boolean }> {
  return evolutionCall({
    action: 'connectionState',
    baseUrl: creds.baseUrl,
    apiKey: creds.apiKey,
    instanceName,
  });
}

// ── ETAPA 2: Logout ──
export async function logoutInstance(creds: EvolutionCredentials, instanceName: string): Promise<void> {
  await evolutionCall({
    action: 'logout',
    baseUrl: creds.baseUrl,
    apiKey: creds.apiKey,
    instanceName,
  });
}

// ── ETAPA 3: Enviar mensagem com validação de status ──
export interface EvolutionMessage {
  type: 'text' | 'image' | 'audio' | 'video' | 'document' | 'buttons' | 'link';
  content: string;
  mediaUrl?: string;
  caption?: string;
  filename?: string;
  // Para buttons:
  title?: string;
  footer?: string;
  buttons?: { type: 'url' | 'phone' | 'reply'; label: string; value: string }[];
  // Para link:
  linkUrl?: string;
}

export async function sendMessage(
  creds: EvolutionCredentials,
  instanceName: string,
  to: string,
  message: EvolutionMessage
): Promise<any> {
  return evolutionCall({
    action: 'sendMessage',
    baseUrl: creds.baseUrl,
    apiKey: creds.apiKey,
    instanceName,
    to,
    message,
  });
}
