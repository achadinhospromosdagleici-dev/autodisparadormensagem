import { FastifyInstance } from 'fastify';
import { evolutionRoutes } from './evolution.routes.js';
import { evolutionGoRoutes } from './evolution-go.routes.js';
import { unoapiRoutes } from './unoapi.routes.js';
import { wuzapiRoutes } from './wuzapi.routes.js';
import { groupScraperRoutes } from './group-scraper.routes.js';
import { placesProxyRoutes } from './places-proxy.routes.js';
import { linkRedirectRoutes } from './link-redirect.routes.js';
import { s3UploadRoutes } from './s3-upload.routes.js';

export default async function proxyRoutes(app: FastifyInstance) {
  await app.register(evolutionRoutes, { prefix: '/evolution' });
  await app.register(evolutionGoRoutes, { prefix: '/evolution-go' });
  await app.register(unoapiRoutes, { prefix: '/unoapi' });
  await app.register(wuzapiRoutes, { prefix: '/wuzapi' });
  await app.register(groupScraperRoutes, { prefix: '/group-scraper' });
  await app.register(placesProxyRoutes, { prefix: '/places' });
  await app.register(linkRedirectRoutes, { prefix: '/link-redirect' });
  await app.register(s3UploadRoutes, { prefix: '/s3-upload' });
}
