import { Prisma } from '@oda/database';
import { PrismaService } from '@/prisma/prisma.service';

const ACCENTED_CHARACTERS = '\u00e1\u00e0\u00e2\u00e3\u00e4\u00e9\u00e8\u00ea\u00eb\u00ed\u00ec\u00ee\u00ef\u00f3\u00f2\u00f4\u00f5\u00f6\u00fa\u00f9\u00fb\u00fc\u00e7\u00f1\u00fd\u00ff';
const PLAIN_CHARACTERS = 'aaaaaeeeeiiiiooooouuuucnyy';

const SEARCH_TARGETS = {
  grupoPesquisa: { table: '"grupo_pesquisa"', expression: '"nome"' },
  pesquisador: { table: '"pesquisador"', expression: '"nome"' },
  instituicao: { table: '"instituicao"', expression: 'concat_ws(\' \', "nome", "sigla")' },
  areaConhecimento: { table: '"area_conhecimento"', expression: '"nome"' },
  linhaPesquisa: { table: '"linha_pesquisa"', expression: '"titulo"' },
  producao: { table: '"producao"', expression: '"titulo"' },
} as const;

export type AccentInsensitiveSearchTarget = keyof typeof SEARCH_TARGETS;

export function normalizeSearchText(value: string) {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('pt-BR')
    .trim();
}

export async function findIdsByAccentInsensitiveText(
  prisma: PrismaService,
  target: AccentInsensitiveSearchTarget,
  value: string,
) {
  const normalizedValue = normalizeSearchText(value);
  if (!normalizedValue) return [];

  // Identifiers come only from this static map; the searched value remains parameterized.
  const { table, expression } = SEARCH_TARGETS[target];
  const rows = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT "id"
    FROM ${Prisma.raw(table)}
    WHERE translate(
      lower(${Prisma.raw(expression)}),
      ${ACCENTED_CHARACTERS},
      ${PLAIN_CHARACTERS}
    ) LIKE ${`%${normalizedValue}%`}
  `);

  return rows.map(row => row.id);
}
