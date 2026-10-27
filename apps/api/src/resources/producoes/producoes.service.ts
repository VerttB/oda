import { Inject, Injectable } from '@nestjs/common';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateProducoeDto } from './dto/create-producoe.dto';
import { UpdateProducoeDto } from './dto/update-producoe.dto';
import { FindAllProducoesDto } from './dto/find-all-producoes.dto';
import { Prisma } from '@oda/database';
import { LangchainGatewayService } from '../langchain/langchain.service';
import { findIdsByAccentInsensitiveText } from '@/common/database/accent-insensitive-search';
import { validateSearchQuery, withoutSearchControls } from '@/common/search/semantic-query';

const PRODUCOES_LIST_CACHE_KEY = 'producoes:list:v2';

const getPagination = (query?: { page?: number; size?: number }) => {
  const page = query?.page ?? 1;
  const size = query?.size ?? 30;

  return {
    page,
    size,
    skip: (page - 1) * size,
    take: size === 0 ? undefined : size,
  };
};

@Injectable()
export class ProducoesService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly langchainService: LangchainGatewayService,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
  ) {}

  async create(createProducoeDto: CreateProducoeDto) {
    const { autores, palavraChaveIds, ...producaoData } = createProducoeDto;

    const producao = await this.prismaService.$transaction(async (tx) => {
      const producaoCriada = await tx.producao.create({
        data: producaoData,
      });

      if (autores?.length) {
        await tx.producaoPesquisador.createMany({
          data: autores.map((autor) => ({
            producaoId: producaoCriada.id,
            pesquisadorId: autor.pesquisadorId,
            ordemAutoria: autor.ordemAutoria,
          })),
        });
      }

      if (palavraChaveIds?.length) {
        await tx.producaoPalavraChave.createMany({
          data: palavraChaveIds.map((palavraChaveId) => ({
            producaoId: producaoCriada.id,
            palavraChaveId,
          })),
        });
      }

      return await tx.producao.findUniqueOrThrow({
        where: { id: producaoCriada.id },
        include: {
          autores: true,
          palavrasChave: true,
        },
      });
    });

    await this.cacheManager.del(PRODUCOES_LIST_CACHE_KEY);

    return producao;
  }

  async findAll(query?: FindAllProducoesDto) {
    validateSearchQuery(query);
    const where: Prisma.ProducaoWhereInput = {};
    const pagination = getPagination(query);
    const orderBy = [
      { [query?.ordenarPor ?? 'titulo']: query?.ordem ?? 'asc' },
      { id: 'asc' as const },
    ] as Prisma.ProducaoOrderByWithRelationInput[];
    const hasCustomOrdering = Boolean(query?.ordenarPor || query?.ordem);

    if (query) {
      const titleQuery = query.titulo ?? (query.modoBusca === 'textual' ? query.q : undefined);
      if (titleQuery) {
        where.id = {
          in: await findIdsByAccentInsensitiveText(this.prismaService, 'producao', titleQuery),
        };
      }
      if (query.ano) {
        where.ano = query.ano;
      }
      if (query.tipo) {
        where.tipo = query.tipo;
      }
      if (query.qualis) {
        where.qualis = query.qualis;
      }
      if (query.issn) {
        const issn = query.issn.replace('-', '').toUpperCase();
        where.issn = { in: [issn, `${issn.slice(0, 4)}-${issn.slice(4)}`], mode: 'insensitive' };
      }

      if (query.pesquisadorId || query.grupoId) {
        where.autores = {
          some: {
            AND: [
              query.pesquisadorId ? { pesquisadorId: query.pesquisadorId } : {},
              query.grupoId ? {
                pesquisador: {
                  membrosGrupo: {
                    some: {
                      grupoId: query.grupoId
                    }
                  }
                }
              } : {}
            ]
          }
        };
      }
    }

    if (query?.modoBusca === 'semantica') {
      const { results, totalItems } = await this.langchainService.semanticSearch(
        query.q!, 'PRODUCAO', pagination.size, pagination.skip,
        withoutSearchControls(query as unknown as Record<string, unknown>),
      );
      const ids = results.map(result => result.sourceId);
      const producoes = ids.length === 0 ? [] : await this.prismaService.producao.findMany({
        where: { id: { in: ids } },
        omit: { criadoEm: true, atualizadoEm: true },
      });
      const producoesPorId = new Map(producoes.map(producao => [producao.id, producao]));

      return {
        data: ids.flatMap(id => {
          const producao = producoesPorId.get(id);
          return producao ? [producao] : [];
        }),
        meta: {
          page: pagination.page,
          size: pagination.size,
          totalItems,
          totalPages: Math.ceil(totalItems / pagination.size),
        },
      };
    }

    if (Object.keys(where).length > 0 || pagination.page > 1 || pagination.size !== 30 || hasCustomOrdering) {
      const [data, totalItems] = await Promise.all([
        this.prismaService.producao.findMany({
          where,
          skip: pagination.skip,
          take: pagination.take,
          orderBy,
          omit: { criadoEm: true, atualizadoEm: true },
        }),
        this.prismaService.producao.count({ where }),
      ]);
      const totalPages = pagination.size === 0 ? 1 : Math.ceil(totalItems / pagination.size);

      return { data, meta: { page: pagination.page, size: pagination.size, totalItems, totalPages } };
    }

    return this.cacheManager.wrap(PRODUCOES_LIST_CACHE_KEY, async () => {
      const [data, totalItems] = await Promise.all([
        this.prismaService.producao.findMany({
          skip: pagination.skip,
          take: pagination.take,
          orderBy,
          omit: { criadoEm: true, atualizadoEm: true },
        }),
        this.prismaService.producao.count(),
      ]);
      const totalPages = pagination.size === 0 ? 1 : Math.ceil(totalItems / pagination.size);

      return { data, meta: { page: pagination.page, size: pagination.size, totalItems, totalPages } };
    });
  }

  async findOne(id: string) {
    return await this.prismaService.producao.findUniqueOrThrow({
      where: { id },
      include: {
        autores: true,
        palavrasChave: true,
      },
    });
  }

  async update(id: string, updateProducoeDto: UpdateProducoeDto) {
    const { autores, palavraChaveIds, ...producaoData } = updateProducoeDto;

    const producao = await this.prismaService.$transaction(async (tx) => {
      await tx.producao.update({
        where: { id },
        data: producaoData,
      });

      if (autores !== undefined) {
        await tx.producaoPesquisador.deleteMany({
          where: { producaoId: id },
        });

        if (autores.length) {
          await tx.producaoPesquisador.createMany({
            data: autores.map((autor) => ({
              producaoId: id,
              pesquisadorId: autor.pesquisadorId,
              ordemAutoria: autor.ordemAutoria,
            })),
          });
        }
      }

      if (palavraChaveIds !== undefined) {
        await tx.producaoPalavraChave.deleteMany({
          where: { producaoId: id },
        });

        if (palavraChaveIds.length) {
          await tx.producaoPalavraChave.createMany({
            data: palavraChaveIds.map((palavraChaveId) => ({
              producaoId: id,
              palavraChaveId,
            })),
          });
        }
      }

      return await tx.producao.findUniqueOrThrow({
        where: { id },
        include: {
          autores: true,
          palavrasChave: true,
        },
      });
    });

    await this.cacheManager.del(PRODUCOES_LIST_CACHE_KEY);

    return producao;
  }

  async remove(id: string) {
    const producao = await this.prismaService.$transaction(async (tx) => {
      await tx.producaoPesquisador.deleteMany({
        where: { producaoId: id },
      });

      await tx.producaoPalavraChave.deleteMany({
        where: { producaoId: id },
      });

      return await tx.producao.delete({ where: { id } });
    });

    await this.cacheManager.del(PRODUCOES_LIST_CACHE_KEY);

    return producao;
  }
}
