import { Module } from '@nestjs/common';
import { LangchainController } from './langchain.controller';
import { LangchainGatewayService } from './langchain.service';
import { AuthModule } from '../auth/auth.module';
import { RateLimitModule } from '@/common/rate-limit/rate-limit.module';
import { AiAccessGuard } from '@/common/rate-limit/ai-access.guard';
import { AiQueueClient } from '@oda/queue';

@Module({
  imports: [AuthModule, RateLimitModule],
  controllers: [LangchainController],
  providers: [
    LangchainGatewayService,
    AiAccessGuard,
    { provide: AiQueueClient, useFactory: () => new AiQueueClient() },
  ],
  exports: [LangchainGatewayService],
})
export class LangchainGatewayModule {}
