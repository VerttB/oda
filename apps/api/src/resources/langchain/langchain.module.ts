import { Module } from '@nestjs/common';
import { LangchainController } from './langchain.controller';
import { LangchainGatewayService } from './langchain.service';
import { AuthModule } from '../auth/auth.module';
import { RateLimitModule } from '@/common/rate-limit/rate-limit.module';
import { AiAccessGuard } from '@/common/rate-limit/ai-access.guard';

@Module({
  imports: [AuthModule, RateLimitModule],
  controllers: [LangchainController],
  providers: [LangchainGatewayService, AiAccessGuard],
  exports: [LangchainGatewayService],
})
export class LangchainGatewayModule {}
