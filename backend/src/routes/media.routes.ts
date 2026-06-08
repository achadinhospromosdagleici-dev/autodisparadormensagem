import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';

export function mediaRoutes(prisma: PrismaClient) {
  return async function (app: FastifyInstance) {
    app.get('/library', async (request) => {
      const userId = (request as any).user.sub;
      const { type } = request.query as any;
      const where: any = { userId };
      if (type) where.mediaType = type;
      return prisma.mediaLibrary.findMany({ where, orderBy: { createdAt: 'desc' } });
    });

    app.post('/library', async (request) => {
      const userId = (request as any).user.sub;
      const data = request.body as any;
      return prisma.mediaLibrary.create({ data: { userId, ...data } });
    });

    app.delete('/library/:id', async (request) => {
      const userId = (request as any).user.sub;
      const { id } = request.params as any;
      await prisma.mediaLibrary.delete({ where: { id, userId } }).catch(() => {});
      return { success: true };
    });

    app.get('/stickers', async (request) => {
      const userId = (request as any).user.sub;
      return prisma.sticker.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
    });

    app.post('/stickers', async (request) => {
      const userId = (request as any).user.sub;
      const data = request.body as any;
      return prisma.sticker.create({ data: { userId, ...data } });
    });

    app.delete('/stickers/:id', async (request) => {
      const userId = (request as any).user.sub;
      const { id } = request.params as any;
      await prisma.sticker.delete({ where: { id, userId } }).catch(() => {});
      return { success: true };
    });
  };
}
