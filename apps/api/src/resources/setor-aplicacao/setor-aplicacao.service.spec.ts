import { Test, TestingModule } from '@nestjs/testing';
import { SetorAplicacaoService } from './setor-aplicacao.service';

describe('SertorAplicacaoService', () => {
  let service: SetorAplicacaoService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SetorAplicacaoService],
    }).compile();

    service = module.get<SetorAplicacaoService>(SetorAplicacaoService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
