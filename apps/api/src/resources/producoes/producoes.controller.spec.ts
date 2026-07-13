import { Test, TestingModule } from '@nestjs/testing';
import { ProducoesController } from './producoes.controller';
import { ProducoesService } from './producoes.service';

describe('ProducoesController', () => {
  let controller: ProducoesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProducoesController],
      providers: [ProducoesService],
    }).compile();

    controller = module.get<ProducoesController>(ProducoesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
