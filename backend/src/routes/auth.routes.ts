import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { hashPassword, comparePassword } from '../lib/password.js';
import { signToken } from '../lib/jwt.js';

export function authRoutes(prisma: PrismaClient) {
  return async function (app: FastifyInstance) {
    app.post('/register', async (request, reply) => {
      const { email, password, fullName } = request.body as { email: string; password: string; fullName?: string };

      if (!email || !password) {
        return reply.status(400).send({ error: 'Email and password are required' });
      }

      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        return reply.status(409).send({ error: 'Email already registered' });
      }

      const passwordHash = await hashPassword(password);
      const userCount = await prisma.user.count();
      const isFirstUser = userCount === 0;

      const user = await prisma.user.create({
        data: {
          email,
          passwordHash,
          profile: {
            create: {
              email,
              fullName,
              ...(isFirstUser
                ? {}
                : { trialStartedAt: new Date(), trialEndsAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) }),
            },
          },
          roles: { create: { role: isFirstUser ? 'SUPERADMIN' : 'USER' } },
        },
        include: { profile: true, roles: true },
      });

      const getRole = (roles: { role: string }[]) => roles.find(r => r.role === 'SUPERADMIN')?.role || roles[0]?.role || 'USER';

      const token = signToken({ sub: user.id, email: user.email, role: getRole(user.roles) });
      return {
        token,
        user: {
          id: user.id,
          email: user.email,
          fullName: user.profile?.fullName,
          role: getRole(user.roles),
        },
      };
    });

    app.post('/login', async (request, reply) => {
      const { email, password } = request.body as { email: string; password: string };

      if (!email || !password) {
        return reply.status(400).send({ error: 'Email and password are required' });
      }

      const user = await prisma.user.findUnique({
        where: { email },
        include: { profile: true, roles: true },
      });
      if (!user) {
        return reply.status(401).send({ error: 'Invalid credentials' });
      }

      const valid = await comparePassword(password, user.passwordHash);
      if (!valid) {
        return reply.status(401).send({ error: 'Invalid credentials' });
      }

      const getRole = (roles: { role: string }[]) => roles.find(r => r.role === 'SUPERADMIN')?.role || roles[0]?.role || 'USER';

      const token = signToken({ sub: user.id, email: user.email, role: getRole(user.roles) });
      return {
        token,
        user: {
          id: user.id,
          email: user.email,
          fullName: user.profile?.fullName,
          role: getRole(user.roles),
          isActive: user.profile?.isActive,
          trialEndsAt: user.profile?.trialEndsAt,
        },
      };
    });

    app.get('/me', async (request, reply) => {
      const authHeader = request.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      try {
        const decoded = request.server.jwt.decode(authHeader.slice(7)) as any;
        const user = await prisma.user.findUnique({
          where: { id: decoded.sub },
          include: { profile: true, roles: true },
        });
        if (!user) {
          return reply.status(404).send({ error: 'User not found' });
        }
        const getRole = (roles: { role: string }[]) => roles.find(r => r.role === 'SUPERADMIN')?.role || roles[0]?.role || 'USER';
        return {
          id: user.id,
          email: user.email,
          fullName: user.profile?.fullName,
          role: getRole(user.roles),
          isActive: user.profile?.isActive,
          trialEndsAt: user.profile?.trialEndsAt,
        };
      } catch {
        return reply.status(401).send({ error: 'Invalid token' });
      }
    });
  };
}
