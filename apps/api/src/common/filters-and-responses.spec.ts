import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { lastValueFrom, of, throwError } from 'rxjs';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { RequestMethod } from '@nestjs/common';
import { OmitAuditFieldsInterceptor, omitAuditFields } from './interceptors/omit-audit-fields.interceptor';
import { FindAllProducoesDto } from '../resources/producoes/dto/find-all-producoes.dto';
import { FindProducoesByPesquisadorQueryDto } from '../resources/pesquisadores/dto/find-producoes-by-pesquisador-query.dto';
import { FindAllInstituicaoDto } from '../resources/instituicao/dto/find-all-instituicao.dto';
import { ProducoesService } from '../resources/producoes/producoes.service';
import { InstituicaoService } from '../resources/instituicao/instituicao.service';
import { UfController } from '../resources/uf/uf.controller';

describe('Filtros de producoes e instituicoes', () => {
  it('aceita filtros novos tambem na subrota de producoes do pesquisador', async () => {
    for (const Type of [FindAllProducoesDto, FindProducoesByPesquisadorQueryDto]) {
      const query = plainToInstance(Type, { qualis: ' b3 ', issn: '1234-567x' });
      expect(await validate(query)).toHaveLength(0);
      expect(query.qualis).toBe('B3');
      expect(query.issn).toBe('1234-567X');
    }
    expect(await validate(plainToInstance(FindAllProducoesDto, { qualis: 'A9', issn: 'invalido' }))).toHaveLength(2);
  });

  it.each(['1234567X', '1234-567X'])('combina qualis e ISSN %s com os demais filtros e contagem', async issn => {
    const prisma = { producao: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) } };
    const cache = { wrap: jest.fn() };
    const service = new ProducoesService(prisma as never, {} as never, cache as never);
    const query = plainToInstance(FindAllProducoesDto, { qualis: 'B3', issn, ano: '2020', pesquisadorId: 'p1' });
    const result = await service.findAll(query);
    const where = prisma.producao.findMany.mock.calls[0][0].where;
    expect(where).toMatchObject({ qualis: 'B3', ano: 2020,
      issn: { in: ['1234567X', '1234-567X'], mode: 'insensitive' },
      autores: { some: { AND: [{ pesquisadorId: 'p1' }, {}] } },
    });
    expect(prisma.producao.count).toHaveBeenCalledWith({ where });
    expect(cache.wrap).not.toHaveBeenCalled();
    expect(result.meta.totalItems).toBe(0);
  });

  it('valida UUID do estado e normaliza UF', async () => {
    const query = plainToInstance(FindAllInstituicaoDto, { estadoId: '660d5a21-0398-49a8-a7c0-a63c6c7c754a', uf: ' ba ' });
    expect(await validate(query)).toHaveLength(0);
    expect(query.uf).toBe('BA');
    expect(await validate(plainToInstance(FindAllInstituicaoDto, { estadoId: 'BA', uf: 'Bahia' }))).toHaveLength(2);
  });

  function institutionSetup() {
    const record = { id: 'i1', nome: 'Universidade', sigla: 'UNI', estadoId: 'e1', criadoEm: new Date(), atualizadoEm: new Date(),
      estado: { id: 'e1', nome: 'Bahia', sigla: 'BA', regiao: 'Nordeste', criadoEm: new Date() },
      _count: { gruposPesquisaVinculos: 1 },
      gruposPesquisaVinculos: [{ grupoId: 'g1', instituicaoId: 'i1', tipoRelacao: 'PARCEIRA', unidade: 'Campus', unidadeUf: null,
        grupoPesquisa: { id: 'g1', dgpId: '123', nome: 'Grupo', situacao: 'ATIVO', uf: 'PE', cidade: null } }],
    };
    const prisma = { instituicao: { findMany: jest.fn().mockResolvedValue([record]), count: jest.fn().mockResolvedValue(1),
      findUniqueOrThrow: jest.fn().mockResolvedValue(record) } };
    const cache = { wrap: jest.fn(async (_key, factory) => factory()) };
    return { prisma, cache, service: new InstituicaoService(prisma as never, cache as never) };
  }

  it('instituicao retorna grupos diretos com tipo e unidade, sem IDs ou auditoria duplicados', async () => {
    const { service } = institutionSetup();
    const result = await service.findOne('i1');
    expect(result.gruposPesquisa[0]).toEqual({ id: 'g1', dgpId: '123', nome: 'Grupo', situacao: 'ATIVO', uf: 'PE', cidade: null,
      tipoRelacao: 'PARCEIRA', unidade: { nome: 'Campus', uf: null } });
    expect(result.totalGruposPesquisa).toBe(1);
    expect(JSON.stringify(result)).not.toMatch(/"(criadoEm|atualizadoEm|instituicaoId|grupoId|estadoId|_count|gruposPesquisaVinculos)":/);
  });

  it('filtro de estado e nome usa o mesmo where na lista e na contagem', async () => {
    const { service, prisma, cache } = institutionSetup();
    const query = plainToInstance(FindAllInstituicaoDto, { estadoId: '660d5a21-0398-49a8-a7c0-a63c6c7c754a', uf: 'BA', nome: 'Uni' });
    await service.findAll(query);
    const where = prisma.instituicao.findMany.mock.calls[0][0].where;
    expect(where).toEqual({ estadoId: query.estadoId, estado: { sigla: { equals: 'BA', mode: 'insensitive' } }, nome: { contains: 'Uni', mode: 'insensitive' } });
    expect(prisma.instituicao.count).toHaveBeenCalledWith({ where });
    expect(cache.wrap).not.toHaveBeenCalled();
    expect((await service.findAll()).data[0].gruposPesquisa[0].id).toBe('g1');
    expect(cache.wrap).toHaveBeenCalledWith('instituicoes:list:v2', expect.any(Function));
  });
});

describe('Remocao global de auditoria', () => {
  it('limpa niveis aninhados e dados de cache sem mutar a origem ou perder datas de dominio', async () => {
    const date = new Date('2026-09-06T12:00:00Z');
    const input = { criadoEm: date, dataInicio: date, dataFim: null, data: [{ atualizadoEm: date, ano: 2020,
      nested: { criadoEm: date, ativo: false, total: 0, texto: 'criadoEm' } }], meta: { totalItems: 1 } };
    const result = await lastValueFrom(new OmitAuditFieldsInterceptor().intercept({} as never, { handle: () => of(input) }));
    expect(result).toEqual({ dataInicio: date, dataFim: null, data: [{ ano: 2020,
      nested: { ativo: false, total: 0, texto: 'criadoEm' } }], meta: { totalItems: 1 } });
    expect(input.criadoEm).toBe(date);
    expect(omitAuditFields(date)).toBe(date);
    const buffer = Buffer.from('arquivo');
    expect(omitAuditFields(buffer)).toBe(buffer);
  });

  it('preserva falhas do handler', async () => {
    const error = new Error('falha');
    await expect(lastValueFrom(new OmitAuditFieldsInterceptor().intercept({} as never, { handle: () => throwError(() => error) }))).rejects.toBe(error);
  });
});

it('UF expoe apenas a listagem GET /uf', () => {
  const handlers = Object.getOwnPropertyNames(UfController.prototype).filter(name => name !== 'constructor');
  expect(handlers).toEqual(['findAll']);
  expect(Reflect.getMetadata(PATH_METADATA, UfController)).toBe('uf');
  expect(Reflect.getMetadata(METHOD_METADATA, UfController.prototype.findAll)).toBe(RequestMethod.GET);
});
