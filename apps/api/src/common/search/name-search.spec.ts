import { Prisma, nameSearchSpecification, nameSearchTerms } from '@oda/database';

describe('Especificação de busca por nome', () => {
  it('normaliza caixa, acentos e termos repetidos', () => {
    expect(nameSearchTerms('  NÚCLEO\tINOVAÇÃO nucleo  ')).toEqual(['nucleo', 'inovacao']);
  });

  it('trata sigla e nome como um único campo pesquisável', () => {
    const sql = nameSearchSpecification(Prisma.sql`concat_ws(' ', i.nome, i.sigla)`, 'Bahia UNEB');

    expect(sql.sql).toContain("concat_ws(' ', i.nome, i.sigla)");
    expect(sql.values).toEqual(expect.arrayContaining(['%bahia%', '%uneb%']));
    expect(sql.sql).toContain(' AND ');
  });

  it('parametriza os termos e mantém os símbolos do LIKE como texto literal', () => {
    const sql = nameSearchSpecification(Prisma.sql`r.nome`, "D'Ávila % _ \\");

    expect(sql.values).toEqual(expect.arrayContaining(["%d'avila%", '%\\%%', '%\\_%', '%\\\\%']));
    expect(sql.sql).not.toContain("d'avila");
  });

  it('uma busca com somente espaços não seleciona registros', () => {
    expect(nameSearchSpecification(Prisma.sql`r.nome`, '\t   ').sql).toBe('FALSE');
  });
});
