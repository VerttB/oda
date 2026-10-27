import { Module } from '@nestjs/common';
import { ProducoesService } from './producoes.service';
import { ProducoesController } from './producoes.controller';
import { LangchainGatewayModule } from '../langchain/langchain.module';
import { AuthModule } from '../auth/auth.module';
import { RateLimitModule } from '@/common/rate-limit/rate-limit.module';
import { AiAccessGuard } from '@/common/rate-limit/ai-access.guard';

@Module({
  imports: [LangchainGatewayModule, AuthModule, RateLimitModule],
  controllers: [ProducoesController],
  providers: [ProducoesService, AiAccessGuard],
  exports: [ProducoesService],
})
export class ProducoesModule {}
