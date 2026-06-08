import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { CampaignService } from '../services/campaign.service.js';

export function campaignRoutes(prisma: PrismaClient) {
  const service = new CampaignService(prisma);

  return async function (app: FastifyInstance) {
    app.get('/', async (request) => {
      const { sub: userId } = request.user as any;
      return service.list(userId);
    });

    app.get('/:id', async (request) => {
      const { sub: userId } = request.user as any;
      const { id } = request.params as any;
      return service.getById(userId, id);
    });

    app.post('/', async (request, reply) => {
      const { sub: userId } = request.user as any;
      const body = request.body as any;
      const campaign = await service.create(userId, body);
      return reply.status(201).send(campaign);
    });

    app.post('/:id/pause', async (request) => {
      const { sub: userId } = request.user as any;
      const { id } = request.params as any;
      return service.pause(userId, id);
    });

    app.post('/:id/resume', async (request) => {
      const { sub: userId } = request.user as any;
      const { id } = request.params as any;
      return service.resume(userId, id);
    });

    app.post('/:id/cancel', async (request) => {
      const { sub: userId } = request.user as any;
      const { id } = request.params as any;
      return service.cancel(userId, id);
    });

    app.delete('/:id', async (request) => {
      const { sub: userId } = request.user as any;
      const { id } = request.params as any;
      return service.delete(userId, id);
    });
  };
}
