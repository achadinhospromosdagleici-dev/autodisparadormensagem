import { PrismaClient } from '@prisma/client';
import { campaignQueue } from '../queue/index.js';

export class CampaignService {
  constructor(private prisma: PrismaClient) {}

  async list(userId: string) {
    return (this.prisma as any).campaign.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { messages: true } } },
    });
  }

  async getById(userId: string, id: string) {
    return (this.prisma as any).campaign.findFirstOrThrow({
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
    const cfg = { delayBetween: 3000, maxRetries: 3, ...data.config };
    const campaign = await (this.prisma as any).campaign.create({
      data: {
        userId,
        name: data.name,
        status: data.scheduledAt ? 'SCHEDULED' : 'PENDING',
        totalContacts: data.contacts.length,
        config: cfg,
        scheduledAt: data.scheduledAt || null,
        messages: {
          create: data.contacts.map(c => ({
            contactPhone: c.phone,
            contactName: c.name || null,
            content: String(data.config.content || ''),
            messageType: String(data.config.messageType || 'TEXT'),
            mediaUrl: data.config.mediaUrl ? String(data.config.mediaUrl) : null,
            mediaCaption: data.config.mediaCaption ? String(data.config.mediaCaption) : null,
            mediaFilename: data.config.mediaFilename ? String(data.config.mediaFilename) : null,
            maxRetries: Number(cfg.maxRetries) || 3,
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
    return (this.prisma as any).campaign.update({
      where: { id },
      data: { status: 'RUNNING', startedAt: new Date() },
    });
  }

  async pause(userId: string, id: string) {
    await campaignQueue.remove(id);
    return (this.prisma as any).campaign.update({
      where: { id, userId },
      data: { status: 'PAUSED' },
    });
  }

  async resume(userId: string, id: string) {
    await campaignQueue.add(id, { campaignId: id }, { jobId: id });
    return (this.prisma as any).campaign.update({
      where: { id, userId },
      data: { status: 'RUNNING' },
    });
  }

  async cancel(userId: string, id: string) {
    await campaignQueue.remove(id);
    return (this.prisma as any).campaign.update({
      where: { id, userId },
      data: { status: 'CANCELLED' },
    });
  }

  async delete(userId: string, id: string) {
    await campaignQueue.remove(id);
    return (this.prisma as any).campaign.delete({ where: { id, userId } });
  }
}
