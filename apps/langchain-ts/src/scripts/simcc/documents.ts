import { PrismaClient, RagSourceType } from '@oda/database';
import type { RagDocumentInput } from '../../services/ragIndexer';
import { buildGroupContent, buildLineContent, buildProductionContent, buildResearcherContent } from '../../services/ragContent';
import { CERTIFIED_SIMCC_WHERE, SimccSelection } from './selection';

export function selectedSources(selection: SimccSelection): Array<{ type: RagSourceType; ids: string[] }> {
  return [
    { type: RagSourceType.GRUPO_PESQUISA, ids: selection.groups.map(group => group.id) },
    { type: RagSourceType.PESQUISADOR, ids: selection.related.researcherIds },
    { type: RagSourceType.LINHA_PESQUISA, ids: selection.related.lineIds },
    { type: RagSourceType.PRODUCAO, ids: selection.related.productionIds },
  ];
}

export async function loadDocuments(db: PrismaClient, type: RagSourceType, ids: string[]): Promise<RagDocumentInput[]> {
  const where = { id: { in: ids } };
  if (type === RagSourceType.GRUPO_PESQUISA) {
    const groups = await db.grupoPesquisa.findMany({
      where: { AND: [where, CERTIFIED_SIMCC_WHERE] }, orderBy: { id: 'asc' },
      include: {
        instituicoes: { include: { instituicao: { include: { estado: true } } } },
        linhasPesquisa: true, membros: { include: { pesquisador: true } }, areasConhecimento: { include: { area: true } },
      },
    });
    return groups.map(group => ({
      sourceType: type, sourceId: group.id, title: group.nome, content: buildGroupContent(group),
      metadata: { dgpId: group.dgpId || '' },
    }));
  }
  if (type === RagSourceType.PESQUISADOR) {
    const researchers = await db.pesquisador.findMany({
      where, orderBy: { id: 'asc' }, include: {
        membrosGrupo: { include: { grupoPesquisa: { include: { instituicoes: { include: { instituicao: true } } } } } },
        _count: { select: { producoes: true } }, areasConhecimento: { include: { area: true } },
      },
    });
    return researchers.map(researcher => ({
      sourceType: type, sourceId: researcher.id, title: researcher.nome, content: buildResearcherContent(researcher),
      metadata: { lattesId: researcher.lattesId || '' },
    }));
  }
  if (type === RagSourceType.LINHA_PESQUISA) {
    const lines = await db.linhaPesquisa.findMany({
      where, orderBy: { id: 'asc' }, include: {
        grupo: { include: { instituicoes: { include: { instituicao: true } } } },
        palavrasChave: { include: { palavraChave: true } }, setoresAplicacao: { include: { setorAplicacao: true } },
        membros: { include: { pesquisador: true } },
      },
    });
    return lines.map(line => ({
      sourceType: type, sourceId: line.id, title: line.titulo, content: buildLineContent(line), metadata: { grupoId: line.grupoId },
    }));
  }
  if (type === RagSourceType.PRODUCAO) {
    const productions = await db.producao.findMany({
      where, orderBy: { id: 'asc' }, include: {
        autores: { include: { pesquisador: true } }, palavrasChave: { include: { palavraChave: true } },
      },
    });
    return productions.map(production => ({
      sourceType: type, sourceId: production.id, title: production.titulo, content: buildProductionContent(production),
      metadata: { doi: production.doi || '' },
    }));
  }
  throw new Error(`Tipo de documento não suportado: ${type}`);
}
