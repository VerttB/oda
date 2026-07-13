import { ProducoesService } from './producoes.service';


jest.mock('@/prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}));
describe('ProducoesService', () => {
  let service: ProducoesService;
  let prismaService: any;
  let cacheManager: any;
  let tx: any;

  beforeEach(() => {
    tx = {
      producao: {
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        findUniqueOrThrow: jest.fn(),
      },
      producaoPesquisador: {
        createMany: jest.fn(),
        deleteMany: jest.fn(),
      },
      producaoPalavraChave: {
        createMany: jest.fn(),
        deleteMany: jest.fn(),
      },
    };

    prismaService = {
      $transaction: jest.fn(async (callback) => await callback(tx)),
      producao: {
        findMany: jest.fn(),
        findUniqueOrThrow: jest.fn(),
      },
    };

    cacheManager = {
      del: jest.fn(),
      wrap: jest.fn(),
    };

    service = new ProducoesService(prismaService, cacheManager);
  });

  it('creates producao and relation rows in a transaction', async () => {
    const producaoCriada = { id: 'producao-1', titulo: 'Artigo' };
    const producaoComRelacoes = {
      ...producaoCriada,
      autores: [],
      palavrasChave: [],
    };

    tx.producao.create.mockResolvedValue(producaoCriada);
    tx.producao.findUniqueOrThrow.mockResolvedValue(producaoComRelacoes);

    const result = await service.create({
      titulo: 'Artigo',
      autores: [{ pesquisadorId: 'pesquisador-1', ordemAutoria: 1 }],
      palavraChaveIds: ['palavra-1'],
    });

    expect(prismaService.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.producao.create).toHaveBeenCalledWith({
      data: { titulo: 'Artigo' },
    });
    expect(tx.producaoPesquisador.createMany).toHaveBeenCalledWith({
      data: [
        {
          producaoId: 'producao-1',
          pesquisadorId: 'pesquisador-1',
          ordemAutoria: 1,
        },
      ],
    });
    expect(tx.producaoPalavraChave.createMany).toHaveBeenCalledWith({
      data: [{ producaoId: 'producao-1', palavraChaveId: 'palavra-1' }],
    });
    expect(cacheManager.del).toHaveBeenCalledWith('producoes:list');
    expect(result).toBe(producaoComRelacoes);
  });

  it('uses cache wrapper when listing producoes', async () => {
    const producoes = [{ id: 'producao-1', titulo: 'Artigo' }];
    cacheManager.wrap.mockImplementation(async (_key: string, factory: () => any) =>
      await factory(),
    );
    prismaService.producao.findMany.mockResolvedValue(producoes);

    const result = await service.findAll();

    expect(cacheManager.wrap).toHaveBeenCalledWith(
      'producoes:list',
      expect.any(Function),
    );
    expect(prismaService.producao.findMany).toHaveBeenCalledWith({
      omit: {
        criadoEm: true,
        atualizadoEm: true,
      },
    });
    expect(result).toBe(producoes);
  });

  it('updates scalar fields and replaces provided relations in a transaction', async () => {
    const producaoAtualizada = {
      id: 'producao-1',
      titulo: 'Artigo atualizado',
      autores: [],
      palavrasChave: [],
    };

    tx.producao.findUniqueOrThrow.mockResolvedValue(producaoAtualizada);

    const result = await service.update('producao-1', {
      titulo: 'Artigo atualizado',
      autores: [{ pesquisadorId: 'pesquisador-1' }],
      palavraChaveIds: [],
    });

    expect(tx.producao.update).toHaveBeenCalledWith({
      where: { id: 'producao-1' },
      data: { titulo: 'Artigo atualizado' },
    });
    expect(tx.producaoPesquisador.deleteMany).toHaveBeenCalledWith({
      where: { producaoId: 'producao-1' },
    });
    expect(tx.producaoPesquisador.createMany).toHaveBeenCalledWith({
      data: [
        {
          producaoId: 'producao-1',
          pesquisadorId: 'pesquisador-1',
          ordemAutoria: undefined,
        },
      ],
    });
    expect(tx.producaoPalavraChave.deleteMany).toHaveBeenCalledWith({
      where: { producaoId: 'producao-1' },
    });
    expect(cacheManager.del).toHaveBeenCalledWith('producoes:list');
    expect(result).toBe(producaoAtualizada);
  });

  it('removes relation rows before deleting producao', async () => {
    const producaoRemovida = { id: 'producao-1', titulo: 'Artigo' };
    tx.producao.delete.mockResolvedValue(producaoRemovida);

    const result = await service.remove('producao-1');

    expect(tx.producaoPesquisador.deleteMany).toHaveBeenCalledWith({
      where: { producaoId: 'producao-1' },
    });
    expect(tx.producaoPalavraChave.deleteMany).toHaveBeenCalledWith({
      where: { producaoId: 'producao-1' },
    });
    expect(tx.producao.delete).toHaveBeenCalledWith({
      where: { id: 'producao-1' },
    });
    expect(result).toBe(producaoRemovida);
  });
});
