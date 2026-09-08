import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@/prisma/prisma.service';
import { MetricasService } from './metricas.service';

describe('MetricasService', () => {
  let service: MetricasService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MetricasService,
        {
          provide: PrismaService,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<MetricasService>(MetricasService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('agrega todas as categorias de metricas no resumo geral', async () => {
    jest.spyOn(service, 'findMetricasGruposPesquisa').mockResolvedValue({ total: 1 } as never);
    jest.spyOn(service, 'findMetricasPesquisadores').mockResolvedValue({ totalPesquisadores: 2 } as never);
    jest.spyOn(service, 'findMetricasAreasConhecimento').mockResolvedValue({ total: 3 } as never);
    jest.spyOn(service, 'findMetricasProducoes').mockResolvedValue({ total: 4 } as never);
    jest.spyOn(service, 'findMetricasInstituicoes').mockResolvedValue({ total: 5 } as never);
    jest.spyOn(service, 'findMetricasFilasExtracao').mockResolvedValue({
      gruposPesquisa: { comErro: 0, porStatus: [] },
      pesquisadores: { comErro: 0, porStatus: [] },
    } as never);

    await expect(service.findAll()).resolves.toEqual({
      gruposDePesquisa: { total: 1 },
      pesquisadores: { totalPesquisadores: 2 },
      areasConhecimento: { total: 3 },
      producoes: { total: 4 },
      instituicoes: { total: 5 },
      filasExtracao: {
        gruposPesquisa: { comErro: 0, porStatus: [] },
        pesquisadores: { comErro: 0, porStatus: [] },
      },
    });
  });
});
