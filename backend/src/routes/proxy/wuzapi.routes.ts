import { FastifyInstance } from 'fastify';

function normalizeUrl(url: string): string {
  if (!url) return url;
  return url.startsWith('http://') || url.startsWith('https://') ? url : `https://${url}`;
}

export async function wuzapiRoutes(app: FastifyInstance) {
  app.post('/', async (request, reply) => {
    const { baseUrl: rawBaseUrl, token, endpoint, method, body, isAdmin } = request.body as any;
    const baseUrl = normalizeUrl(rawBaseUrl);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (isAdmin) {
      headers['Authorization'] = `Bearer ${token}`;
    } else {
      headers['token'] = token;
    }

    try {
      const res = await fetch(`${baseUrl}/${endpoint}`, {
        method: method || 'GET',
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json();
      return data;
    } catch (error: any) {
      return reply.status(502).send({ error: error.message });
    }
  });
}
