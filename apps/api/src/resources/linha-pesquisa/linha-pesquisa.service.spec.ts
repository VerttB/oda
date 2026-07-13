import { LinhaPesquisaService } from './linha-pesquisa.service';

jest.mock('@/prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}));

describe('LinhaPesquisaService', () => {
  let service: LinhaPesquisaService;
  let prismaService: any;
  let cacheManager: any;
  let tx: any;

  beforeEach(() => {
    tx = {
      linhaPesquisa: {
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        findUniqueOrThrow: jest.fn(),
      },
      membroLinhaPesquisa: {
        createMany: jest.fn(),
        deleteMany: jest.fn(),
      },
      linhaPesquisaPalavraChave: {
        createMany: jest.fn(),
        deleteMany: jest.fn(),
      },
      linhaPesquisaSetorAplicacao: {
        createMany: jest.fn(),
        deleteMany: jest.fn(),
      },
    };

    prismaService = {
      $transaction: jest.fn(async (callback) => await callback(tx)),
      linhaPesquisa: {
        findMany: jest.fn(),
        findUniqueOrThrow: jest.fn(),
      },
    };

    cacheManager = {
      del: jest.fn(),
      wrap: jest.fn(),
    };

    service = new LinhaPesquisaService(prismaService, cacheManager);
  });

  it('creates linha de pesquisa and relation rows in a transaction', async () => {
    const linhaCriada = { id: 'linha-1', titulo: 'IA', grupoId: 'grupo-1' };
    const linhaComRelacoes = {
      ...linhaCriada,
      membros: [],
      palavrasChave: [],
      setoresAplicacao: [],
    };

    tx.linhaPesquisa.create.mockResolvedValue(linhaCriada);
    tx.linhaPesquisa.findUniqueOrThrow.mockResolvedValue(linhaComRelacoes);

    const result = await service.create({
      titulo: 'IA',
      grupoId: 'grupo-1',
      pesquisadorIds: ['pesquisador-1'],
      palavraChaveIds: ['palavra-1'],
      setorAplicacaoIds: ['setor-1'],
    });

    expect(prismaService.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.linhaPesquisa.create).toHaveBeenCalledWith({
      data: {
        titulo: 'IA',
        grupoId: 'grupo-1',
      },
    });
    expect(tx.membroLinhaPesquisa.createMany).toHaveBeenCalledWith({
      data: [{ linhaPesquisaId: 'linha-1', pesquisadorId: 'pesquisador-1' }],
    });
    expect(tx.linhaPesquisaPalavraChave.createMany).toHaveBeenCalledWith({
      data: [{ linhaPesquisaId: 'linha-1', palavraChaveId: 'palavra-1' }],
    });
    expect(tx.linhaPesquisaSetorAplicacao.createMany).toHaveBeenCalledWith({
      data: [{ linhaPesquisaId: 'linha-1', setorAplicacaoId: 'setor-1' }],
    });
    expect(cacheManager.del).toHaveBeenCalledWith('linhas-pesquisa:list');
    expect(result).toBe(linhaComRelacoes);
  });

  it('uses cache wrapper when listing linhas de pesquisa', async () => {
    const linhas = [{ id: 'linha-1', titulo: 'IA' }];
    cacheManager.wrap.mockImplementation(async (_key: string, factory: () => any) =>
      await factory(),
    );
    prismaService.linhaPesquisa.findMany.mockResolvedValue(linhas);

    const result = await service.findAll();

    expect(cacheManager.wrap).toHaveBeenCalledWith(
      'linhas-pesquisa:list',
      expect.any(Function),
    );
    expect(prismaService.linhaPesquisa.findMany).toHaveBeenCalledWith({
      omit: {
        criadoEm: true,
        atualizadoEm: true,
      },
    });
    expect(result).toBe(linhas);
  });

  it('updates scalar fields and replaces provided relations in a transaction', async () => {
    const linhaAtualizada = {
      id: 'linha-1',
      titulo: 'IA aplicada',
      membros: [],
      palavrasChave: [],
      setoresAplicacao: [],
    };

    tx.linhaPesquisa.findUniqueOrThrow.mockResolvedValue(linhaAtualizada);

    const result = await service.update('linha-1', {
      titulo: 'IA aplicada',
      pesquisadorIds: ['pesquisador-1'],
      palavraChaveIds: [],
    });

    expect(tx.linhaPesquisa.update).toHaveBeenCalledWith({
      where: { id: 'linha-1' },
      data: { titulo: 'IA aplicada' },
    });
    expect(tx.membroLinhaPesquisa.deleteMany).toHaveBeenCalledWith({
      where: { linhaPesquisaId: 'linha-1' },
    });
    expect(tx.membroLinhaPesquisa.createMany).toHaveBeenCalledWith({
      data: [{ linhaPesquisaId: 'linha-1', pesquisadorId: 'pesquisador-1' }],
    });
    expect(tx.linhaPesquisaPalavraChave.deleteMany).toHaveBeenCalledWith({
      where: { linhaPesquisaId: 'linha-1' },
    });
    expect(tx.linhaPesquisaSetorAplicacao.deleteMany).not.toHaveBeenCalled();
    expect(cacheManager.del).toHaveBeenCalledWith('linhas-pesquisa:list');
    expect(result).toBe(linhaAtualizada);
  });

  it('removes relation rows before deleting linha de pesquisa', async () => {
    const linhaRemovida = { id: 'linha-1', titulo: 'IA' };
    tx.linhaPesquisa.delete.mockResolvedValue(linhaRemovida);

    const result = await service.remove('linha-1');

    expect(tx.membroLinhaPesquisa.deleteMany).toHaveBeenCalledWith({
      where: { linhaPesquisaId: 'linha-1' },
    });
    expect(tx.linhaPesquisaPalavraChave.deleteMany).toHaveBeenCalledWith({
      where: { linhaPesquisaId: 'linha-1' },
    });
    expect(tx.linhaPesquisaSetorAplicacao.deleteMany).toHaveBeenCalledWith({
      where: { linhaPesquisaId: 'linha-1' },
    });
    expect(tx.linhaPesquisa.delete).toHaveBeenCalledWith({
      where: { id: 'linha-1' },
    });
    expect(result).toBe(linhaRemovida);
  });
});
