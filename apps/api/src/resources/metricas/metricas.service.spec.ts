import { Test, TestingModule } from '@nestjs/testing';
import { MetricasService } from './metricas.service';

describe('MetricasService', () => {
  let service: MetricasService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MetricasService],
    }).compile();

    service = module.get<MetricasService>(MetricasService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
