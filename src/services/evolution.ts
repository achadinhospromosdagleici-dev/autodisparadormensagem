// Evolution API Service
// Manages WhatsApp connection via Evolution API

export interface EvolutionCredentials {
  baseUrl: string;
  apiKey: string;
  instanceName: string;
}

export interface EvolutionInstance {
  instanceName: string;
  status: string;
  qrcode?: string;
  pairingCode?: string;
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

function getHeaders(apiKey: string) {
  return {
    'Content-Type': 'application/json',
    apikey: apiKey,
  };
}

export async function createInstance(creds: EvolutionCredentials): Promise<any> {
  const res = await fetch(`${creds.baseUrl}/instance/create`, {
    method: 'POST',
    headers: getHeaders(creds.apiKey),
    body: JSON.stringify({
      instanceName: creds.instanceName,
      integration: 'WHATSAPP-BAILEYS',
      qrcode: true,
    }),
  });
  if (!res.ok) throw new Error(`Erro ao criar instância: ${res.status}`);
  return res.json();
}

export async function getInstanceStatus(creds: EvolutionCredentials): Promise<any> {
  const res = await fetch(
    `${creds.baseUrl}/instance/connectionState/${creds.instanceName}`,
    { headers: getHeaders(creds.apiKey) }
  );
  if (!res.ok) throw new Error(`Erro ao verificar status: ${res.status}`);
  return res.json();
}

export async function getQRCode(creds: EvolutionCredentials): Promise<string> {
  const res = await fetch(
    `${creds.baseUrl}/instance/connect/${creds.instanceName}`,
    { headers: getHeaders(creds.apiKey) }
  );
  if (!res.ok) throw new Error(`Erro ao gerar QR Code: ${res.status}`);
  const data = await res.json();
  return data.base64 || data.qrcode?.base64 || '';
}

export async function getPairingCode(creds: EvolutionCredentials, phoneNumber: string): Promise<string> {
  const res = await fetch(
    `${creds.baseUrl}/instance/connect/${creds.instanceName}`,
    {
      method: 'POST',
      headers: getHeaders(creds.apiKey),
      body: JSON.stringify({ number: phoneNumber }),
    }
  );
  if (!res.ok) throw new Error(`Erro ao gerar código: ${res.status}`);
  const data = await res.json();
  return data.pairingCode || data.code || '';
}

export async function logoutInstance(creds: EvolutionCredentials): Promise<void> {
  await fetch(`${creds.baseUrl}/instance/logout/${creds.instanceName}`, {
    method: 'DELETE',
    headers: getHeaders(creds.apiKey),
  });
}

export async function deleteInstance(creds: EvolutionCredentials): Promise<void> {
  await fetch(`${creds.baseUrl}/instance/delete/${creds.instanceName}`, {
    method: 'DELETE',
    headers: getHeaders(creds.apiKey),
  });
}

export async function fetchInstances(creds: EvolutionCredentials): Promise<any[]> {
  const res = await fetch(`${creds.baseUrl}/instance/fetchInstances`, {
    headers: getHeaders(creds.apiKey),
  });
  if (!res.ok) throw new Error(`Erro ao buscar instâncias: ${res.status}`);
  return res.json();
}
