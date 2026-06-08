import { FastifyInstance } from 'fastify';

export async function linkRedirectRoutes(app: FastifyInstance) {
  app.post('/', async (request, reply) => {
    const { slug, referrer, utm_source, utm_medium, utm_campaign } = request.body as any;
    const prisma = (request.server as any).prisma || (await import('../../lib/prisma.js')).prisma;

    if (!slug) {
      return reply.status(400).send({ error: 'Slug is required' });
    }

    try {
      const shortLink = await prisma.shortLink.findUnique({ where: { slug } });
      if (!shortLink || !shortLink.isActive) {
        return reply.status(404).send({ error: 'Link not found or inactive' });
      }

      const ip = request.ip;

      let geo: any = {};
      try {
        const geoRes = await fetch(`https://ipapi.co/${ip}/json/`);
        if (geoRes.ok) geo = await geoRes.json();
      } catch {}

      await prisma.linkClick.create({
        data: {
          linkId: shortLink.id,
          ip,
          country: geo.country_name || null,
          countryCode: geo.country_code || null,
          city: geo.city || null,
          region: geo.region || null,
          device: (request.headers['user-agent'] || '').includes('Mobi') ? 'mobile' : 'desktop',
          referrer: referrer || null,
          utmSource: utm_source || null,
          utmMedium: utm_medium || null,
          utmCampaign: utm_campaign || null,
          userAgent: request.headers['user-agent'] || null,
        },
      });

      await prisma.shortLink.update({ where: { id: shortLink.id }, data: { clickCount: { increment: 1 } } });

      let waUrl = `https://wa.me/${shortLink.phone}`;
      if (shortLink.message) {
        waUrl += `?text=${encodeURIComponent(shortLink.message)}`;
      }

      return { url: waUrl };
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });
}
