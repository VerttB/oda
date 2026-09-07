import { GruposPesquisaService } from '../resources/grupos-pesquisa/grupos-pesquisa.service';
import { PesquisadoresService } from '../resources/pesquisadores/pesquisadores.service';
import { toGrupoPesquisaResponse } from '../resources/grupos-pesquisa/grupos-pesquisa.response';
import { toPesquisadorResponse } from '../resources/pesquisadores/pesquisadores.response';

const audit = { criadoEm: new Date('2026-01-01T00:00:00Z'), atualizadoEm: new Date('2026-02-01T00:00:00Z') };
const pesquisadorBase = {
  id: 'pesquisador-1', lattesId: '123', nome: 'Pesquisador', tipo: 'PESQUISADOR' as const,
  formacaoAcademica: null, openAlexId: null, orcidId: null, imageUrl: null, indexH: 0, indexI10: 0, ...audit,
};
const grupoBase = {
  id: 'grupo-1', dgpId: '456', nome: 'Grupo', anoFormacao: 2020, areaPredominante: 'Computacao',
  repercussao: null, situacao: 'ATIVO' as const, email: null, telefone: null, website: null,
  logradouro: null, numero: null, complemento: null, bairro: null, cidade: null, uf: 'BA', cep: null,
  latitude: 0, longitude: 0, ...audit,
};
const area = { id: 'area-1', nome: 'Computacao', nomeNormalizado: 'computacao', areaPaiId: 'area-pai', ...audit };
function grupoFixture() {
  return { ...grupoBase,
    instituicoes: [{ grupoId: grupoBase.id, instituicaoId: 'instituicao-1', tipoRelacao: 'SEDE' as const,
      unidade: 'Departamento' as string | null, unidadeUf: 'BA' as string | null, ...audit,
      instituicao: { id: 'instituicao-1', nome: 'Universidade', sigla: 'UNEB', estadoId: 'estado-1', ...audit,
        estado: { id: 'estado-1', nome: 'Bahia', sigla: 'BA', regiao: 'Nordeste', ...audit } },
    }],
    areasConhecimento: [{ grupoId: grupoBase.id, areaId: area.id, area }],
    linhasPesquisa: [{ id: 'linha-1', dgpId: null, titulo: 'Linha', objetivo: null, grupoId: grupoBase.id, ...audit }],
    membros: [{ grupoId: grupoBase.id, pesquisadorId: pesquisadorBase.id,
      eLider: true, dataEntrada: new Date('2025-01-01T00:00:00Z'), pesquisador: pesquisadorBase, ...audit }],
  };
}
function pesquisadorFixture(ordemAutoria: number | null = 2) {
  return { ...pesquisadorBase,
    producoes: [{ producaoId: 'producao-1', pesquisadorId: pesquisadorBase.id, ordemAutoria, ...audit,
      producao: { id: 'producao-1', titulo: 'Artigo', ano: 2020, tipo: 'ARTIGO' as const,
        doi: null, url: null, veiculo: null, issn: '12345678', qualis: 'B3' as const, resumo: null, ...audit },
    }],
    membrosGrupo: [{ pesquisadorId: pesquisadorBase.id, grupoId: grupoBase.id, eLider: false,
      dataEntrada: null, grupoPesquisa: grupoBase, ...audit }],
    areasConhecimento: [{ pesquisadorId: pesquisadorBase.id, areaId: area.id, area }],
  };
}
function expectClean(result: unknown) {
  expect(JSON.stringify(result)).not.toMatch(/"(criadoEm|atualizadoEm|grupoId|instituicaoId|estadoId|pesquisadorId|producaoId)":/);
}
function setup() {
  const grupo = grupoFixture();
  const pesquisador = pesquisadorFixture();
  const delegate = (record: unknown) => ({
    findMany: jest.fn().mockResolvedValue([record]), count: jest.fn().mockResolvedValue(1),
    findUnique: jest.fn().mockResolvedValue(record), findUniqueOrThrow: jest.fn().mockResolvedValue(record),
    create: jest.fn().mockResolvedValue(record), update: jest.fn().mockResolvedValue(record),
  });
  const prisma = { grupoPesquisa: delegate(grupo), pesquisador: delegate(pesquisador),
    grupoPesquisaInstituicao: { upsert: jest.fn(), deleteMany: jest.fn() }, $transaction: jest.fn() };
  prisma.$transaction.mockImplementation(callback => callback(prisma));
  const entries = new Map<string, unknown>([['grupos-pesquisa:list', { antigo: true }], ['pesquisadores:list', { antigo: true }]]);
  const cache = { del: jest.fn(async (key: string) => entries.delete(key)),
    wrap: jest.fn(async (key: string, callback: () => Promise<unknown>) => {
      if (!entries.has(key)) entries.set(key, await callback());
      return entries.get(key);
    }),
  };
  const gateway = { semanticSearch: jest.fn(async (_query: string, type: string) => ({
    results: [{ sourceId: type === 'GRUPO_PESQUISA' ? grupo.id : pesquisador.id }], totalItems: 1,
  })) };
  return { grupo, pesquisador, prisma, cache,
    grupos: new GruposPesquisaService(prisma as never, gateway as never, cache as never),
    pesquisadores: new PesquisadoresService(prisma as never, gateway as never, cache as never) };
}

describe('Contratos publicos de grupos e pesquisadores', () => {
  it('instituicoes, areas e membros ficam diretos e mantem metadados de dominio', async () => {
    const { grupos, grupo } = setup();
    const result = await grupos.findOne(grupo.id);
    expectClean(result);
    expect(result.instituicoes?.[0]).toEqual({ id: 'instituicao-1', nome: 'Universidade', sigla: 'UNEB', tipoRelacao: 'SEDE',
      unidade: { nome: 'Departamento', uf: 'BA' }, estado: { id: 'estado-1', nome: 'Bahia', sigla: 'BA', regiao: 'Nordeste' } });
    expect(result.membros?.[0]).toMatchObject({ id: 'pesquisador-1', eLider: true, dataEntrada: '2025-01-01T00:00:00.000Z' });
    expect(result.areasConhecimento?.[0]).toMatchObject({ id: 'area-1', areaPaiId: 'area-pai' });
    expect(result.latitude).toBe(0);
    expect(grupo.criadoEm).toBeInstanceOf(Date);
  });

  it('unidade parcial e ausente nao herdam UF da instituicao', () => {
    const grupo = grupoFixture();
    grupo.instituicoes[0].unidadeUf = null;
    grupo.instituicoes[0].instituicao.estado = null;
    expect(toGrupoPesquisaResponse(grupo).instituicoes?.[0]).toMatchObject({ unidade: { nome: 'Departamento', uf: null }, estado: null });
    grupo.instituicoes[0].unidade = null;
    expect(toGrupoPesquisaResponse(grupo).instituicoes?.[0].unidade).toBeNull();
    grupo.instituicoes[0].unidadeUf = 'PE';
    expect(toGrupoPesquisaResponse(grupo).instituicoes?.[0].unidade).toEqual({ nome: null, uf: 'PE' });
  });

  it.each([null, 0, 2])('producoes recebem ordemAutoria %s diretamente', ordem => {
    const original = pesquisadorFixture(ordem);
    const result = toPesquisadorResponse(original);
    expectClean(result);
    expect(result.producoes?.[0]).toEqual({ id: 'producao-1', titulo: 'Artigo', ano: 2020, tipo: 'ARTIGO',
      doi: null, url: null, veiculo: null, issn: '12345678', qualis: 'B3', resumo: null, ordemAutoria: ordem });
    expect(result.membrosGrupo?.[0]).toMatchObject({ id: 'grupo-1', eLider: false, dataEntrada: null });
    expect(original.producoes[0].producao.criadoEm).toBeInstanceOf(Date);
  });

  it('listas usam novo cache, preservam paginacao e filtro por sede', async () => {
    const { grupos, pesquisadores, prisma, cache } = setup();
    const result = await grupos.findAll();
    expectClean(result);
    expect(result.meta).toEqual({ page: 1, size: 30, totalItems: 1, totalPages: 1 });
    expect(await grupos.findAll()).toEqual(result);
    expect(prisma.grupoPesquisa.findMany).toHaveBeenCalledTimes(1);
    expectClean(await pesquisadores.findAll());
    expect(cache.wrap).toHaveBeenCalledWith('grupos-pesquisa:list:v2', expect.any(Function));
    expect(cache.wrap).toHaveBeenCalledWith('pesquisadores:list:v2', expect.any(Function));
    expectClean(await grupos.findAll({ instituicaoId: 'instituicao-1', page: 1, size: 10 } as never));
    expect(prisma.grupoPesquisa.findMany.mock.calls[1][0].where.AND[0]).toEqual({ instituicoes: {
      some: { instituicaoId: 'instituicao-1', tipoRelacao: 'SEDE' },
    } });
    expectClean(await pesquisadores.findAll({ nome: 'Teste', page: 1, size: 10 } as never));
  });

  it('detalhe inexistente de pesquisador preserva comportamento null', async () => {
    const { pesquisadores, prisma } = setup();
    expectClean(await pesquisadores.findOne('pesquisador-1'));
    prisma.pesquisador.findUnique.mockResolvedValue(null);
    expect(await pesquisadores.findOne('ausente')).toBeNull();
  });

  it('busca semantica, criacao e atualizacao usam os mesmos contratos', async () => {
    const { grupos, pesquisadores } = setup();
    expectClean(await grupos.buscaSemantica('computacao'));
    expectClean(await pesquisadores.buscaSemantica('computacao'));
    const input = { nome: 'Grupo', areaPredominante: 'Computacao', instituicoes: [{ instituicaoId: 'instituicao-1', tipoRelacao: 'SEDE' as const }] };
    expectClean(await grupos.create(input));
    expectClean(await grupos.update('grupo-1', input));
    expectClean(await pesquisadores.create({ nome: 'Pesquisador' }));
    expectClean(await pesquisadores.update('pesquisador-1', { nome: 'Pesquisador' }));
  });
});
