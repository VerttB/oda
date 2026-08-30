import { Test, TestingModule } from '@nestjs/testing';
import { MetricasController } from './metricas.controller';
import { MetricasService } from './metricas.service';

describe('MetricasController', () => {
  let controller: MetricasController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MetricasController],
      providers: [MetricasService],
    }).compile();

    controller = module.get<MetricasController>(MetricasController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
