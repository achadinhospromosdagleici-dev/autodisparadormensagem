import { PrismaClient, CampaignStatus } from '@prisma/client';
import { campaignQueue } from '../queue/index.js';

export class CampaignService {
  constructor(private prisma: PrismaClient) {}

  async list(userId: string) {
    return this.prisma.campaign.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { messages: true } } },
    });
  }

  async getById(userId: string, id: string) {
    return this.prisma.campaign.findFirstOrThrow({
      where: { id, userId },
      include: {
        messages: { orderBy: { createdAt: 'asc' }, take: 500 },
      },
    });
  }

  async create(userId: string, data: {
    name: string;
    config: Record<string, unknown>;
    contacts: { phone: string; name?: string }[];
    scheduledAt?: Date;
  }) {
    const config = { delayBetween: 3000, maxRetries: 3, ...data.config };
    const campaign = await this.prisma.campaign.create({
      data: {
        userId,
        name: data.name,
        status: data.scheduledAt ? 'SCHEDULED' : 'PENDING',
        totalContacts: data.contacts.length,
        config,
        scheduledAt: data.scheduledAt || null,
        messages: {
          create: data.contacts.map(c => ({
            contactPhone: c.phone,
            contactName: c.name || null,
            content: String(config.content || ''),
            messageType: String(config.messageType || 'TEXT'),
            maxRetries: Number(config.maxRetries) || 3,
          })),
        },
      },
      include: { messages: true },
    });

    if (!data.scheduledAt) {
      await this.start(campaign.id);
    }

    return campaign;
  }

  async start(id: string) {
    await campaignQueue.add(id, { campaignId: id }, { jobId: id });
    return this.prisma.campaign.update({
      where: { id },
      data: { status: 'RUNNING', startedAt: new Date() },
    });
  }

  async pause(userId: string, id: string) {
    await campaignQueue.remove(id);
    return this.prisma.campaign.update({
      where: { id, userId },
      data: { status: 'PAUSED' },
    });
  }

  async resume(userId: string, id: string) {
    await campaignQueue.add(id, { campaignId: id }, { jobId: id });
    return this.prisma.campaign.update({
      where: { id, userId },
      data: { status: 'RUNNING' },
    });
  }

  async cancel(userId: string, id: string) {
    await campaignQueue.remove(id);
    return this.prisma.campaign.update({
      where: { id, userId },
      data: { status: 'CANCELLED' },
    });
  }

  async delete(userId: string, id: string) {
    await campaignQueue.remove(id);
    return this.prisma.campaign.delete({ where: { id, userId } });
  }
}
