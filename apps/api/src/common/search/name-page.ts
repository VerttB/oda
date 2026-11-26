import { Prisma, nameSearchSpecification } from '@oda/database';
import { getPagination, buildPaginationMeta, type PaginationQuery, type SortOrder } from '@oda/shared-types';
import type { PrismaService } from '@/prisma/prisma.service';

type PageQuery = Partial<PaginationQuery> & { ordem?: SortOrder };
type Source = { from: Prisma.Sql; id: Prisma.Sql; orderBy: Prisma.Sql };

export async function readSearchPage<Row>(
  tx: Prisma.TransactionClient,
  query: PageQuery,
  source: Source,
  select: Prisma.Sql,
  where: Prisma.Sql,
) {
  const pagination = getPagination(query);
  const direction = query.ordem === 'desc' ? Prisma.sql`DESC` : Prisma.sql`ASC`;
  const rows = await tx.$queryRaw<Row[]>(Prisma.sql`
    SELECT ${select} FROM ${source.from} WHERE ${where}
    ORDER BY ${source.orderBy} ${direction}, ${source.id} ASC
    ${pagination.take === undefined ? Prisma.empty : Prisma.sql`LIMIT ${pagination.take}`}
    OFFSET ${pagination.skip}
  `);
  const [{ total: totalItems }] = await tx.$queryRaw<{ total: number }[]>(Prisma.sql`
    SELECT count(*)::int AS total FROM ${source.from} WHERE ${where}
  `);
  return { rows, meta: buildPaginationMeta(pagination, totalItems) };
}

type NameSource = Source & { name: Prisma.Sql; filters?: Prisma.Sql[] };

export function searchNamePage<Item extends { id: string }>(
  prisma: PrismaService,
  query: PageQuery,
  name: string,
  source: NameSource,
  load: (tx: Prisma.TransactionClient, ids: string[]) => PromiseLike<Item[]>,
) {
  const where = Prisma.join([nameSearchSpecification(source.name, name), ...(source.filters ?? [])], ' AND ');
  return prisma.$transaction(async tx => {
    const { rows, meta } = await readSearchPage<{ id: string }>(tx, query, source, source.id, where);
    if (!rows.length) return { data: [], meta };

    const items = await load(tx, rows.map(row => row.id));
    const byId = new Map(items.map(item => [item.id, item]));
    const data = rows.flatMap(({ id }) => {
      const item = byId.get(id);
      return item ? [item] : [];
    });
    return { data, meta };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
}
