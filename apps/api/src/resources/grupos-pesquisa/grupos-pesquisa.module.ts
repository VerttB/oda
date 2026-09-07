import { Module } from '@nestjs/common';
import { GruposPesquisaService } from './grupos-pesquisa.service';
import { GruposPesquisaController } from './grupos-pesquisa.controller';
import { LangchainGatewayModule } from '../langchain/langchain.module';

import { PesquisadoresModule } from '../pesquisadores/pesquisadores.module';
import { MetricasModule } from '../metricas/metricas.module';

@Module({
  imports: [LangchainGatewayModule, PesquisadoresModule, MetricasModule],
  controllers: [GruposPesquisaController],
  providers: [GruposPesquisaService],
})
export class GruposPesquisaModule {}
