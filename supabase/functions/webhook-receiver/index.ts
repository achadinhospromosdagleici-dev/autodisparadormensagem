import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

interface WebhookPayload {
  event: string;
  data: {
    key: {
      remoteJid: string;
      fromMe: boolean;
      id: string;
    };
    pushName?: string;
    message?: any;
    messageTimestamp?: number;
    pushName?: string;
  };
  instanceName?: string;
}

async function saveMessageToSupabase(message: any) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    return;
  }

  const instanceName = message.instanceName || 'unknown';
  const phoneNumber = message.phoneNumber?.replace('@s.whatsapp.net', '').replace('@g.us', '') || '';
  const fromMe = message.fromMe || false;
  const content = message.content || '';
  const messageId = message.messageId || '';
  const timestamp = message.timestamp ? new Date(message.timestamp * 1000).toISOString() : new Date().toISOString();
  const messageType = message.messageType || 'text';

  // Try to get fromMe from the message data
  let isFromMe = fromMe;
  if (message.data?.key?.fromMe !== undefined) {
    isFromMe = message.data.key.fromMe;
  }

  // Get phone number
  let contactPhone = phoneNumber;
  if (message.data?.key?.remoteJid) {
    contactPhone = message.data.key.remoteJid.replace('@s.whatsapp.net', '').replace('@g.us', '');
  }

  // Get message content
  let messageContent = content;
  const msgData = message.data?.message || message.message || {};
  if (msgData.conversation) {
    messageContent = msgData.conversation;
  } else if (msgData.extendedTextMessage?.text) {
    messageContent = msgData.extendedTextMessage.text;
  } else if (msgData.imageMessage?.caption) {
    messageContent = msgData.imageMessage.caption;
  } else if (msgData.videoMessage?.caption) {
    messageContent = msgData.videoMessage.caption;
  }

  // Get timestamp
  let messageTimestamp = timestamp;
  if (message.data?.messageTimestamp) {
    messageTimestamp = new Date(message.data.messageTimestamp * 1000).toISOString();
  }

  // Get contact name
  const contactName = message.data?.pushName || message.pushName || '';

  // Get media URL if present
  let mediaUrl = '';
  if (msgData.imageMessage?.url) {
    mediaUrl = msgData.imageMessage.url;
  } else if (msgData.videoMessage?.url) {
    mediaUrl = msgData.videoMessage.url;
  } else if (msgData.audioMessage?.url) {
    mediaUrl = msgData.audioMessage.url;
  } else if (msgData.documentMessage?.url) {
    mediaUrl = msgData.documentMessage.url;
  }

  // Determine message type
  let msgType = 'text';
  if (msgData.imageMessage) msgType = 'image';
  else if (msgData.videoMessage) msgType = 'video';
  else if (msgData.audioMessage) msgType = 'audio';
  else if (msgData.documentMessage) msgType = 'document';

  try {
    // First, upsert conversation
    const { data: convData, error: convError } = await fetch(`${supabaseUrl}/rest/v1/conversations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Prefer': 'resolution=merge-duplicates',
      },
      body: JSON.stringify({
        instance_name: instanceName,
        phone_number: contactPhone,
        contact_name: contactName || null,
        last_message_at: messageTimestamp,
        last_message_preview: messageContent?.substring(0, 100) || '',
        updated_at: messageTimestamp,
      }),
    });

    if (convError) {
      console.error('Error upserting conversation:', convError);
    }

    // Get conversation ID
    const { data: convId } = await fetch(
      `${supabaseUrl}/rest/v1/conversations?instance_name=eq.${instanceName}&phone_number=eq.${contactPhone}&select=id`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      }
    ).then(r => r.json());

    const conversationId = convId?.[0]?.id;

    if (conversationId) {
      // Save message
      await fetch(`${supabaseUrl}/rest/v1/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({
          conversation_id: conversationId,
          instance_name: instanceName,
          message_id: messageId,
          from_me: isFromMe,
          phone_number: contactPhone,
          content: messageContent,
          message_type: msgType,
          media_url: mediaUrl || null,
          media_caption: msgData.imageMessage?.caption || msgData.videoMessage?.caption || null,
          timestamp: messageTimestamp,
        }),
      });
    }

    console.log('Message saved successfully:', { instanceName, contactPhone, fromMe: isFromMe });
  } catch (error) {
    console.error('Error saving message:', error);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Receive webhook payload
    const payload: WebhookPayload = await req.json();
    
    console.log('Webhook received:', JSON.stringify(payload, null, 2));

    // Handle different events
    switch (payload.event) {
      case 'MESSAGES_UPSERT':
        // Save received message
        await saveMessageToSupabase({
          ...payload,
          phoneNumber: payload.data?.key?.remoteJid?.replace('@s.whatsapp.net', '').replace('@g.us', ''),
          fromMe: payload.data?.key?.fromMe || false,
          messageId: payload.data?.key?.id || '',
          instanceName: payload.instanceName,
        });
        break;

      case 'CONNECTION_UPDATE':
        console.log('Connection update:', JSON.stringify(payload.data));
        break;

      case 'MESSAGES_UPDATE':
        console.log('Message update:', JSON.stringify(payload.data));
        break;

      default:
        console.log('Unknown event:', payload.event);
    }

    return jsonResponse({ success: true, received: true });
  } catch (error: any) {
    console.error('Webhook error:', error);
    return jsonResponse({ error: error.message }, 500);
  }
});