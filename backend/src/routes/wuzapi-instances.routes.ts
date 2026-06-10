import { FastifyInstance } from 'fastify';
import { PrismaClient, InstanceStatus } from '@prisma/client';

function toInstanceStatus(s?: string): InstanceStatus {
  const map: Record<string, InstanceStatus> = {
    connected: 'CONNECTED', disconnected: 'DISCONNECTED', connecting: 'CONNECTING', error: 'ERROR',
    CONNECTED: 'CONNECTED', DISCONNECTED: 'DISCONNECTED', CONNECTING: 'CONNECTING', ERROR: 'ERROR',
  };
  return (s ? map[s.toLowerCase()] : undefined) || 'DISCONNECTED';
}

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
        data: { userId, settingsId, userToken, name, phone, status: toInstanceStatus(status) },
      });
    });

    app.put('/:id', async (request) => {
      const userId = (request as any).user.sub;
      const { id } = request.params as any;
      const { phone, name, status, userToken } = request.body as any;
      const data: any = {};
      if (phone !== undefined) data.phone = phone;
      if (name !== undefined) data.name = name;
      if (status !== undefined) data.status = toInstanceStatus(status);
      if (userToken !== undefined) data.userToken = userToken;
      return prisma.wuzapiInstance.updateMany({ where: { id, userId }, data });
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

    app.get('/by-name/:name', async (request) => {
      const userId = (request as any).user.sub;
      const { name } = request.params as any;
      return prisma.wuzapiInstance.findFirst({ where: { name, userId }, include: { setting: true } });
    });

    app.get('/by-name/:name/credentials', async (request) => {
      const userId = (request as any).user.sub;
      const { name } = request.params as any;
      const instance = await prisma.wuzapiInstance.findFirst({
        where: { name, userId },
        include: { setting: true },
      });
      if (!instance) return { error: 'Instance not found' };
      return { baseUrl: instance.setting.baseUrl, userToken: instance.userToken };
    });

    app.post('/full', async (request) => {
      const userId = (request as any).user.sub;
      const { userToken, phone, name, status } = request.body as any;
      const normalizedStatus = toInstanceStatus(status);

      const setting = await prisma.wuzapiSetting.findUnique({ where: { userId } });
      if (!setting) {
        return { error: 'WuzAPI settings not found' };
      }

      const instance = await prisma.wuzapiInstance.upsert({
        where: { settingsId_userToken: { settingsId: setting.id, userToken } },
        update: { phone, name, status: normalizedStatus },
        create: { userId, settingsId: setting.id, userToken, phone, name, status: normalizedStatus },
      });

      await prisma.userInstance.upsert({
        where: { userId_instanceName: { userId, instanceName: name } },
        update: { phone, status: normalizedStatus, source: 'wuzapi' },
        create: { userId, instanceName: name, phone, status: normalizedStatus, source: 'wuzapi' },
      });

      return instance;
    });
  };
}
