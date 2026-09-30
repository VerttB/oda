import { Test, TestingModule } from '@nestjs/testing';
import { MetricasController } from './metricas.controller';
import { MetricasService } from './metricas.service';

describe('MetricasController', () => {
  let controller: MetricasController;
  const metricasServiceMock = {
    findAll: jest.fn(),
    findMetricasGruposPesquisa: jest.fn(),
    findMetricasPesquisadores: jest.fn(),
    findMetricasAreasConhecimento: jest.fn(),
    findMetricasProducoes: jest.fn(),
    findMetricasInstituicoes: jest.fn(),
    findMetricasDiarias: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MetricasController],
      providers: [
        {
          provide: MetricasService,
          useValue: metricasServiceMock,
        },
      ],
    }).compile();

    controller = module.get<MetricasController>(MetricasController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findMetricasDiarias', () => {
    it('chama service.findMetricasDiarias sem parâmetros', async () => {
      const mockResult = { gruposPesquisa: [] };
      metricasServiceMock.findMetricasDiarias.mockResolvedValue(mockResult);

      const result = await controller.findMetricasDiarias({});

      expect(metricasServiceMock.findMetricasDiarias).toHaveBeenCalledWith({});
      expect(result).toEqual(mockResult);
    });

    it('passa query params para o service', async () => {
      const mockResult = { gruposPesquisa: [] };
      metricasServiceMock.findMetricasDiarias.mockResolvedValue(mockResult);

      const query = {
        dataInicio: '2025-01-01',
        dataFim: '2025-12-31',
        entidade: 'grupo_pesquisa',
      };

      const result = await controller.findMetricasDiarias(query);

      expect(metricasServiceMock.findMetricasDiarias).toHaveBeenCalledWith(query);
      expect(result).toEqual(mockResult);
    });

    it('passa múltiplas entidades como array', async () => {
      const mockResult = { gruposPesquisa: [], pesquisadores: [] };
      metricasServiceMock.findMetricasDiarias.mockResolvedValue(mockResult);

      const query = {
        entidade: ['grupo_pesquisa', 'pesquisador'],
      };

      const result = await controller.findMetricasDiarias(query);

      expect(metricasServiceMock.findMetricasDiarias).toHaveBeenCalledWith(query);
      expect(result).toEqual(mockResult);
    });
  });
});
