import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';

export function webhookRoutes(prisma: PrismaClient) {
  return async function (app: FastifyInstance) {
    app.post('/receiver', async (request, reply) => {
      const { event, data, instanceName } = request.body as any;

      if (event === 'MESSAGES_UPSERT' || event === 'MESSAGES_UPDATE') {
        const { key, pushName, message, messageTimestamp } = data || {};
        const remoteJid = key?.remoteJid || '';
        const fromMe = key?.fromMe || false;
        const msgId = key?.id || '';
        const phoneNumber = remoteJid.replace(/[^0-9]/g, '');
        const content = message?.conversation || message?.extendedTextMessage?.text || '';
        const msgType = message?.imageMessage ? 'IMAGE' : message?.audioMessage ? 'AUDIO' : message?.videoMessage ? 'VIDEO' : message?.documentMessage ? 'DOCUMENT' : 'TEXT';
        const mediaUrl = message?.imageMessage?.url || message?.audioMessage?.url || message?.videoMessage?.url || message?.documentMessage?.url || null;
        const caption = message?.imageMessage?.caption || message?.videoMessage?.caption || null;

        await prisma.conversation.upsert({
          where: { instanceName_phoneNumber: { instanceName: instanceName || '', phoneNumber } },
          update: { lastMessageAt: new Date(), lastMessagePreview: content.slice(0, 100), unreadCount: { increment: fromMe ? 0 : 1 }, contactName: pushName || undefined },
          create: { instanceName: instanceName || '', phoneNumber, contactName: pushName, lastMessageAt: new Date(), lastMessagePreview: content.slice(0, 100) },
        });

        const conversation = await prisma.conversation.findUnique({
          where: { instanceName_phoneNumber: { instanceName: instanceName || '', phoneNumber } },
        });

        if (conversation) {
          await prisma.message.create({
            data: { conversationId: conversation.id, instanceName: instanceName || '', messageId: msgId, fromMe, phoneNumber, content, messageType: msgType, mediaUrl, mediaCaption: caption, timestamp: messageTimestamp || undefined },
          });
        }
      }

      if (event === 'CONNECTION_UPDATE') {
        const { instanceName: inst, state } = data || {};
        if (inst) {
          await prisma.userInstance.updateMany({
            where: { instanceName: inst },
            data: { status: state === 'open' ? 'CONNECTED' : state === 'close' ? 'DISCONNECTED' : 'CONNECTING' },
          });
        }
      }

      return { success: true, received: true };
    });
  };
}
