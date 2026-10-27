import { Module } from '@nestjs/common';
import { LinhaPesquisaService } from './linha-pesquisa.service';
import { LinhaPesquisaController } from './linha-pesquisa.controller';
import { LangchainGatewayModule } from '../langchain/langchain.module';
import { AuthModule } from '../auth/auth.module';
import { RateLimitModule } from '@/common/rate-limit/rate-limit.module';
import { AiAccessGuard } from '@/common/rate-limit/ai-access.guard';

@Module({
  imports: [LangchainGatewayModule, AuthModule, RateLimitModule],
  controllers: [LinhaPesquisaController],
  providers: [LinhaPesquisaService, AiAccessGuard],
})
export class LinhaPesquisaModule {}
