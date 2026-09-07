import { Inject, Injectable } from '@nestjs/common';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateProducoeDto } from './dto/create-producoe.dto';
import { UpdateProducoeDto } from './dto/update-producoe.dto';
import { FindAllProducoesDto } from './dto/find-all-producoes.dto';
import { Prisma } from '@oda/database';
import { LangchainGatewayService } from '../langchain/langchain.service';

const PRODUCOES_LIST_CACHE_KEY = 'producoes:list';

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
    const where: Prisma.ProducaoWhereInput = {};

    if (query) {
      if (query.titulo) {
        where.titulo = { contains: query.titulo, mode: 'insensitive' };
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

    if (Object.keys(where).length > 0 || (query && (query.page > 1 || query.size !== 30))) {
      const [data, totalItems] = await Promise.all([
        this.prismaService.producao.findMany({
          where,
          skip: query?.skip,
          take: query?.take,
          omit: { criadoEm: true, atualizadoEm: true },
        }),
        this.prismaService.producao.count({ where }),
      ]);
      const size = query?.size ?? 30;
      const page = query?.page ?? 1;
      const totalPages = size === 0 ? 1 : Math.ceil(totalItems / size);

      return { data, meta: { page, size, totalItems, totalPages } };
    }

    return this.cacheManager.wrap(PRODUCOES_LIST_CACHE_KEY, async () => {
      const [data, totalItems] = await Promise.all([
        this.prismaService.producao.findMany({
          skip: query?.skip,
          take: query?.take,
          omit: { criadoEm: true, atualizadoEm: true },
        }),
        this.prismaService.producao.count(),
      ]);
      const size = query?.size ?? 30;
      const page = query?.page ?? 1;
      const totalPages = size === 0 ? 1 : Math.ceil(totalItems / size);

      return { data, meta: { page, size, totalItems, totalPages } };
    });
  }

  async buscaSemantica(query: string, page?: number, size?: number) {
    const pageNum = page ? Number(page) : 1;
    const sizeNum = size ? Number(size) : 30;
    const offset = (pageNum - 1) * sizeNum;

    const { results, totalItems } = await this.langchainService.semanticSearch(query, 'PRODUCAO', sizeNum, offset);
    const ids = results.map(r => r.sourceId);

    if (ids.length === 0) {
      return { data: [], meta: { page: pageNum, size: sizeNum, totalItems: 0, totalPages: 0 } };
    }

    const artigos = await this.prismaService.producao.findMany({
      where: { id: { in: ids } },
      include: {
        autores: { include: { pesquisador: true } }
      }
    });

    const data = ids.map(id => artigos.find(a => a.id === id)).filter(Boolean);
    const totalPages = Math.ceil(totalItems / sizeNum);

    return { data, meta: { page: pageNum, size: sizeNum, totalItems, totalPages } };
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
