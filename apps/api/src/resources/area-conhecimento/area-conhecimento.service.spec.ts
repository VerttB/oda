import { Test, TestingModule } from '@nestjs/testing';
import { AreaConhecimentoService } from './area-conhecimento.service';

describe('AreaConhecimentoService', () => {
  let service: AreaConhecimentoService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AreaConhecimentoService],
    }).compile();

    service = module.get<AreaConhecimentoService>(AreaConhecimentoService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
