import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';

export function wuzapiInstancesRoutes(prisma: PrismaClient) {
  return async function (app: FastifyInstance) {
    app.get('/', async (request) => {
      const userId = (request as any).user.sub;
      return prisma.wuzapiInstance.findMany({
        where: { userId },
        include: { setting: true },
        orderBy: { createdAt: 'desc' },
      });
    });

    app.get('/:id', async (request) => {
      const userId = (request as any).user.sub;
      const { id } = request.params as any;
      return prisma.wuzapiInstance.findFirst({ where: { id, userId } });
    });

    app.post('/', async (request) => {
      const userId = (request as any).user.sub;
      const { settingsId, userToken, name, phone, status } = request.body as any;
      return prisma.wuzapiInstance.create({
        data: { userId, settingsId, userToken, name, phone, status: status || 'DISCONNECTED' },
      });
    });

    app.put('/:id', async (request) => {
      const userId = (request as any).user.sub;
      const { id } = request.params as any;
      const { phone, name, status, userToken } = request.body as any;
      return prisma.wuzapiInstance.updateMany({
        where: { id, userId },
        data: { ...(phone !== undefined && { phone }), ...(name !== undefined && { name }), ...(status !== undefined && { status }), ...(userToken !== undefined && { userToken }) },
      });
    });

    app.delete('/:id', async (request) => {
      const userId = (request as any).user.sub;
      const { id } = request.params as any;
      await prisma.wuzapiInstance.deleteMany({ where: { id, userId } });
      return { success: true };
    });

    app.delete('/by-token', async (request) => {
      const userId = (request as any).user.sub;
      const { userToken } = request.body as any;
      await prisma.wuzapiInstance.deleteMany({ where: { userToken, userId } });
      return { success: true };
    });

    app.post('/full', async (request) => {
      const userId = (request as any).user.sub;
      const { userToken, phone, name, status } = request.body as any;

      const setting = await prisma.wuzapiSetting.findUnique({ where: { userId } });
      if (!setting) {
        return { error: 'WuzAPI settings not found' };
      }

      const instance = await prisma.wuzapiInstance.upsert({
        where: { settingsId_userToken: { settingsId: setting.id, userToken } },
        update: { phone, name, status: status || 'DISCONNECTED' },
        create: { userId, settingsId: setting.id, userToken, phone, name, status: status || 'DISCONNECTED' },
      });

      await prisma.userInstance.upsert({
        where: { userId_instanceName: { userId, instanceName: name } },
        update: { phone, status: status || 'DISCONNECTED', source: 'wuzapi' },
        create: { userId, instanceName: name, phone, status: status || 'DISCONNECTED', source: 'wuzapi' },
      });

      return instance;
    });
  };
}
