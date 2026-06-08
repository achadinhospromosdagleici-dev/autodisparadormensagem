import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';

export function messagesRoutes(prisma: PrismaClient) {
  return async function (app: FastifyInstance) {
    app.get('/conversations', async (request) => {
      const { search } = request.query as any;
      const where: any = {};
      if (search) {
        where.OR = [
          { contactName: { contains: search, mode: 'insensitive' } },
          { phoneNumber: { contains: search } },
        ];
      }
      return prisma.conversation.findMany({ where, orderBy: { lastMessageAt: 'desc' }, take: 100 });
    });

    app.get('/conversations/:id', async (request) => {
      const { id } = request.params as any;
      return prisma.conversation.findUnique({ where: { id }, include: { messages: { orderBy: { createdAt: 'asc' } } } });
    });

    app.get('/conversations/:id/messages', async (request) => {
      const { id } = request.params as any;
      const { limit, offset } = request.query as any;
      return prisma.message.findMany({ where: { conversationId: id }, orderBy: { createdAt: 'desc' }, take: limit ? parseInt(limit) : 50, skip: offset ? parseInt(offset) : 0 });
    });

    app.put('/conversations/:id/read', async (request) => {
      const { id } = request.params as any;
      return prisma.conversation.update({ where: { id }, data: { unreadCount: 0 } });
    });

    app.get('/unread-count', async () => {
      const conversations = await prisma.conversation.findMany({ select: { unreadCount: true } });
      return { total: conversations.reduce((sum, c) => sum + c.unreadCount, 0) };
    });
  };
}
