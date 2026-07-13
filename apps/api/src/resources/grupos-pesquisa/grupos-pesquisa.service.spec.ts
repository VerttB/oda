import { Test, TestingModule } from '@nestjs/testing';
import { GruposPesquisaService } from './grupos-pesquisa.service';

describe('GruposPesquisaService', () => {
  let service: GruposPesquisaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GruposPesquisaService],
    }).compile();

    service = module.get<GruposPesquisaService>(GruposPesquisaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
