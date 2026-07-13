import { Module } from '@nestjs/common';
import { GruposPesquisaService } from './grupos-pesquisa.service';
import { GruposPesquisaController } from './grupos-pesquisa.controller';

@Module({
  controllers: [GruposPesquisaController],
  providers: [GruposPesquisaService],
})
export class GruposPesquisaModule {}
