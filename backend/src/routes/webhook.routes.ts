import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';

export function webhookRoutes(prisma: PrismaClient) {
  return async function (app: FastifyInstance) {
    async function resolveUserId(instanceName: string): Promise<string | null> {
      const inst = await prisma.userInstance.findFirst({
        where: { instanceName },
        orderBy: { updatedAt: 'desc' },
        select: { userId: true },
      });
      return inst?.userId || null;
    }

    app.post('/receiver', async (request, reply) => {
      const { event, data, instanceName } = request.body as any;
      const instName = (instanceName || '') as string;

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

        const userId = await resolveUserId(instName);

        await prisma.conversation.upsert({
          where: { instanceName_phoneNumber: { instanceName: instName, phoneNumber } },
          update: { lastMessageAt: new Date(), lastMessagePreview: content.slice(0, 100), unreadCount: { increment: fromMe ? 0 : 1 }, contactName: pushName || undefined, userId: userId || undefined },
          create: { instanceName: instName, phoneNumber, contactName: pushName, lastMessageAt: new Date(), lastMessagePreview: content.slice(0, 100), userId: userId || undefined },
        });

        const conversation = await prisma.conversation.findUnique({
          where: { instanceName_phoneNumber: { instanceName: instName, phoneNumber } },
        });

        if (conversation) {
          await prisma.message.create({
            data: { conversationId: conversation.id, instanceName: instName, messageId: msgId, fromMe, phoneNumber, content, messageType: msgType, mediaUrl, mediaCaption: caption, timestamp: messageTimestamp || undefined, userId: userId || undefined },
          });
        }
      }

      if (event === 'CONNECTION_UPDATE') {
        const { instanceName: inst, state } = data || {};
        if (inst) {
          const instName2 = inst as string;
          const userId = await resolveUserId(instName2);
          const where: any = { instanceName: instName2 };
          if (userId) where.userId = userId;
          await prisma.userInstance.updateMany({
            where,
            data: { status: state === 'open' ? 'CONNECTED' : state === 'close' ? 'DISCONNECTED' : 'CONNECTING' },
          });
        }
      }

      return { success: true, received: true };
    });
  };
}
