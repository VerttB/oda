import { Test, TestingModule } from '@nestjs/testing';
import { PesquisadoresController } from './pesquisadores.controller';
import { PesquisadoresService } from './pesquisadores.service';

describe('PesquisadoresController', () => {
  let controller: PesquisadoresController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PesquisadoresController],
      providers: [PesquisadoresService],
    }).compile();

    controller = module.get<PesquisadoresController>(PesquisadoresController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
