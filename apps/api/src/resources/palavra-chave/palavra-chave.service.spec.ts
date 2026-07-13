import { Test, TestingModule } from '@nestjs/testing';
import { PalavraChaveService } from './palavra-chave.service';

describe('PalavraChaveService', () => {
  let service: PalavraChaveService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PalavraChaveService],
    }).compile();

    service = module.get<PalavraChaveService>(PalavraChaveService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
