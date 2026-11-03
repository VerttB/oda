import { Prisma } from '@oda/database';
import type { FindAllPesquisadoresQuery, PesquisadorResumoResponse } from '@oda/shared-types';
import type { PrismaService } from '@/prisma/prisma.service';
import { accentInsensitiveExpression, normalizeSearchText } from '@/common/database/accent-insensitive-search';
import { toPesquisadorResponse } from '../pesquisadores.response';

export function researcherNameTerms(name: string): string[] {
  return [...new Set(normalizeSearchText(name).split(/\s+/u).filter(Boolean))];
}

export function buildResearcherNameWhere(query: FindAllPesquisadoresQuery): Prisma.Sql {
  const nameExpression = accentInsensitiveExpression(Prisma.sql`r.nome`);
  const terms = researcherNameTerms(query.nome ?? '');
  if (terms.length === 0) return Prisma.sql`FALSE`;
  const conditions = terms.map(term => {
    // Percentual, sublinhado e barra invertida são texto literal, não curingas do LIKE.
    const literal = term.replace(/[\\%_]/g, '\\$&');
    return Prisma.sql`${nameExpression} LIKE ${`%${literal}%`}`;
  });
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
  const page = query.page ?? 1;
  const size = query.size ?? 30;
  const where = buildResearcherNameWhere(query);
  const columns = {
    nome: Prisma.sql`r.nome`, tipo: Prisma.sql`r.tipo`,
    formacaoAcademica: Prisma.sql`r.formacao_academica`, indexH: Prisma.sql`r.index_h`,
  };
  const column = columns[query.ordenarPor ?? 'nome'];
  const direction = query.ordem === 'desc' ? Prisma.sql`DESC` : Prisma.sql`ASC`;
  const [rows, [count]] = await prisma.$transaction([
    prisma.$queryRaw<PesquisadorResumoResponse[]>(Prisma.sql`
      SELECT r.id, r.nome, r.lattes_id AS "lattesId", upper(r.tipo::text) AS tipo,
        upper(r.formacao_academica::text) AS "formacaoAcademica", r.orcid_id AS "orcidId",
        r.open_alex_id AS "openAlexId", r.image_url AS "imageUrl",
        r.index_h AS "indexH", r.index_i_10 AS "indexI10"
      FROM public.pesquisador r WHERE ${where}
      ORDER BY ${column} ${direction}, r.id ASC
      ${size === 0 ? Prisma.empty : Prisma.sql`LIMIT ${size}`} OFFSET ${(page - 1) * size}
    `),
    prisma.$queryRaw<{ total: number }[]>(Prisma.sql`
      SELECT count(*)::int AS total FROM public.pesquisador r WHERE ${where}
    `),
  ], { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  return {
    data: rows.map(toPesquisadorResponse),
    meta: { page, size, totalItems: count.total, totalPages: size === 0 ? 1 : Math.ceil(count.total / size) },
  };
}
