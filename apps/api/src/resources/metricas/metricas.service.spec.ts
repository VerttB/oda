import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@/prisma/prisma.service';
import { MetricasService } from './metricas.service';
import { MetricasDiariasResponseSchema } from '@oda/shared-types';

describe('MetricasService', () => {
  let service: MetricasService;
  let prismaMock: any;

  const createService = async () => {
    prismaMock = {
      mvMetricasSistema: {
        findMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MetricasService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
      ],
    }).compile();

    return module.get<MetricasService>(MetricasService);
  };

  beforeEach(async () => {
    service = await createService();
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

  describe('Zod schema preprocess para data', () => {
    it('converte Date para DD-MM-YYYY', () => {
      const input = {
        gruposPesquisa: [
          { dataRegistro: new Date('2025-01-15T00:00:00.000Z'), novosNoDia: 5, totalAcumulado: 100 },
          { dataRegistro: new Date('2025-01-16T00:00:00.000Z'), novosNoDia: 3, totalAcumulado: 103 },
        ]
      };
      const result = MetricasDiariasResponseSchema.parse(input);
      expect(result.gruposPesquisa).toHaveLength(2);
      expect(result.gruposPesquisa[0].dataRegistro).toBe('15-01-2025');
      expect(result.gruposPesquisa[1].dataRegistro).toBe('16-01-2025');
    });

    it('mantém string já no formato DD-MM-YYYY', () => {
      const input = {
        gruposPesquisa: [
          { dataRegistro: '15-01-2025', novosNoDia: 5, totalAcumulado: 100 },
        ]
      };
      const result = MetricasDiariasResponseSchema.parse(input);
      expect(result.gruposPesquisa[0].dataRegistro).toBe('15-01-2025');
    });
  });

  describe('findMetricasDiarias', () => {
    const mockMetrics = [
      { entidade: 'grupo_pesquisa', dataRegistro: new Date('2025-01-15T00:00:00.000Z'), novosNoDia: 5, totalAcumulado: 100 },
      { entidade: 'grupo_pesquisa', dataRegistro: new Date('2025-01-16T00:00:00.000Z'), novosNoDia: 3, totalAcumulado: 103 },
      { entidade: 'pesquisador', dataRegistro: new Date('2025-01-15T00:00:00.000Z'), novosNoDia: 10, totalAcumulado: 500 },
      { entidade: 'area_conhecimento', dataRegistro: new Date('2025-01-15T00:00:00.000Z'), novosNoDia: 0, totalAcumulado: 50 },
    ];

    let testService: MetricasService;
    let testPrismaMock: any;

    beforeEach(async () => {
      testPrismaMock = {
        mvMetricasSistema: {
          findMany: jest.fn(),
        },
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          MetricasService,
          {
            provide: PrismaService,
            useValue: testPrismaMock,
          },
        ],
      }).compile();

      testService = module.get<MetricasService>(MetricasService);
    });

    const setupMock = (metrics = mockMetrics) => {
      testPrismaMock.mvMetricasSistema.findMany.mockResolvedValue(metrics);
    };

    it('retorna todas as métricas agrupadas por entidade sem filtros', async () => {
      setupMock();

      const result = await testService.findMetricasDiarias({});

      expect(testPrismaMock.mvMetricasSistema.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { dataRegistro: 'asc' },
      });

      expect(result.gruposPesquisa).toHaveLength(2);
      expect(result.gruposPesquisa[0]).toEqual({
        dataRegistro: '15-01-2025',
        novosNoDia: 5,
        totalAcumulado: 100,
      });
      expect(result.gruposPesquisa[1]).toEqual({
        dataRegistro: '16-01-2025',
        novosNoDia: 3,
        totalAcumulado: 103,
      });
      expect(result.pesquisadores).toHaveLength(1);
      expect(result.areasConhecimento).toHaveLength(1);
    });

    it('filtra por dataInicio e dataFim', async () => {
      setupMock();
      await testService.findMetricasDiarias({ dataInicio: '2025-01-16', dataFim: '2025-01-20' });

      expect(testPrismaMock.mvMetricasSistema.findMany).toHaveBeenCalledWith({
        where: {
          dataRegistro: {
            gte: new Date('2025-01-16'),
            lte: expect.any(Date),
          },
        },
        orderBy: { dataRegistro: 'asc' },
      });
    });

    it('filtra por entidade única', async () => {
      setupMock();
      await testService.findMetricasDiarias({ entidade: 'grupo_pesquisa' });

      expect(testPrismaMock.mvMetricasSistema.findMany).toHaveBeenCalledWith({
        where: {
          entidade: { equals: 'grupo_pesquisa' },
        },
        orderBy: { dataRegistro: 'asc' },
      });
    });

    it('filtra por múltiplas entidades', async () => {
      setupMock();
      await testService.findMetricasDiarias({ entidade: ['grupo_pesquisa', 'pesquisador'] });

      expect(testPrismaMock.mvMetricasSistema.findMany).toHaveBeenCalledWith({
        where: {
          entidade: { in: ['grupo_pesquisa', 'pesquisador'] },
        },
        orderBy: { dataRegistro: 'asc' },
      });
    });

    it('combina filtro de data e entidade', async () => {
      setupMock();
      await testService.findMetricasDiarias({
        dataInicio: '2025-01-01',
        dataFim: '2025-12-31',
        entidade: 'producoes',
      });

      expect(testPrismaMock.mvMetricasSistema.findMany).toHaveBeenCalledWith({
        where: {
          entidade: { equals: 'producoes' },
          dataRegistro: {
            gte: new Date('2025-01-01'),
            lte: expect.any(Date),
          },
        },
        orderBy: { dataRegistro: 'asc' },
      });
    });
  });
});
