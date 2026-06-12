import { FastifyInstance } from 'fastify';

export async function s3UploadRoutes(app: FastifyInstance) {
  app.post('/', async (request, reply) => {
    try {
      const data = await request.file();
      if (!data) {
        return reply.status(400).send({ error: 'File is required' });
      }

      const buffer = await data.toBuffer();
      const { endpoint, accessKey, secretKey, bucket, region } = request.body as any || {};

      const s3Endpoint = endpoint || process.env.S3_ENDPOINT || 'https://s3minio.bigcreditos.com.br';
      const s3AccessKey = accessKey || process.env.S3_ACCESS_KEY || '';
      const s3SecretKey = secretKey || process.env.S3_SECRET_KEY || '';
      const s3Bucket = bucket || process.env.S3_BUCKET || 'uploads';
      const s3Region = region || process.env.S3_REGION || 'us-east-1';

      if (!s3AccessKey || !s3SecretKey) {
        return reply.status(500).send({ error: 'S3 credentials not configured' });
      }

      const fileName = `${Date.now()}-${data.filename}`;
      const url = `${s3Endpoint}/${s3Bucket}/${fileName}`;

      const crypto = await import('node:crypto');
      const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
      const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
      const dateStr = amzDate.slice(0, 8);
      const host = new URL(s3Endpoint).host;

      const canonicalRequest = [
        'PUT',
        `/${s3Bucket}/${fileName}`,
        '',
        `host:${host}`,
        `x-amz-content-sha256:${sha256}`,
        `x-amz-date:${amzDate}`,
        '',
        'host;x-amz-content-sha256;x-amz-date',
        sha256,
      ].join('\n');

      const stringToSign = [
        'AWS4-HMAC-SHA256',
        amzDate,
        `${dateStr}/${s3Region}/s3/aws4_request`,
        crypto.createHash('sha256').update(canonicalRequest).digest('hex'),
      ].join('\n');

      const dateKey = crypto.createHmac('sha256', `AWS4${s3SecretKey}`).update(dateStr).digest();
      const regionKey = crypto.createHmac('sha256', dateKey).update(s3Region).digest();
      const serviceKey = crypto.createHmac('sha256', regionKey).update('s3').digest();
      const signingKey = crypto.createHmac('sha256', serviceKey).update('aws4_request').digest();
      const signature = crypto.createHmac('sha256', signingKey).update(stringToSign).digest('hex');

      const authorization = `AWS4-HMAC-SHA256 Credential=${s3AccessKey}/${dateStr}/${s3Region}/s3/aws4_request, SignedHeaders=host;x-amz-content-sha256;x-amz-date, Signature=${signature}`;

      const uploadRes = await fetch(url, {
        method: 'PUT',
        headers: {
          'x-amz-content-sha256': sha256,
          'x-amz-date': amzDate,
          Authorization: authorization,
          'Content-Type': data.mimetype || 'application/octet-stream',
        },
        body: new Uint8Array(buffer),
      });

      if (!uploadRes.ok) {
        const errText = await uploadRes.text().catch(() => '');
        console.error(`[s3-upload] PUT ${url} → ${uploadRes.status}: ${errText}`);
        return reply.status(502).send({ error: 'Upload failed', status: uploadRes.status, body: errText.slice(0, 300) });
      }

      return { url, path: fileName, fileName: data.filename };
    } catch (error: any) {
      console.error(`[s3-upload] error:`, error);
      return reply.status(500).send({ error: error.message });
    }
  });
}
