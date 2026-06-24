import { Redis } from 'ioredis';

const redisUrl = process.env.REDIS_URL ?? `redis://${process.env.REDIS_HOST ?? 'localhost'}:${process.env.REDIS_PORT ?? '6379'}`;

let redis: Redis;

if (process.env.NODE_ENV === 'production') {
  redis = new Redis(redisUrl);
} else {
  if (!(global as any).redis) {
    (global as any).redis = new Redis(redisUrl);
  }
  redis = (global as any).redis;
}

export { redis };
export { Redis } from 'ioredis';
