import { Module } from '@nestjs/common';
import { PesquisadoresService } from './pesquisadores.service';
import { PesquisadoresController } from './pesquisadores.controller';

@Module({
  controllers: [PesquisadoresController],
  providers: [PesquisadoresService],
})
export class PesquisadoresModule {}
