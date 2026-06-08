import { FastifyInstance } from 'fastify';

export async function groupScraperRoutes(app: FastifyInstance) {
  app.post('/', async (request, reply) => {
    const { keyword } = request.body as { keyword: string };

    if (!keyword) {
      return reply.status(400).send({ error: 'Keyword is required' });
    }

    try {
      const groups: Array<{ name: string; link: string; source: string }> = [];

      const sources = [
        `https://www.gruposwhatsapp.com/search?q=${encodeURIComponent(keyword)}`,
        `https://gruposwhatsapp.net/?s=${encodeURIComponent(keyword)}`,
        `https://gruposwhatsapp.io/?s=${encodeURIComponent(keyword)}`,
      ];

      for (const url of sources) {
        try {
          const res = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
          });
          const html = await res.text();

          const linkRegex = /href="(https?:\/\/chat\.whatsapp\.com\/[^"]+)"/gi;
          const nameRegex = /<h[2-3][^>]*>([^<]+)<\/h[2-3]>/gi;
          const links: string[] = [];
          const names: string[] = [];

          let match;
          while ((match = linkRegex.exec(html)) !== null) {
            links.push(match[1]);
          }
          while ((match = nameRegex.exec(html)) !== null) {
            names.push(match[1].trim());
          }

          const sourceName = new URL(url).hostname;
          links.forEach((link, index) => {
            groups.push({ name: names[index] || `Grupo ${index + 1}`, link, source: sourceName });
          });
        } catch {}
      }

      return { groups, total: groups.length };
    } catch (error: any) {
      return reply.status(502).send({ error: error.message });
    }
  });
}
