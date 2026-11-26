import { Prisma } from '../generated/prisma';

const ACCENTED_CHARACTERS = 'áàâãäéèêëíìîïóòôõöúùûüçñýÿ';
const PLAIN_CHARACTERS = 'aaaaaeeeeiiiiooooouuuucnyy';

export function nameSearchTerms(value: string): string[] {
  const normalized = value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('pt-BR');
  return [...new Set(normalized.split(/\s+/u).filter(Boolean))];
}

export function nameSearchSpecification(expression: Prisma.Sql, value: string): Prisma.Sql {
  const terms = nameSearchTerms(value);
  if (!terms.length) return Prisma.sql`FALSE`;

  const name = Prisma.sql`translate(lower(normalize(${expression}, NFC)), ${ACCENTED_CHARACTERS}, ${PLAIN_CHARACTERS})`;
  // Os símbolos do LIKE são parte do texto pesquisado.
  const conditions = terms.map(term => {
    const literal = term.replace(/[\\%_]/g, '\\$&');
    return Prisma.sql`${name} LIKE ${`%${literal}%`}`;
  });
  return Prisma.join(conditions, ' AND ');
}
