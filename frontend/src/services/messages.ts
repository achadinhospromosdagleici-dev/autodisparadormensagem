// Messages Service
// Manages conversations and messages from WhatsApp webhooks

import { api } from '@/lib/api';

export interface Conversation {
  id: string;
  instance_name: string;
  phone_number: string;
  contact_name: string | null;
  profile_picture: string | null;
  last_message_at: string | null;
  last_message_preview: string | null;
  unread_count: number;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  instance_name: string;
  message_id: string | null;
  from_me: boolean;
  phone_number: string;
  content: string | null;
  message_type: string;
  media_url: string | null;
  media_caption: string | null;
  timestamp: string | null;
  created_at: string;
}

// Get all conversations for an instance
export async function getConversations(instanceName: string): Promise<Conversation[]> {
  try {
    const { data } = await api.get('/messages/conversations', { params: { instance_name: instanceName } });
    return data || [];
  } catch (error) {
    console.error('Error fetching conversations:', error);
    return [];
  }
}

// Get messages for a conversation
export async function getMessages(conversationId: string): Promise<Message[]> {
  try {
    const { data } = await api.get('/messages/conversations/' + conversationId + '/messages');
    return data || [];
  } catch (error) {
    console.error('Error fetching messages:', error);
    return [];
  }
}

// Get conversation by ID
export async function getConversation(conversationId: string): Promise<Conversation | null> {
  try {
    const { data } = await api.get('/messages/conversations/' + conversationId);
    return data || null;
  } catch (error) {
    console.error('Error fetching conversation:', error);
    return null;
  }
}

// Mark conversation as read (reset unread count)
export async function markConversationAsRead(conversationId: string): Promise<void> {
  await api.put('/messages/conversations/' + conversationId + '/read');
}

// Get total unread count for an instance
export async function getTotalUnreadCount(instanceName: string): Promise<number> {
  try {
    const { data } = await api.get('/messages/unread-count', { params: { instance_name: instanceName } });
    return data?.count ?? 0;
  } catch (error) {
    console.error('Error fetching unread count:', error);
    return 0;
  }
}

// Poll for new messages
export function subscribeToMessages(
  conversationId: string,
  onNewMessage: (message: Message) => void
) {
  let lastMessageId: string | null = null;
  const interval = setInterval(async () => {
    try {
      const { data } = await api.get('/messages/conversations/' + conversationId + '/messages', {
        params: { limit: 1, order: 'desc' }
      });
      if (data?.length > 0 && data[0].id !== lastMessageId) {
        lastMessageId = data[0].id;
        onNewMessage(data[0]);
      }
    } catch {}
  }, 5000);

  return () => clearInterval(interval);
}

// Poll for new conversations
export function subscribeToConversations(
  instanceName: string,
  onNewConversation: (conversation: Conversation) => void
) {
  let count = 0;
  const interval = setInterval(async () => {
    try {
      const newCount = (await api.get('/messages/conversations', { params: { instance_name: instanceName, limit: 1 } })).data?.length ?? 0;
      if (newCount > count) {
        count = newCount;
        onNewConversation({} as Conversation);
      }
    } catch {}
  }, 5000);

  return () => clearInterval(interval);
}

// Get the webhook URL for this app
export function getWebhookUrl(): string {
  return `${window.location.origin}/api/webhook/receiver`;
}