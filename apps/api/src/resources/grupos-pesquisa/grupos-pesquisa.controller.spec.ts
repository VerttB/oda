import { Test, TestingModule } from '@nestjs/testing';
import { GruposPesquisaController } from './grupos-pesquisa.controller';
import { GruposPesquisaService } from './grupos-pesquisa.service';

describe('GruposPesquisaController', () => {
  let controller: GruposPesquisaController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GruposPesquisaController],
      providers: [GruposPesquisaService],
    }).compile();

    controller = module.get<GruposPesquisaController>(GruposPesquisaController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
