import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';

export function instancesRoutes(prisma: PrismaClient) {
  return async function (app: FastifyInstance) {
    app.get('/', async (request) => {
      const userId = (request as any).user.sub;
      return prisma.userInstance.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
    });

    app.post('/', async (request, reply) => {
      const userId = (request as any).user.sub;
      const { instanceName, phone, profileName, source } = request.body as any;
      const existing = await prisma.userInstance.findUnique({ where: { userId_instanceName: { userId, instanceName } } });
      if (existing) return reply.status(409).send({ error: 'Instance already exists' });
      return prisma.userInstance.create({ data: { userId, instanceName, phone, profileName, source: source || 'unoapi' } });
    });

    app.put('/:id', async (request) => {
      const userId = (request as any).user.sub;
      const { id } = request.params as any;
      const data = request.body as any;
      return prisma.userInstance.update({ where: { id, userId }, data });
    });

    app.delete('/:id', async (request) => {
      const userId = (request as any).user.sub;
      const { id } = request.params as any;
      await prisma.userInstance.delete({ where: { id, userId } });
      return { success: true };
    });
  };
}
