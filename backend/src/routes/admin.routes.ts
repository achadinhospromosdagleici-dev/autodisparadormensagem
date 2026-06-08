import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';

export function adminRoutes(prisma: PrismaClient) {
  return async function (app: FastifyInstance) {
    app.addHook('preValidation', async (request, reply) => {
      const user = (request as any).user;
      if (user.role !== 'SUPERADMIN') {
        return reply.status(403).send({ error: 'Forbidden' });
      }
    });

    app.get('/users', async () => {
      return prisma.user.findMany({ include: { profile: true, roles: true }, orderBy: { createdAt: 'desc' } });
    });

    app.put('/users/:id/trial', async (request) => {
      const { id } = request.params as any;
      const { trialEndsAt } = request.body as any;
      return prisma.profile.update({ where: { userId: id }, data: { trialEndsAt: new Date(trialEndsAt) } });
    });

    app.get('/settings', async () => {
      return prisma.systemSetting.findMany();
    });

    app.post('/settings', async (request) => {
      const { key, value } = request.body as any;
      return prisma.systemSetting.upsert({ where: { key }, update: { value }, create: { key, value } });
    });
  };
}
