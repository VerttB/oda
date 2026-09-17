import { Global, Module } from '@nestjs/common';
import { CacheModule as NestCacheModule } from '@nestjs/cache-manager';
import { ConfigService } from '@nestjs/config';
import { createClient, createKeyv } from '@keyv/redis';

@Global()
@Module({
  imports: [
    NestCacheModule.registerAsync({
      isGlobal: true,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const redisUrl =
          configService.get<string>('REDIS_URL') ??
          `redis://${configService.get<string>('REDIS_HOST', 'localhost')}:${configService.get<string>('REDIS_PORT', '6379')}`;

        const redis = createClient({
          url: redisUrl,
          disableOfflineQueue: true,
          socket: { connectTimeout: 1000, reconnectStrategy: () => false },
        });

        return {
          // Cache is optional: a Redis outage must not block database-backed routes.
          stores: [createKeyv(redis, { throwOnConnectError: false, connectionTimeout: 1000 })],
          ttl: 60 * 1000,
        };
      },
    }),
  ],
  exports: [NestCacheModule],
})
export class CacheModule {}
