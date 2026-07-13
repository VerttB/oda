import { Test, TestingModule } from '@nestjs/testing';
import { PesquisadoresService } from './pesquisadores.service';

describe('PesquisadoresService', () => {
  let service: PesquisadoresService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PesquisadoresService],
    }).compile();

    service = module.get<PesquisadoresService>(PesquisadoresService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
