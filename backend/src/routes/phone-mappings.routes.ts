import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';

export function phoneMappingsRoutes(prisma: PrismaClient) {
  return async function (app: FastifyInstance) {
    app.get('/', async (request) => {
      const userId = (request as any).user.sub;
      return prisma.phoneMapping.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
    });

    app.post('/', async (request) => {
      const userId = (request as any).user.sub;
      const { original_phone, mapped_phone } = request.body as any;
      return prisma.phoneMapping.upsert({
        where: { userId_originalPhone: { userId, originalPhone: original_phone } },
        update: { mappedPhone: mapped_phone },
        create: { userId, originalPhone: original_phone, mappedPhone: mapped_phone },
      });
    });

    app.delete('/:id', async (request) => {
      const userId = (request as any).user.sub;
      const { id } = request.params as any;
      await prisma.phoneMapping.deleteMany({ where: { id, userId } });
      return { success: true };
    });
  };
}
