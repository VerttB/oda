import { TipoRelacaoGrupoInstituicao } from '@oda/database';
import { GruposPesquisaService } from './grupos-pesquisa.service';

describe('GruposPesquisaService', () => {
  const prisma = {
    $queryRaw: jest.fn(),
    grupoPesquisa: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  let service: GruposPesquisaService;

  beforeEach(() => {
    prisma.$queryRaw.mockReset().mockResolvedValue([]);
    prisma.$transaction.mockReset().mockImplementation(async callback => callback(prisma));
    prisma.grupoPesquisa.findMany.mockReset().mockResolvedValue([]);
    prisma.grupoPesquisa.count.mockReset().mockResolvedValue(0);
    service = new GruposPesquisaService(prisma as any, {} as any, {} as any);
  });

  it('restringe a listagem SIMCC a sedes das instituicoes selecionadas', async () => {
    const result = await service.findSimcc();
    const where = prisma.grupoPesquisa.findMany.mock.calls[0][0].where;
    const sede = where.AND[0].instituicoes.some;

    expect(sede.tipoRelacao).toBe(TipoRelacaoGrupoInstituicao.SEDE);
    const direct = sede.OR[0].instituicao.OR;
    expect(direct).toEqual(expect.arrayContaining([
      { sigla: { startsWith: 'IFBA -', mode: 'insensitive' } },
      { sigla: 'FIOCRUZ', nome: { contains: 'Moniz', mode: 'insensitive' } },
      { sigla: { equals: 'CIMATEC', mode: 'insensitive' } },
    ]));
    expect(sede.OR[1]).toMatchObject({
      instituicao: { OR: expect.arrayContaining([{ sigla: { equals: 'SENAI/DR/BA', mode: 'insensitive' } }]) },
      OR: expect.arrayContaining([{ unidade: { contains: 'CIMATEC', mode: 'insensitive' } }]),
    });
    expect(prisma.grupoPesquisa.count).toHaveBeenCalledWith({ where });
    expect(prisma.grupoPesquisa.findMany.mock.calls[0][0].orderBy).toEqual([{ nome: 'asc' }, { id: 'asc' }]);
    expect(result).toEqual({ data: [], meta: { page: 1, size: 30, totalItems: 0, totalPages: 0 } });
  });

  it('aplica instituicaoId e escopo SIMCC ao mesmo vinculo sede', async () => {
    await service.findSimcc({ instituicaoId: 'instituicao-id', page: 2, size: 10 } as any);
    const args = prisma.grupoPesquisa.findMany.mock.calls[0][0];
    const sede = args.where.AND[0].instituicoes.some;

    expect(sede.instituicaoId).toBe('instituicao-id');
    expect(sede.OR).toHaveLength(2);
    expect(args.skip).toBe(10);
    expect(args.take).toBe(10);
  });

  it('mantem o filtro comum por instituicaoId limitado a sede', async () => {
    await service.findAll({ instituicaoId: 'instituicao-id' } as any);
    const sede = prisma.grupoPesquisa.findMany.mock.calls[0][0].where.AND[0].instituicoes.some;

    expect(sede).toEqual({ instituicaoId: 'instituicao-id', tipoRelacao: TipoRelacaoGrupoInstituicao.SEDE });
  });

  it('aplica busca normalizada e ordenacao est�vel', async () => {
    prisma.$queryRaw.mockResolvedValueOnce([{ id: 'grupo-1' }]).mockResolvedValueOnce([{ total: 2 }]);

    const result = await service.findAll({
      q: 'NÚCLEO INOVAÇÃO',
      ordenarPor: 'anoFormacao',
      ordem: 'desc',
      page: 2,
      size: 1,
    });

    const args = prisma.grupoPesquisa.findMany.mock.calls[0][0];
    const pageQuery = prisma.$queryRaw.mock.calls[0][0];
    expect(pageQuery.values).toEqual(expect.arrayContaining(['%nucleo%', '%inovacao%']));
    expect(pageQuery.values).not.toContain('%nucleo inovacao%');
    expect(pageQuery.sql).toMatch(/LIKE \? AND .*LIKE \?/);
    expect(pageQuery.sql).toContain('ORDER BY g.ano_formacao DESC, g.id ASC');
    expect(pageQuery.values.slice(-2)).toEqual([1, 1]);
    expect(args.where).toEqual({ id: { in: ['grupo-1'] } });
    expect(result.meta).toEqual({ page: 2, size: 1, totalItems: 2, totalPages: 2 });
  });
});
