import { Module } from '@nestjs/common';
import { ProducoesService } from './producoes.service';
import { ProducoesController } from './producoes.controller';

@Module({
  controllers: [ProducoesController],
  providers: [ProducoesService],
})
export class ProducoesModule {}
