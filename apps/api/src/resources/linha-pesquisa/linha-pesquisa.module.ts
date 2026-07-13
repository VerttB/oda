import { Module } from '@nestjs/common';
import { LinhaPesquisaService } from './linha-pesquisa.service';
import { LinhaPesquisaController } from './linha-pesquisa.controller';

@Module({
  controllers: [LinhaPesquisaController],
  providers: [LinhaPesquisaService],
})
export class LinhaPesquisaModule {}
