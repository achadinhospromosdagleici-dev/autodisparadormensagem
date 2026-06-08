import { FastifyInstance } from 'fastify';

import { normalizeUrl } from '../../lib/url.js';

export async function unoapiRoutes(app: FastifyInstance) {
  app.post('/', async (request, reply) => {
    const { baseUrl, token, endpoint, method, body } = request.body as any;

    try {
      const res = await fetch(`${normalizeUrl(baseUrl)}/${endpoint}`, {
        method: method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      const contentType = res.headers.get('content-type') || '';
      let data: any;
      if (contentType.includes('application/json')) {
        data = await res.json();
      } else {
        data = { text: await res.text() };
      }
      if (!res.ok) return reply.status(res.status).send({ error: data.error?.message || data.error || res.statusText });
      return data;
    } catch (error: any) {
      return reply.status(502).send({ error: error.message });
    }
  });
}
