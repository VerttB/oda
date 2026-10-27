import { Module } from '@nestjs/common';
import { GruposPesquisaService } from './grupos-pesquisa.service';
import { GruposPesquisaController } from './grupos-pesquisa.controller';
import { LangchainGatewayModule } from '../langchain/langchain.module';

import { PesquisadoresModule } from '../pesquisadores/pesquisadores.module';
import { MetricasModule } from '../metricas/metricas.module';
import { AuthModule } from '../auth/auth.module';
import { RateLimitModule } from '@/common/rate-limit/rate-limit.module';
import { AiAccessGuard } from '@/common/rate-limit/ai-access.guard';

@Module({
  imports: [LangchainGatewayModule, PesquisadoresModule, MetricasModule, AuthModule, RateLimitModule],
  controllers: [GruposPesquisaController],
  providers: [GruposPesquisaService, AiAccessGuard],
})
export class GruposPesquisaModule {}
