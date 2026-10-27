import { Module } from '@nestjs/common';
import { PesquisadoresService } from './pesquisadores.service';
import { PesquisadoresController } from './pesquisadores.controller';
import { LangchainGatewayModule } from '../langchain/langchain.module';
import { ProducoesModule } from '../producoes/producoes.module';
import { MetricasModule } from '../metricas/metricas.module';
import { AuthModule } from '../auth/auth.module';
import { RateLimitModule } from '@/common/rate-limit/rate-limit.module';
import { AiAccessGuard } from '@/common/rate-limit/ai-access.guard';

@Module({
  imports: [LangchainGatewayModule, ProducoesModule, MetricasModule, AuthModule, RateLimitModule],
  controllers: [PesquisadoresController],
  providers: [PesquisadoresService, AiAccessGuard],
  exports: [PesquisadoresService],
})
export class PesquisadoresModule {}
