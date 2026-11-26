import { Prisma, nameSearchSpecification } from '@oda/database';
import type { FindAllPesquisadoresQuery, PesquisadorResumoResponse } from '@oda/shared-types';
import type { PrismaService } from '@/prisma/prisma.service';
import { readSearchPage } from '@/common/search/name-page';
import { toPesquisadorResponse } from '../pesquisadores.response';

export function buildResearcherNameWhere(query: FindAllPesquisadoresQuery): Prisma.Sql {
  const conditions = [nameSearchSpecification(Prisma.sql`r.nome`, query.nome ?? '')];
  if (query.tipo) conditions.push(Prisma.sql`r.tipo::text = ${query.tipo.toLowerCase()}`);
  if (query.formacaoAcademica) conditions.push(Prisma.sql`r.formacao_academica::text = ${query.formacaoAcademica.toLowerCase()}`);
  if (query.lattesId) conditions.push(Prisma.sql`r.lattes_id = ${query.lattesId}`);
  if (query.orcidId) conditions.push(Prisma.sql`r.orcid_id = ${query.orcidId}`);
  if (query.grupoPesquisaId || query.eLider !== undefined) {
    const memberConditions = [Prisma.sql`mg.pesquisador_id = r.id`];
    if (query.grupoPesquisaId) memberConditions.push(Prisma.sql`mg.grupo_id = ${query.grupoPesquisaId}`);
    if (query.eLider !== undefined) memberConditions.push(Prisma.sql`mg.e_lider = ${query.eLider}`);
    conditions.push(Prisma.sql`EXISTS (
      SELECT 1 FROM public.membro_grupo mg WHERE ${Prisma.join(memberConditions, ' AND ')}
    )`);
  }
  return Prisma.join(conditions, ' AND ');
}

export async function findResearchersByName(prisma: PrismaService, query: FindAllPesquisadoresQuery) {
  const where = buildResearcherNameWhere(query);
  const columns = {
    nome: Prisma.sql`r.nome`, tipo: Prisma.sql`r.tipo`,
    formacaoAcademica: Prisma.sql`r.formacao_academica`, indexH: Prisma.sql`r.index_h`,
  };
  const source = {
    from: Prisma.sql`public.pesquisador r`, id: Prisma.sql`r.id`, orderBy: columns[query.ordenarPor ?? 'nome'],
  };
  const select = Prisma.sql`r.id, r.nome, r.lattes_id AS "lattesId", upper(r.tipo::text) AS tipo,
    upper(r.formacao_academica::text) AS "formacaoAcademica", r.orcid_id AS "orcidId",
    r.open_alex_id AS "openAlexId", r.image_url AS "imageUrl",
    r.index_h AS "indexH", r.index_i_10 AS "indexI10"`;
  const { rows, meta } = await prisma.$transaction(
    tx => readSearchPage<PesquisadorResumoResponse>(tx, query, source, select, where),
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
  );
  return { data: rows.map(toPesquisadorResponse), meta };
}
