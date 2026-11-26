import { Prisma } from '@oda/database';
import { SIMCC_CIMATEC, SIMCC_INSTITUTIONS, type FindAllGruposPesquisaQuery } from '@oda/shared-types';

const simccSiglas = SIMCC_INSTITUTIONS.filter(item => item.sigla !== 'FIOCRUZ').map(item => item.sigla);
const cimatecNames = [SIMCC_CIMATEC.nome, ...SIMCC_CIMATEC.aliases].map(name => `%${name}%`);
const cimatecUnits = [SIMCC_CIMATEC.sigla, ...SIMCC_CIMATEC.aliases].map(name => `%${name}%`);
const simccSeat = Prisma.sql`(
  i.sigla = ANY(${simccSiglas}::text[])
  OR i.sigla ILIKE 'IFBA -%'
  OR (i.sigla = 'FIOCRUZ' AND i.nome ILIKE '%Moniz%')
  OR i.sigla ILIKE ${SIMCC_CIMATEC.sigla}
  OR i.nome ILIKE ANY(${cimatecNames}::text[])
  OR ((i.sigla ILIKE ${SIMCC_CIMATEC.mantenedoraSigla}
       OR i.nome ILIKE ${`${SIMCC_CIMATEC.mantenedoraNome}%`})
      AND gpi.unidade ILIKE ANY(${cimatecUnits}::text[]))
)`;

const sortColumns = {
  nome: Prisma.sql`g.nome`,
  anoFormacao: Prisma.sql`g.ano_formacao`,
  situacao: Prisma.sql`g.situacao`,
};

export function groupNameSearchSource(query: FindAllGruposPesquisaQuery, simcc: boolean) {
  const filters: Prisma.Sql[] = [];

  if (query.situacao) filters.push(Prisma.sql`g.situacao = ${query.situacao.toLowerCase()}::public.situacao`);
  if (query.anoFormacao) filters.push(Prisma.sql`g.ano_formacao = ${query.anoFormacao}`);
  if (query.areaConhecimentoId) filters.push(Prisma.sql`g.area_conhecimento_id = ${query.areaConhecimentoId}`);
  if (query.cidade) filters.push(Prisma.sql`g.cidade ILIKE ${`%${query.cidade}%`}`);
  if (query.uf) filters.push(Prisma.sql`g.uf ILIKE ${query.uf}`);

  if (query.estadoId) filters.push(Prisma.sql`EXISTS (
    SELECT 1 FROM public.grupo_pesquisa_instituicao gpi
    JOIN public.instituicao i ON i.id = gpi.instituicao_id
    WHERE gpi.grupo_id = g.id AND i.estado_id = ${query.estadoId}
  )`);

  if (query.instituicaoId || simcc) filters.push(Prisma.sql`EXISTS (
    SELECT 1 FROM public.grupo_pesquisa_instituicao gpi
    JOIN public.instituicao i ON i.id = gpi.instituicao_id
    WHERE gpi.grupo_id = g.id AND gpi.tipo_relacao = 'sede'
      ${query.instituicaoId ? Prisma.sql`AND gpi.instituicao_id = ${query.instituicaoId}` : Prisma.empty}
      ${simcc ? Prisma.sql`AND ${simccSeat}` : Prisma.empty}
  )`);

  return {
    from: Prisma.sql`public.grupo_pesquisa g`,
    id: Prisma.sql`g.id`,
    name: Prisma.sql`g.nome`,
    orderBy: sortColumns[query.ordenarPor ?? 'nome'],
    filters,
  };
}
