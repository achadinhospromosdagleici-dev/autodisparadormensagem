import { FastifyInstance } from 'fastify';

export async function placesProxyRoutes(app: FastifyInstance) {
  app.post('/', async (request, reply) => {
    const { keyword, maxResults = 20, apiKey } = request.body as any;

    if (!keyword || !apiKey) {
      return reply.status(400).send({ error: 'Keyword and apiKey are required' });
    }

    try {
      const textSearchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(keyword)}&key=${apiKey}&maxresults=${Math.min(maxResults, 60)}`;
      const searchRes = await fetch(textSearchUrl);
      const searchData = await searchRes.json() as any;

      const businesses: any[] = (searchData.results || []).slice(0, maxResults).map((place: any) => ({
        name: place.name,
        address: place.formatted_address,
        rating: place.rating,
        placeId: place.place_id,
        phone: null,
        website: null,
        cnpj: null,
        razaoSocial: null,
        cnae: null,
      }));

      for (const biz of businesses) {
        try {
          const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?placeid=${biz.placeId}&fields=formatted_phone_number,website&key=${apiKey}`;
          const detailsRes = await fetch(detailsUrl);
          const detailsData = await detailsRes.json() as any;
          if (detailsData.result) {
            biz.phone = detailsData.result.formatted_phone_number || null;
            biz.website = detailsData.result.website || null;
          }
        } catch {}
      }

      return { businesses, total: businesses.length };
    } catch (error: any) {
      return reply.status(502).send({ error: error.message });
    }
  });
}
