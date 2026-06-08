import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';

export function settingsRoutes(prisma: PrismaClient) {
  return async function (app: FastifyInstance) {
    app.get('/:provider', async (request) => {
      const userId = (request as any).user.sub;
      const { provider } = request.params as any;
      return prisma.apiSetting.findUnique({ where: { userId_provider: { userId, provider } } });
    });

    app.post('/:provider', async (request) => {
      const userId = (request as any).user.sub;
      const { provider } = request.params as any;
      const { settings } = request.body as any;
      return prisma.apiSetting.upsert({
        where: { userId_provider: { userId, provider } },
        update: { settings },
        create: { userId, provider, settings },
      });
    });

    app.delete('/:provider', async (request) => {
      const userId = (request as any).user.sub;
      const { provider } = request.params as any;
      await prisma.apiSetting.delete({ where: { userId_provider: { userId, provider } } }).catch(() => {});
      return { success: true };
    });

    app.get('/user/:key', async (request) => {
      const userId = (request as any).user.sub;
      const { key } = request.params as any;
      return prisma.userSetting.findUnique({ where: { userId_key: { userId, key } } });
    });

    app.post('/user/:key', async (request) => {
      const userId = (request as any).user.sub;
      const { key } = request.params as any;
      const { value } = request.body as any;
      return prisma.userSetting.upsert({
        where: { userId_key: { userId, key } },
        update: { value },
        create: { userId, key, value },
      });
    });

    app.delete('/user/:key', async (request) => {
      const userId = (request as any).user.sub;
      const { key } = request.params as any;
      await prisma.userSetting.delete({ where: { userId_key: { userId, key } } }).catch(() => {});
      return { success: true };
    });
  };
}
