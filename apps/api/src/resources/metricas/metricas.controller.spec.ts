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
});
