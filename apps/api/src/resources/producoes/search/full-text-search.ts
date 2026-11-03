import { Prisma } from '@oda/database';
import { BadRequestException } from '@nestjs/common';
import type { PrismaService } from '@/prisma/prisma.service';
import type { FindAllProducoesQuery, ProducaoResponse } from '@oda/shared-types';
import { BooleanExpression, hasBooleanOperators, parseProductionSearch } from './boolean-expression';

function compileExpression(node: BooleanExpression): Prisma.Sql {
  if (node.kind === 'not') return Prisma.sql`NOT (${compileExpression(node.child)})`;
  if (node.kind === 'and') return Prisma.sql`(${compileExpression(node.left)} AND ${compileExpression(node.right)})`;
  if (node.kind === 'or') return Prisma.sql`(${compileExpression(node.left)} OR ${compileExpression(node.right)})`;

  const query = node.phrase
    ? Prisma.sql`phraseto_tsquery('public.oda_producoes'::regconfig, ${node.value})`
    : Prisma.sql`plainto_tsquery('public.oda_producoes'::regconfig, ${node.value})`;
  const indexedMatch = Prisma.sql`p.busca_textual @@ ${query}`;
  if (!node.phrase) return indexedMatch;
  // O vetor combinado pode formar uma frase entre o fim do título e o início do resumo.
  // Revalidar somente frases nos campos originais evita esse falso positivo, inclusive com NOT.
  return Prisma.sql`(
    ${indexedMatch} AND (
      to_tsvector('public.oda_producoes'::regconfig, coalesce(p.titulo, '')) @@ ${query}
      OR to_tsvector('public.oda_producoes'::regconfig, coalesce(p.resumo, '')) @@ ${query}
    )
  )`;
}

export function buildProductionSearchWhere(query: FindAllProducoesQuery): Prisma.Sql {
  const conditions = [compileExpression(parseProductionSearch(query.q ?? query.titulo ?? ''))];
  if (query.q && query.titulo) conditions.push(compileExpression(parseProductionSearch(query.titulo)));
  if (query.ano !== undefined) conditions.push(Prisma.sql`p.ano = ${query.ano}`);
  if (query.tipo) {
    const types = { ARTIGO: 'artigo', LIVROCAPITULO: 'livro_capitulo', OUTRA: 'outra' };
    conditions.push(Prisma.sql`p.tipo::text = ${types[query.tipo]}`);
  }
  if (query.qualis) conditions.push(Prisma.sql`p.qualis::text = ${query.qualis}`);
  if (query.issn) {
    const issn = query.issn.replace('-', '').toUpperCase();
    conditions.push(Prisma.sql`upper(p.issn) IN (${issn}, ${`${issn.slice(0, 4)}-${issn.slice(4)}`})`);
  }
  if (query.pesquisadorId || query.grupoId) {
    const authorConditions = [Prisma.sql`pp.producao_id = p.id`];
    if (query.pesquisadorId) authorConditions.push(Prisma.sql`pp.pesquisador_id = ${query.pesquisadorId}`);
    if (query.grupoId) authorConditions.push(Prisma.sql`EXISTS (
      SELECT 1 FROM public.membro_grupo mg
      WHERE mg.pesquisador_id = pp.pesquisador_id AND mg.grupo_id = ${query.grupoId}
    )`);
    conditions.push(Prisma.sql`EXISTS (
      SELECT 1 FROM public.producao_pesquisador pp WHERE ${Prisma.join(authorConditions, ' AND ')}
    )`);
  }
  return Prisma.join(conditions, ' AND ');
}

export async function findFullTextProductions(prisma: PrismaService, query: FindAllProducoesQuery) {
  const page = query.page ?? 1;
  const size = query.size ?? 30;
  const hasOperators = [query.q, query.titulo].some(value => value && hasBooleanOperators(value));
  if (hasOperators && (size < 1 || size > 100)) throw new BadRequestException('A busca com operadores aceita size entre 1 e 100.');
  const where = buildProductionSearchWhere(query);
  // Somente identificadores e direções definidos no código entram como SQL literal.
  const columns = { titulo: Prisma.sql`p.titulo`, ano: Prisma.sql`p.ano`, tipo: Prisma.sql`p.tipo`, qualis: Prisma.sql`p.qualis` };
  const column = columns[query.ordenarPor ?? 'titulo'];
  const direction = query.ordem === 'desc' ? Prisma.sql`DESC` : Prisma.sql`ASC`;
  const [data, [count]] = await prisma.$transaction([
    prisma.$queryRaw<ProducaoResponse[]>(Prisma.sql`
      SELECT p.id, p.titulo, p.ano, upper(replace(p.tipo::text, '_', '')) AS tipo,
        p.doi, p.url, p.veiculo, p.resumo, p.issn, p.qualis::text AS qualis
      FROM public.producao p WHERE ${where}
      ORDER BY ${column} ${direction}, p.id ASC
      ${size === 0 ? Prisma.empty : Prisma.sql`LIMIT ${size}`} OFFSET ${(page - 1) * size}
    `),
    prisma.$queryRaw<{ total: number }[]>(Prisma.sql`
      SELECT count(*)::int AS total FROM public.producao p WHERE ${where}
    `),
  ], { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  return { data, meta: { page, size, totalItems: count.total, totalPages: size === 0 ? 1 : Math.ceil(count.total / size) } };
}
