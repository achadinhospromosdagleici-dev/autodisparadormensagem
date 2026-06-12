import { FastifyInstance } from 'fastify';
import { PrismaClient, Prisma } from '@prisma/client';

function buildUserIdFilter(userId: string, view: string): string | null {
  if (view === 'all') return null;
  if (view?.startsWith('user:')) return view.replace('user:', '');
  return userId;
}

export function messagesRoutes(prisma: PrismaClient) {
  return async function (app: FastifyInstance) {
    app.get('/conversations', async (request) => {
      const { sub: userId, role } = (request as any).user;
      const { search, view } = request.query as any;
      const isSuper = role === 'SUPERADMIN';
      const effectiveView = isSuper ? view || 'mine' : 'mine';
      const filterUserId = buildUserIdFilter(userId, effectiveView);

      const where: any = {};
      if (filterUserId) where.userId = filterUserId;
      if (search) {
        where.OR = [
          { contactName: { contains: search, mode: 'insensitive' } },
          { phoneNumber: { contains: search } },
        ];
      }
      return prisma.conversation.findMany({ where, orderBy: { lastMessageAt: 'desc' }, take: 100 });
    });

    app.get('/conversations/:id', async (request, reply) => {
      const { sub: userId, role } = (request as any).user;
      const { id } = request.params as any;
      const { view } = request.query as any;
      const isSuper = role === 'SUPERADMIN';
      const effectiveView = isSuper ? view || 'mine' : 'mine';
      const filterUserId = buildUserIdFilter(userId, effectiveView);

      const where: any = { id };
      if (filterUserId) where.userId = filterUserId;
      const conversation = await prisma.conversation.findFirst({
        where,
        include: { messages: { orderBy: { createdAt: 'asc' } } },
      });
      if (!conversation) return reply.status(404).send({ error: 'Conversation not found' });
      return conversation;
    });

    app.get('/conversations/:id/messages', async (request, reply) => {
      const { sub: userId, role } = (request as any).user;
      const { id } = request.params as any;
      const { limit, offset, view } = request.query as any;
      const isSuper = role === 'SUPERADMIN';
      const effectiveView = isSuper ? view || 'mine' : 'mine';
      const filterUserId = buildUserIdFilter(userId, effectiveView);

      const convWhere: any = { id };
      if (filterUserId) convWhere.userId = filterUserId;
      const conv = await prisma.conversation.findFirst({ where: convWhere, select: { id: true } });
      if (!conv) return reply.status(404).send({ error: 'Conversation not found' });

      return prisma.message.findMany({
        where: { conversationId: id },
        orderBy: { createdAt: 'desc' },
        take: limit ? parseInt(limit) : 50,
        skip: offset ? parseInt(offset) : 0,
      });
    });

    app.put('/conversations/:id/read', async (request, reply) => {
      const { sub: userId, role } = (request as any).user;
      const { id } = request.params as any;
      const { view } = request.query as any;
      const isSuper = role === 'SUPERADMIN';
      const effectiveView = isSuper ? view || 'mine' : 'mine';
      const filterUserId = buildUserIdFilter(userId, effectiveView);

      const where: any = { id };
      if (filterUserId) where.userId = filterUserId;
      const conv = await prisma.conversation.findFirst({ where, select: { id: true } });
      if (!conv) return reply.status(404).send({ error: 'Conversation not found' });

      return prisma.conversation.update({ where: { id }, data: { unreadCount: 0 } });
    });

    app.get('/unread-count', async (request) => {
      const { sub: userId, role } = (request as any).user;
      const { view } = request.query as any;
      const isSuper = role === 'SUPERADMIN';
      const effectiveView = isSuper ? view || 'mine' : 'mine';
      const filterUserId = buildUserIdFilter(userId, effectiveView);

      const where: any = {};
      if (filterUserId) where.userId = filterUserId;
      const conversations = await prisma.conversation.findMany({ where, select: { unreadCount: true } });
      return { total: conversations.reduce((sum, c) => sum + c.unreadCount, 0) };
    });
  };
}
