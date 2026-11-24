import { Module } from '@nestjs/common';
import { GruposPesquisaService } from './grupos-pesquisa.service';
import { GruposPesquisaController } from './grupos-pesquisa.controller';
import { LangchainGatewayModule } from '../langchain/langchain.module';

import { PesquisadoresModule } from '../pesquisadores/pesquisadores.module';
import { MetricasModule } from '../metricas/metricas.module';
import { AuthModule } from '../auth/auth.module';
import { RateLimitModule } from '@/common/rate-limit/rate-limit.module';
import { AiAccessGuard } from '@/common/rate-limit/ai-access.guard';
import { ProducoesConfirmadasController, RevisaoProducoesGrupoController } from './producoes-grupo.controller';
import { ProducoesGrupoService } from './producoes-grupo.service';

@Module({
  imports: [LangchainGatewayModule, PesquisadoresModule, MetricasModule, AuthModule, RateLimitModule],
  controllers: [GruposPesquisaController, ProducoesConfirmadasController, RevisaoProducoesGrupoController],
  providers: [GruposPesquisaService, ProducoesGrupoService, AiAccessGuard],
})
export class GruposPesquisaModule {}
