import {
  findIdsByAccentInsensitiveText,
  normalizeSearchText,
} from './accent-insensitive-search';

describe('accent-insensitive-search', () => {
  it('normaliza acentos, caixa e espacos externos', () => {
    expect(normalizeSearchText('  CI\u00caNCIA da Computa\u00e7\u00e3o  ')).toBe('ciencia da computacao');
    expect(normalizeSearchText('Jos\u00e9 \u00c1LVARO')).toBe('jose alvaro');
  });

  it('retorna somente os IDs encontrados pela consulta parametrizada', async () => {
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: '1' }, { id: '2' }]),
    };

    await expect(findIdsByAccentInsensitiveText(
      prisma as any,
      'pesquisador',
      'JOSE',
    )).resolves.toEqual(['1', '2']);
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('permite pesquisar instituicao pelo nome ou pela sigla', async () => {
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: 'uneb-id' }]),
    };

    await expect(findIdsByAccentInsensitiveText(prisma as any, 'instituicao', 'uneb'))
      .resolves.toEqual(['uneb-id']);
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('nao consulta o banco quando o termo contem somente espacos', async () => {
    const prisma = { $queryRaw: jest.fn() };
    await expect(findIdsByAccentInsensitiveText(prisma as any, 'instituicao', '   '))
      .resolves.toEqual([]);
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });
});
