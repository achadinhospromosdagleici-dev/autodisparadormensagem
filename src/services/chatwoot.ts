// Chatwoot API Service
// Manages communication with Chatwoot API for message sending and inbox management

export interface ChatwootCredentials {
  baseUrl: string; // e.g. https://app.chatwoot.com
  apiToken: string;
  accountId: number;
}

export interface ChatwootInbox {
  id: number;
  name: string;
  channel_type: string;
  phone_number?: string;
  avatar_url?: string;
}

export interface ChatwootConversation {
  id: number;
  inbox_id: number;
  status: string;
  contact: {
    id: number;
    name: string;
    phone_number: string;
  };
  messages: ChatwootMessage[];
}

export interface ChatwootMessage {
  id: number;
  content: string;
  message_type: 'incoming' | 'outgoing';
  created_at: number;
  conversation_id: number;
}

export interface ChatwootContact {
  id: number;
  name: string;
  phone_number: string;
  email?: string;
}

const STORAGE_KEY = 'chatwoot_credentials';

export function saveChatwootCredentials(credentials: ChatwootCredentials): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(credentials));
}

export function loadChatwootCredentials(): ChatwootCredentials | null {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return null;
  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

export function clearChatwootCredentials(): void {
  localStorage.removeItem(STORAGE_KEY);
}

function getHeaders(apiToken: string) {
  return {
    'Content-Type': 'application/json',
    api_access_token: apiToken,
  };
}

export async function fetchInboxes(creds: ChatwootCredentials): Promise<ChatwootInbox[]> {
  const res = await fetch(
    `${creds.baseUrl}/api/v1/accounts/${creds.accountId}/inboxes`,
    { headers: getHeaders(creds.apiToken) }
  );
  if (!res.ok) throw new Error(`Erro ao buscar caixas de entrada: ${res.status}`);
  const data = await res.json();
  return data.payload || [];
}

export async function searchContact(
  creds: ChatwootCredentials,
  phoneNumber: string
): Promise<ChatwootContact | null> {
  const res = await fetch(
    `${creds.baseUrl}/api/v1/accounts/${creds.accountId}/contacts/search?q=${encodeURIComponent(phoneNumber)}`,
    { headers: getHeaders(creds.apiToken) }
  );
  if (!res.ok) return null;
  const data = await res.json();
  return data.payload?.[0] || null;
}

export async function createContact(
  creds: ChatwootCredentials,
  name: string,
  phoneNumber: string,
  inboxId: number
): Promise<ChatwootContact> {
  const res = await fetch(
    `${creds.baseUrl}/api/v1/accounts/${creds.accountId}/contacts`,
    {
      method: 'POST',
      headers: getHeaders(creds.apiToken),
      body: JSON.stringify({
        name,
        phone_number: phoneNumber,
        inbox_id: inboxId,
      }),
    }
  );
  if (!res.ok) throw new Error(`Erro ao criar contato: ${res.status}`);
  const data = await res.json();
  return data.payload?.contact || data;
}

export async function createConversation(
  creds: ChatwootCredentials,
  contactId: number,
  inboxId: number
): Promise<ChatwootConversation> {
  const res = await fetch(
    `${creds.baseUrl}/api/v1/accounts/${creds.accountId}/conversations`,
    {
      method: 'POST',
      headers: getHeaders(creds.apiToken),
      body: JSON.stringify({
        contact_id: contactId,
        inbox_id: inboxId,
      }),
    }
  );
  if (!res.ok) throw new Error(`Erro ao criar conversa: ${res.status}`);
  return await res.json();
}

export async function sendMessage(
  creds: ChatwootCredentials,
  conversationId: number,
  content: string
): Promise<ChatwootMessage> {
  const res = await fetch(
    `${creds.baseUrl}/api/v1/accounts/${creds.accountId}/conversations/${conversationId}/messages`,
    {
      method: 'POST',
      headers: getHeaders(creds.apiToken),
      body: JSON.stringify({
        content,
        message_type: 'outgoing',
        private: false,
      }),
    }
  );
  if (!res.ok) throw new Error(`Erro ao enviar mensagem: ${res.status}`);
  return await res.json();
}

export async function getConversationMessages(
  creds: ChatwootCredentials,
  conversationId: number
): Promise<ChatwootMessage[]> {
  const res = await fetch(
    `${creds.baseUrl}/api/v1/accounts/${creds.accountId}/conversations/${conversationId}/messages`,
    { headers: getHeaders(creds.apiToken) }
  );
  if (!res.ok) throw new Error(`Erro ao buscar mensagens: ${res.status}`);
  const data = await res.json();
  return data.payload || [];
}

export async function checkForReply(
  creds: ChatwootCredentials,
  conversationId: number,
  afterTimestamp: number
): Promise<boolean> {
  const messages = await getConversationMessages(creds, conversationId);
  return messages.some(
    (msg) => msg.message_type === 'incoming' && msg.created_at > afterTimestamp
  );
}

export async function getContactConversations(
  creds: ChatwootCredentials,
  contactId: number
): Promise<ChatwootConversation[]> {
  const res = await fetch(
    `${creds.baseUrl}/api/v1/accounts/${creds.accountId}/contacts/${contactId}/conversations`,
    { headers: getHeaders(creds.apiToken) }
  );
  if (!res.ok) return [];
  const data = await res.json();
  return data.payload || [];
}
