import type { ConnectionOptions } from 'bullmq';

export type QueueConnectionRole = 'producer' | 'worker';

export function createQueueConnection(role: QueueConnectionRole): ConnectionOptions {
  const redisUrl = process.env.REDIS_URL
    || `redis://${process.env.REDIS_HOST || '127.0.0.1'}:${process.env.REDIS_PORT || '6379'}`;
  const url = new URL(redisUrl);

  if (url.protocol !== 'redis:' && url.protocol !== 'rediss:') {
    throw new Error(`Protocolo Redis invalido: ${url.protocol}`);
  }

  const database = url.pathname.length > 1 ? Number(url.pathname.slice(1)) : 0;
  if (!Number.isInteger(database) || database < 0) {
    throw new Error(`Database Redis invalido em REDIS_URL: ${url.pathname}`);
  }

  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    username: url.username ? decodeURIComponent(url.username) : undefined,
    password: url.password ? decodeURIComponent(url.password) : undefined,
    db: database,
    maxRetriesPerRequest: role === 'worker' ? null : 1,
    ...(url.protocol === 'rediss:' ? { tls: {} } : {}),
  };
}
