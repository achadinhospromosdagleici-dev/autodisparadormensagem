import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { normalizeUrl } from '../lib/url.js';

export function settingsRoutes(prisma: PrismaClient) {
  return async function (app: FastifyInstance) {
    async function getSharedSetting(key: string) {
      const setting = await prisma.systemSetting.findUnique({ where: { key } });
      return setting?.value || { enabled: false };
    }

    app.get('/evolution/shared', async () => getSharedSetting('evolution_shared'));
    app.get('/evolution-go/shared', async () => getSharedSetting('evolution_go_shared'));
    app.get('/unoapi/shared', async () => getSharedSetting('unoapi_shared'));
    app.get('/wuzapi/shared', async () => getSharedSetting('wuzapi_shared'));

    app.get('/wuzapi', async (request) => {
      const userId = (request as any).user.sub;
      return prisma.wuzapiSetting.findUnique({ where: { userId } });
    });

    app.post('/wuzapi', async (request) => {
      const userId = (request as any).user.sub;
      const { baseUrl, adminToken } = request.body as any;
      return prisma.wuzapiSetting.upsert({
        where: { userId },
        update: { baseUrl: normalizeUrl(baseUrl), adminToken },
        create: { userId, baseUrl: normalizeUrl(baseUrl), adminToken },
      });
    });

    app.delete('/wuzapi', async (request) => {
      const userId = (request as any).user.sub;
      await prisma.wuzapiSetting.delete({ where: { userId } }).catch(() => {});
      return { success: true };
    });

    app.get('/:provider', async (request) => {
      const userId = (request as any).user.sub;
      const { provider } = request.params as any;
      return prisma.apiSetting.findUnique({ where: { userId_provider: { userId, provider } } });
    });

    app.post('/:provider', async (request) => {
      const userId = (request as any).user.sub;
      const { provider } = request.params as any;
      const body = request.body as any;
      let settings = body.settings || body;
      if (settings.baseUrl) settings = { ...settings, baseUrl: normalizeUrl(settings.baseUrl) };
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
