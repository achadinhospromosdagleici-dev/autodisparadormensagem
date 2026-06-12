import { FastifyInstance } from 'fastify';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = path.resolve(__dirname, '../../../uploads');

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

export async function s3UploadRoutes(app: FastifyInstance) {
  app.post('/', async (request, reply) => {
    try {
      const data = await request.file();
      if (!data) {
        return reply.status(400).send({ error: 'File is required' });
      }

      const buffer = await data.toBuffer();
      const ext = path.extname(data.filename) || '.bin';
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
      const filePath = path.join(UPLOADS_DIR, fileName);

      await fs.promises.writeFile(filePath, buffer);

      const forwardedProto = request.headers['x-forwarded-proto'];
      const protocol = Array.isArray(forwardedProto) ? forwardedProto[0] : (forwardedProto || 'https');
      const host = request.headers['x-forwarded-host'] || request.headers.host || request.hostname;
      const baseUrl = `${protocol}://${host}`;
      const url = `${baseUrl}/api/uploads/${fileName}`;

      return { url, path: fileName, fileName: data.filename };
    } catch (error: any) {
      console.error(`[upload] error:`, error);
      return reply.status(500).send({ error: error.message });
    }
  });
}
