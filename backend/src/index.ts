import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import multipart from '@fastify/multipart';
import { PrismaClient } from '@prisma/client';
import { env } from './config/env.js';
import { authRoutes } from './routes/auth.routes.js';
import proxyRoutes from './routes/proxy/index.js';
import { webhookRoutes } from './routes/webhook.routes.js';
import { settingsRoutes } from './routes/settings.routes.js';
import { instancesRoutes } from './routes/instances.routes.js';
import { messagesRoutes } from './routes/messages.routes.js';
import { mediaRoutes } from './routes/media.routes.js';
import { adminRoutes } from './routes/admin.routes.js';
import { campaignQueue, closeQueue } from './queue/index.js';
import { campaignRoutes } from './routes/campaign.routes.js';
import { wuzapiInstancesRoutes } from './routes/wuzapi-instances.routes.js';
import { phoneMappingsRoutes } from './routes/phone-mappings.routes.js';
import { startCampaignWorker } from './workers/campaign.worker.js';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const UPLOADS_DIR = resolve(__dirname, '../uploads');
const MIME_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.gif': 'image/gif', '.webp': 'image/webp', '.mp4': 'video/mp4',
  '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.pdf': 'application/pdf',
  '.doc': 'application/msword', '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

const prisma = new PrismaClient();

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });
await app.register(jwt, { secret: env.JWT_SECRET });
await app.register(multipart, { limits: { fileSize: 50 * 1024 * 1024 } });

app.get('/health', async () => {
  try {
    const redisClient = await campaignQueue.client;
    await (redisClient as any).ping();
    return { status: 'ok', timestamp: new Date().toISOString(), redis: 'connected' };
  } catch {
    return { status: 'ok', timestamp: new Date().toISOString(), redis: 'disconnected' };
  }
});

await app.register(authRoutes(prisma), { prefix: '/api/auth' });
await app.register(webhookRoutes(prisma), { prefix: '/api/webhook' });

app.get('/api/uploads/:file', async (request, reply) => {
  const { file } = request.params as any;
  const safeName = file.replace(/\.\./g, '').replace(/[<>"|?*]/g, '');
  const filePath = resolve(UPLOADS_DIR, safeName);
  if (!filePath.startsWith(UPLOADS_DIR) || !existsSync(filePath)) {
    return reply.status(404).send({ error: 'Not found' });
  }
  const ext = extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  const content = readFileSync(filePath);
  return reply.type(contentType).send(content);
});

await app.register(async function (protectedRoutes) {
  protectedRoutes.addHook('preValidation', async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch {
      reply.status(401).send({ error: 'Unauthorized' });
    }
  });

  protectedRoutes.addHook('preHandler', async (request, reply) => {
    const payload = request.user as any;
    if (payload.role !== 'SUPERADMIN') {
      const profile = await prisma.profile.findUnique({ where: { userId: payload.sub } });
      if (profile?.trialEndsAt && new Date() > profile.trialEndsAt) {
        return reply.status(403).send({ error: 'Trial expirado', code: 'TRIAL_EXPIRED' });
      }
    }
  });

  await protectedRoutes.register(proxyRoutes, { prefix: '/api/proxy' });
  await protectedRoutes.register(settingsRoutes(prisma), { prefix: '/api/settings' });
  await protectedRoutes.register(instancesRoutes(prisma), { prefix: '/api/instances' });
  await protectedRoutes.register(messagesRoutes(prisma), { prefix: '/api/messages' });
  await protectedRoutes.register(mediaRoutes(prisma), { prefix: '/api/media' });
  await protectedRoutes.register(adminRoutes(prisma), { prefix: '/api/admin' });
  await protectedRoutes.register(campaignRoutes(prisma), { prefix: '/api/campaigns' });
  await protectedRoutes.register(wuzapiInstancesRoutes(prisma), { prefix: '/api/wuzapi/instances' });
  await protectedRoutes.register(phoneMappingsRoutes(prisma), { prefix: '/api/phone-mappings' });
});

const start = async () => {
  try {
    await prisma.$connect();
    app.log.info('Database connected');

    const redisClient = await campaignQueue.client;
    await (redisClient as any).ping();
    app.log.info('Redis connected');

    const worker = startCampaignWorker();
    app.log.info('Campaign worker started');

    await app.listen({ port: env.PORT, host: '0.0.0.0' });
  } catch (err) {
    app.log.error(err);
    await prisma.$disconnect();
    process.exit(1);
  }
};

['SIGINT', 'SIGTERM'].forEach((signal) => {
  process.on(signal, async () => {
    await prisma.$disconnect();
    await closeQueue();
    await app.close();
    process.exit(0);
  });
});

start();
