import { Module } from '@nestjs/common';
import { RedisRateLimitService } from './redis-rate-limit.service';

@Module({
  providers: [RedisRateLimitService],
  exports: [RedisRateLimitService],
})
export class RateLimitModule {}
