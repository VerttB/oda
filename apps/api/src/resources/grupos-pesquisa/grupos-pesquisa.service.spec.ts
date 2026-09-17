import { TipoRelacaoGrupoInstituicao } from '@oda/database';
import { GruposPesquisaService } from './grupos-pesquisa.service';

describe('GruposPesquisaService', () => {
  const prisma = {
    grupoPesquisa: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
  };
  let service: GruposPesquisaService;

  beforeEach(() => {
    prisma.grupoPesquisa.findMany.mockReset().mockResolvedValue([]);
    prisma.grupoPesquisa.count.mockReset().mockResolvedValue(0);
    service = new GruposPesquisaService(prisma as any, {} as any, {} as any);
  });

  it('restringe a listagem SIMCC a sedes das instituicoes selecionadas', async () => {
    const result = await service.findSimcc();
    const where = prisma.grupoPesquisa.findMany.mock.calls[0][0].where;
    const sede = where.AND[0].instituicoes.some;

    expect(sede.tipoRelacao).toBe(TipoRelacaoGrupoInstituicao.SEDE);
    expect(sede.instituicao.OR).toEqual(expect.arrayContaining([
      { sigla: { startsWith: 'IFBA -', mode: 'insensitive' } },
      { sigla: 'FIOCRUZ', nome: { contains: 'Moniz', mode: 'insensitive' } },
    ]));
    expect(sede.instituicao.OR[0].sigla.in).toHaveLength(10);
    expect(prisma.grupoPesquisa.count).toHaveBeenCalledWith({ where });
    expect(prisma.grupoPesquisa.findMany.mock.calls[0][0].orderBy).toEqual([{ nome: 'asc' }, { id: 'asc' }]);
    expect(result).toEqual({ data: [], meta: { page: 1, size: 30, totalItems: 0, totalPages: 0 } });
  });

  it('aplica instituicaoId e escopo SIMCC ao mesmo vinculo sede', async () => {
    await service.findSimcc({ instituicaoId: 'instituicao-id', page: 2, size: 10 } as any);
    const args = prisma.grupoPesquisa.findMany.mock.calls[0][0];
    const sede = args.where.AND[0].instituicoes.some;

    expect(sede.instituicaoId).toBe('instituicao-id');
    expect(sede.instituicao).toBeDefined();
    expect(args.skip).toBe(10);
    expect(args.take).toBe(10);
  });

  it('mantem o filtro comum por instituicaoId limitado a sede', async () => {
    await service.findAll({ instituicaoId: 'instituicao-id' } as any);
    const sede = prisma.grupoPesquisa.findMany.mock.calls[0][0].where.AND[0].instituicoes.some;

    expect(sede).toEqual({ instituicaoId: 'instituicao-id', tipoRelacao: TipoRelacaoGrupoInstituicao.SEDE });
  });
});
