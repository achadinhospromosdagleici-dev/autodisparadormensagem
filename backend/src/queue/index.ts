import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { env } from '../config/env.js';

const connection = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

export const campaignQueue = new Queue('campaigns', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: 100,
    removeOnFail: 50,
  },
});

export function createWorker(processor: (job: Job) => Promise<void>) {
  return new Worker('campaigns', processor, {
    connection,
    concurrency: 1,
    limiter: { max: 1, duration: 1000 },
  });
}

export async function closeQueue() {
  await campaignQueue.close();
  await connection.quit();
}
