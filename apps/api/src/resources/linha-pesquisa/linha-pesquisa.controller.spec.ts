import { Test, TestingModule } from '@nestjs/testing';
import { LinhaPesquisaController } from './linha-pesquisa.controller';
import { LinhaPesquisaService } from './linha-pesquisa.service';

describe('LinhaPesquisaController', () => {
  let controller: LinhaPesquisaController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LinhaPesquisaController],
      providers: [LinhaPesquisaService],
    }).compile();

    controller = module.get<LinhaPesquisaController>(LinhaPesquisaController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
