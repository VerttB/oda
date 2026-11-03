import { Prisma, PrismaClient, SIMCC_INSTITUICOES_WHERE, Situacao, TipoRelacaoGrupoInstituicao } from '@oda/database';

export const SIMCC_BATCH_SIZE = 200;
export const REQUIRED_ACRONYMS = ['NPAI', 'G2BC', 'ACSO', 'PIMAT'];
export const CERTIFIED_SIMCC_WHERE: Prisma.GrupoPesquisaWhereInput = {
  situacao: Situacao.CERTIFICADO,
  instituicoes: { some: { tipoRelacao: TipoRelacaoGrupoInstituicao.SEDE, instituicao: SIMCC_INSTITUICOES_WHERE } },
};

export type SimccGroup = {
  id: string; dgpId: string | null; nome: string; pesquisadores: number; obrigatorio: string[];
};
export type SimccSelection = {
  requiredAcronyms: string[];
  groups: SimccGroup[];
  related: { researcherIds: string[]; lineIds: string[]; sectorIds: string[]; productionIds: string[] };
  counts: { groups: number; researchers: number; lines: number; sectors: number; productions: number; documents: number };
};
type SelectionDatabase = Pick<PrismaClient, 'grupoPesquisa' | '$queryRaw'>;

export function hasAcronym(name: string, acronym: string): boolean {
  return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()
    .split(/[^A-Z0-9]+/).includes(acronym.toUpperCase());
}

export async function selectSimccBatch(db: SelectionDatabase, extraAcronyms: string[] = []): Promise<SimccSelection> {
  const requiredAcronyms = [...new Set([...REQUIRED_ACRONYMS, ...extraAcronyms.map(value => value.trim().toUpperCase())])];
  if (requiredAcronyms.length > SIMCC_BATCH_SIZE || requiredAcronyms.some(value => !/^[A-Z0-9]{2,30}$/.test(value))) {
    throw new Error('As inclusões devem ser siglas de 2 a 30 letras/números e caber no lote de 200.');
  }
  const select = { id: true, dgpId: true, nome: true, _count: { select: { membros: true } } } as const;
  const chosen = new Map<string, SimccGroup>();
  for (const acronym of requiredAcronyms) {
    const candidates = await db.grupoPesquisa.findMany({
      where: { AND: [CERTIFIED_SIMCC_WHERE, { nome: { contains: acronym, mode: 'insensitive' } }] }, select,
    });
    const matches = candidates.filter(group => hasAcronym(group.nome, acronym));
    if (matches.length !== 1) {
      throw new Error(`A sigla ${acronym} deve identificar exatamente um grupo SIMCC CERTIFICADO; encontrados ${matches.length}.`);
    }
    const group = matches[0];
    const entry = chosen.get(group.id) ?? {
      id: group.id, dgpId: group.dgpId, nome: group.nome, pesquisadores: group._count.membros, obrigatorio: [],
    };
    entry.obrigatorio.push(acronym);
    chosen.set(group.id, entry);
  }
  const ranked = await db.grupoPesquisa.findMany({
    where: CERTIFIED_SIMCC_WHERE, select, take: SIMCC_BATCH_SIZE,
    orderBy: [{ membros: { _count: 'desc' } }, { id: 'asc' }],
  });
  for (const group of ranked) {
    if (chosen.size >= SIMCC_BATCH_SIZE) break;
    if (!chosen.has(group.id)) chosen.set(group.id, {
      id: group.id, dgpId: group.dgpId, nome: group.nome, pesquisadores: group._count.membros, obrigatorio: [],
    });
  }
  if (chosen.size !== SIMCC_BATCH_SIZE) {
    throw new Error(`Há somente ${chosen.size} grupos elegíveis; o lote exige exatamente ${SIMCC_BATCH_SIZE}.`);
  }
  const groups = [...chosen.values()];
  const related = await collectRelated(db, groups.map(group => group.id));
  return {
    requiredAcronyms, groups, related,
    counts: {
      groups: groups.length, researchers: related.researcherIds.length, lines: related.lineIds.length,
      sectors: related.sectorIds.length, productions: related.productionIds.length,
      documents: groups.length + related.researcherIds.length + related.lineIds.length + related.productionIds.length,
    },
  };
}

async function collectRelated(db: SelectionDatabase, ids: string[]): Promise<SimccSelection['related']> {
  const researchers = new Set<string>();
  const lines = new Set<string>();
  const sectors = new Set<string>();
  for (let start = 0; start < ids.length; start += 25) {
    const pageIds = ids.slice(start, start + 25);
    const groups = await db.grupoPesquisa.findMany({
      where: { id: { in: pageIds } },
      select: { membros: { select: { pesquisadorId: true } }, linhasPesquisa: { select: {
        id: true, membros: { select: { pesquisadorId: true } }, setoresAplicacao: { select: { setorAplicacaoId: true } },
      } } },
    });
    if (groups.length !== pageIds.length) throw new Error('Um grupo desapareceu durante o preparo; tente novamente.');
    for (const group of groups) {
      group.membros.forEach(member => researchers.add(member.pesquisadorId));
      for (const line of group.linhasPesquisa) {
        lines.add(line.id);
        line.membros.forEach(member => researchers.add(member.pesquisadorId));
        line.setoresAplicacao.forEach(sector => sectors.add(sector.setorAplicacaoId));
      }
    }
  }
  const productions = researchers.size ? await db.$queryRaw<{ id: string }[]>(Prisma.sql`
    SELECT DISTINCT producao_id AS id FROM public.producao_pesquisador
    WHERE pesquisador_id = ANY(${[...researchers]}::text[])
  `) : [];
  return {
    researcherIds: [...researchers].sort(), lineIds: [...lines].sort(), sectorIds: [...sectors].sort(),
    productionIds: productions.map(row => row.id).sort(),
  };
}
