import { researcherNameTerms, buildResearcherNameWhere } from './name-search';

describe('Busca de pesquisadores por termos do nome', () => {
  it('normaliza caixa, acentos, espaços e termos duplicados', () => {
    expect(researcherNameTerms('  CÁRLOS\tFERNÁNDO carlos  ')).toEqual(['carlos', 'fernando']);
  });

  it('combina todos os termos com AND sem exigir que sejam consecutivos', () => {
    const sql = buildResearcherNameWhere({ nome: 'Carlos Fernando', page: 1, size: 30 });
    expect(sql.values).toContain('%carlos%');
    expect(sql.values).toContain('%fernando%');
    expect(sql.values).not.toContain('%carlos fernando%');
    expect(sql.sql).toContain(' AND ');
  });

  it('mantém apóstrofos, percentuais e sublinhados como parâmetros literais', () => {
    const sql = buildResearcherNameWhere({ nome: "D'Ávila % _", page: 1, size: 30 });
    expect(sql.values).toContain("%d'avila%");
    expect(sql.values).toContain('%\\%%');
    expect(sql.values).toContain('%\\_%');
    expect(sql.sql).not.toContain("d'avila");
  });

  it('não permite que espaços em branco correspondam a todos os pesquisadores', () => {
    expect(buildResearcherNameWhere({ nome: '   ', page: 1, size: 30 }).sql).toBe('FALSE');
  });

  it('restringe liderança e grupo à mesma associação', () => {
    const sql = buildResearcherNameWhere({ nome: 'Carlos', grupoPesquisaId: 'grupo-id', eLider: false, page: 1, size: 30 });
    expect(sql.sql).toMatch(/mg\.grupo_id = \? AND mg\.e_lider = \?/);
    expect(sql.values.slice(-2)).toEqual(['grupo-id', false]);
  });
});
