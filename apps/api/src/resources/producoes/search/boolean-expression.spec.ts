import { hasBooleanOperators, parseBooleanExpression, parseProductionSearch } from './boolean-expression';
import { buildProductionSearchWhere } from './full-text-search';
import { FindAllProducoesQuerySchema, FindProducoesByPesquisadorQuerySchema, FindAllGruposPesquisaQuerySchema } from '@oda/shared-types';

describe('Busca textual e expressões booleanas de produções', () => {
  it('respeita NOT > AND > OR e AND implícito', () => {
    const result = parseBooleanExpression('fisica OR plasma NOT quimica');
    expect(result).toMatchObject({ kind: 'or', right: { kind: 'and', right: { kind: 'not' } } });
    expect(parseBooleanExpression('(fisica OR plasma) AND quimica')).toMatchObject({ kind: 'and', left: { kind: 'or' } });
  });

  it('preserva frases e operadores literais entre aspas', () => {
    expect(parseBooleanExpression('"AND OR NOT"')).toEqual({ kind: 'term', value: 'AND OR NOT', phrase: true });
  });

  it.each(['', ' ', 'AND fisica', 'fisica OR', 'fisica AND AND plasma', '()', '(fisica', 'fisica)', '"fisica', '""', '!!!', 'NOT plasma', 'fisica OR NOT plasma', 'NOT (fisica AND plasma)'])('rejeita %j', input => {
    expect(() => parseBooleanExpression(input)).toThrow();
  });

  it('limita caracteres, termos e profundidade', () => {
    for (const input of ['a'.repeat(501), Array(33).fill('fisica').join(' '), '('.repeat(6) + 'fisica' + ')'.repeat(6)]) {
      expect(() => parseBooleanExpression(input)).toThrow();
    }
    expect(() => parseBooleanExpression('('.repeat(5) + 'fisica' + ')'.repeat(5))).not.toThrow();
  });

  it('exige valor positivo mesmo quando a expressão usa negações e OR', () => {
    expect(() => parseBooleanExpression('fisica AND NOT (quimica OR plasma)')).not.toThrow();
    expect(() => parseBooleanExpression('NOT NOT fisica')).not.toThrow();
  });

  it('mantém conteúdo do usuário como parâmetro de SQL', () => {
    const sql = buildProductionSearchWhere({ q: '"x\'); DROP TABLE producao; --"', page: 1, size: 30 });
    expect(sql.sql).not.toContain('DROP TABLE');
    expect(sql.values).toContain("x'); DROP TABLE producao; --");
  });

  it('não cria outro modo nos contratos de busca', () => {
    const query = { q: 'fisica AND plasma', modoBusca: 'booleano' };
    expect(FindAllProducoesQuerySchema.safeParse(query).success).toBe(false);
    expect(FindAllGruposPesquisaQuerySchema.safeParse(query).success).toBe(false);
    expect(FindProducoesByPesquisadorQuerySchema.safeParse(query).success).toBe(false);
  });

  it.each(['fisica AND plasma', '(fisica OR quimica)', 'fisica NOT plasma', '"banco de dados"', '"aspas abertas', 'fisica AND(plasma)', '(fisica)AND(plasma)'])('identifica sintaxe em %j', query => {
    expect(hasBooleanOperators(query)).toBe(true);
  });

  it.each(['fisica plasma', 'and or not', 'Aplicações ORIGINAIS (volume 2)', 'AND-based systems'])('mantém %j como texto comum', query => {
    expect(hasBooleanOperators(query)).toBe(false);
  });

  it('converte texto comum em uma consulta de todos os termos sem interpretar parênteses como operadores', () => {
    expect(parseProductionSearch('fisica de plasma')).toEqual({ kind: 'term', value: 'fisica de plasma', phrase: false });
    expect(parseProductionSearch('Título (volume 2)')).toEqual({ kind: 'term', value: 'Título (volume 2)', phrase: false });
    expect(buildProductionSearchWhere({ q: 'fisica de plasma', page: 1, size: 30 }).sql).toContain('p.busca_textual @@ plainto_tsquery');
  });

  it('consulta também o vetor combinado quando titulo é fornecido junto com q', () => {
    const sql = buildProductionSearchWhere({ q: 'fisica', titulo: 'plasma', page: 1, size: 30 });
    expect(sql.values).toEqual(['fisica', 'plasma']);
    expect(sql.sql.match(/p.busca_textual @@/g)).toHaveLength(2);
    expect(sql.sql).not.toContain('LIKE');
  });

  it('valida também os limites de entrada sem operadores', () => {
    for (const input of [' ', '!!!', 'a'.repeat(501), Array(33).fill('fisica').join(' ')]) {
      expect(() => parseProductionSearch(input)).toThrow();
    }
  });
});
