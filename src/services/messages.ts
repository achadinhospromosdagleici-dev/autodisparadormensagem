// Messages Service
// Manages conversations and messages from WhatsApp webhooks

import { supabase as supabaseClient } from '@/integrations/supabase/client';
// Tables `conversations` and `messages` are managed via webhook and not in generated types
const supabase: any = supabaseClient;

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
  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .eq('instance_name', instanceName)
    .order('last_message_at', { ascending: false });

  if (error) {
    console.error('Error fetching conversations:', error);
    return [];
  }

  return data || [];
}

// Get messages for a conversation
export async function getMessages(conversationId: string): Promise<Message[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('timestamp', { ascending: true });

  if (error) {
    console.error('Error fetching messages:', error);
    return [];
  }

  return data || [];
}

// Get conversation by ID
export async function getConversation(conversationId: string): Promise<Conversation | null> {
  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .eq('id', conversationId)
    .single();

  if (error) {
    console.error('Error fetching conversation:', error);
    return null;
  }

  return data;
}

// Mark conversation as read (reset unread count)
export async function markConversationAsRead(conversationId: string): Promise<void> {
  await supabase
    .from('conversations')
    .update({ unread_count: 0 })
    .eq('id', conversationId);
}

// Get total unread count for an instance
export async function getTotalUnreadCount(instanceName: string): Promise<number> {
  const { data, error } = await supabase
    .from('conversations')
    .select('unread_count')
    .eq('instance_name', instanceName);

  if (error) {
    console.error('Error fetching unread count:', error);
    return 0;
  }

  return (data || []).reduce((sum, conv) => sum + (conv.unread_count || 0), 0);
}

// Subscribe to new messages for real-time updates
export function subscribeToMessages(
  conversationId: string,
  onNewMessage: (message: Message) => void
) {
  const channel = supabase
    .channel(`messages-${conversationId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload) => {
        onNewMessage(payload.new as Message);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

// Subscribe to new conversations for an instance
export function subscribeToConversations(
  instanceName: string,
  onNewConversation: (conversation: Conversation) => void
) {
  const channel = supabase
    .channel(`conversations-${instanceName}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'conversations',
        filter: `instance_name=eq.${instanceName}`,
      },
      (payload) => {
        onNewConversation(payload.new as Conversation);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

// Get the webhook URL for this app
export function getWebhookUrl(): string {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  return `${supabaseUrl}/functions/v1/webhook-receiver`;
}