import { buildPaginationMeta, getPagination, PaginationQuerySchema } from '@oda/shared-types';

describe('Paginação compartilhada', () => {
  it('usa os mesmos valores padrão do contrato da API', () => {
    const pagination = getPagination();

    expect(pagination).toEqual({ ...PaginationQuerySchema.parse({}), skip: 0, take: 30, isDefault: true });
  });

  it('calcula o deslocamento e arredonda para cima o número de páginas', () => {
    const pagination = getPagination({ page: 3, size: 10 });

    expect(pagination).toMatchObject({ skip: 20, take: 10, isDefault: false });
    expect(buildPaginationMeta(pagination, 21)).toEqual({ page: 3, size: 10, totalItems: 21, totalPages: 3 });
    expect(buildPaginationMeta(pagination, 0).totalPages).toBe(0);
  });

  it('preserva a consulta sem limite quando size é zero', () => {
    const pagination = getPagination({ page: 2, size: 0 });

    expect(pagination).toMatchObject({ skip: 0, take: undefined, isDefault: false });
    expect(buildPaginationMeta(pagination, 42)).toEqual({ page: 2, size: 0, totalItems: 42, totalPages: 1 });
    expect(buildPaginationMeta(pagination, 0).totalPages).toBe(1);
  });
});
