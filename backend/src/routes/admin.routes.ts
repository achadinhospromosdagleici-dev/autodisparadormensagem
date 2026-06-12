import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';

export function adminRoutes(prisma: PrismaClient) {
  return async function (app: FastifyInstance) {
    app.addHook('preValidation', async (request, reply) => {
      const decoded = (request as any).user;
      const userId = decoded?.sub;
      if (!userId) return reply.status(401).send({ error: 'Unauthorized' });
      const userRole = await prisma.userRole.findFirst({ where: { userId, role: 'SUPERADMIN' } });
      if (!userRole) {
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

    app.get('/system-settings/:key', async (request) => {
      const { key } = request.params as any;
      return prisma.systemSetting.findUnique({ where: { key } });
    });

    app.put('/system-settings/:key', async (request) => {
      const { key } = request.params as any;
      const { value } = request.body as any;
      return prisma.systemSetting.upsert({ where: { key }, update: { value }, create: { key, value } });
    });

    // ── Profile management ──

    app.get('/profiles', async () => {
      const profiles = await prisma.profile.findMany({
        include: { user: { select: { id: true, email: true, createdAt: true, roles: true } } },
        orderBy: { createdAt: 'desc' },
      });
      return profiles.map(p => ({
        id: p.id,
        userId: p.userId,
        email: p.user?.email || p.email,
        full_name: p.fullName,
        is_active: p.isActive,
        trial_started_at: p.trialStartedAt?.toISOString() || '',
        trial_ends_at: p.trialEndsAt?.toISOString() || '',
        notes: p.notes,
        created_at: p.createdAt.toISOString(),
        last_seen_at: p.lastSeenAt?.toISOString() || null,
        user: p.user ? { id: p.user.id, email: p.user.email, createdAt: p.user.createdAt.toISOString(), roles: p.user.roles } : undefined,
      }));
    });

    app.get('/user-roles', async () => {
      const roles = await prisma.userRole.findMany();
      return roles.map(r => ({ user_id: r.userId, role: r.role }));
    });

    app.put('/profiles/:id', async (request) => {
      const { id } = request.params as any;
      const body = request.body as any;
      const data: any = {};
      if (body.is_active !== undefined) data.isActive = body.is_active;
      if (body.trial_ends_at) data.trialEndsAt = new Date(body.trial_ends_at);
      if (body.trial_started_at) data.trialStartedAt = new Date(body.trial_started_at);
      if (body.notes !== undefined) data.notes = body.notes;
      if (body.full_name !== undefined) data.fullName = body.full_name;
      if (body.email !== undefined) data.email = body.email;
      return prisma.profile.update({ where: { id }, data });
    });

    app.delete('/profiles/:id', async (request, reply) => {
      const { id } = request.params as any;
      const profile = await prisma.profile.findUnique({ where: { id } });
      if (!profile) return reply.status(404).send({ error: 'Profile not found' });
      await prisma.user.delete({ where: { id: profile.userId } });
      return { success: true };
    });
  };
}
