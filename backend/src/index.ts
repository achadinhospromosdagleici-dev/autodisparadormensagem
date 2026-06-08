import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import multipart from '@fastify/multipart';
import { PrismaClient } from '@prisma/client';
import { env } from './config/env.js';
import { authRoutes } from './routes/auth.routes.js';
import { proxyRoutes } from './routes/proxy/index.js';
import { webhookRoutes } from './routes/webhook.routes.js';
import { settingsRoutes } from './routes/settings.routes.js';
import { instancesRoutes } from './routes/instances.routes.js';
import { messagesRoutes } from './routes/messages.routes.js';
import { mediaRoutes } from './routes/media.routes.js';
import { adminRoutes } from './routes/admin.routes.js';

const prisma = new PrismaClient();

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });
await app.register(jwt, { secret: env.JWT_SECRET });
await app.register(multipart, { limits: { fileSize: 50 * 1024 * 1024 } });

app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

await app.register(authRoutes(prisma), { prefix: '/api/auth' });
await app.register(webhookRoutes(prisma), { prefix: '/api/webhook' });

await app.register(async function (protectedRoutes) {
  protectedRoutes.addHook('preValidation', async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch {
      reply.status(401).send({ error: 'Unauthorized' });
    }
  });

  await protectedRoutes.register(proxyRoutes, { prefix: '/api/proxy' });
  await protectedRoutes.register(settingsRoutes(prisma), { prefix: '/api/settings' });
  await protectedRoutes.register(instancesRoutes(prisma), { prefix: '/api/instances' });
  await protectedRoutes.register(messagesRoutes(prisma), { prefix: '/api/messages' });
  await protectedRoutes.register(mediaRoutes(prisma), { prefix: '/api/media' });
  await protectedRoutes.register(adminRoutes(prisma), { prefix: '/api/admin' });
});

const start = async () => {
  try {
    await prisma.$connect();
    app.log.info('Database connected');
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
    await app.close();
    process.exit(0);
  });
});

start();
