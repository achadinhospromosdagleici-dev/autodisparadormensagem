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
      const data = await res.json();
      return data;
    } catch (error: any) {
      return reply.status(502).send({ error: error.message });
    }
  });
}
