import { Inject, Injectable } from '@nestjs/common';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
import { PrismaService } from '@/prisma/prisma.service';
import {
  CreateLinhaPesquisaRequest,
  UpdateLinhaPesquisaRequest,
} from '@oda/shared-types';
import { FindAllLinhaPesquisaDto } from './dto/find-all-linha-pesquisa.dto';
import { Prisma } from '@oda/database';
import { LangchainGatewayService } from '../langchain/langchain.service';
import { findIdsByAccentInsensitiveText } from '@/common/database/accent-insensitive-search';
import { validateSearchQuery, withoutSearchControls } from '@/common/search/semantic-query';
const LINHAS_PESQUISA_LIST_CACHE_KEY = 'linhas-pesquisa:list:v2';

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
export class LinhaPesquisaService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly langchainService: LangchainGatewayService,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
  ) { }

  async create(createLinhaPesquisaDto: CreateLinhaPesquisaRequest) {
    const {
      pesquisadorIds,
      palavraChaveIds,
      setorAplicacaoIds,
      ...linhaPesquisaData
    } = createLinhaPesquisaDto;

    const linhaPesquisa = await this.prismaService.$transaction(async (tx) => {
      const linhaCriada = await tx.linhaPesquisa.create({
        data: linhaPesquisaData,
      });

      if (pesquisadorIds?.length) {
        await tx.membroLinhaPesquisa.createMany({
          data: pesquisadorIds.map((pesquisadorId) => ({
            linhaPesquisaId: linhaCriada.id,
            pesquisadorId,
          })),
        });
      }

      if (palavraChaveIds?.length) {
        await tx.linhaPesquisaPalavraChave.createMany({
          data: palavraChaveIds.map((palavraChaveId) => ({
            linhaPesquisaId: linhaCriada.id,
            palavraChaveId,
          })),
        });
      }

      if (setorAplicacaoIds?.length) {
        await tx.linhaPesquisaSetorAplicacao.createMany({
          data: setorAplicacaoIds.map((setorAplicacaoId) => ({
            linhaPesquisaId: linhaCriada.id,
            setorAplicacaoId,
          })),
        });
      }

      return await tx.linhaPesquisa.findUniqueOrThrow({
        where: { id: linhaCriada.id },
        include: {
          membros: true,
          palavrasChave: true,
          setoresAplicacao: true,
        },
      });
    });

    await this.cacheManager.del(LINHAS_PESQUISA_LIST_CACHE_KEY);

    return linhaPesquisa;
  }

  async findAll(query?: FindAllLinhaPesquisaDto) {
    validateSearchQuery(query);
    const where: Prisma.LinhaPesquisaWhereInput = {};
    const pagination = getPagination(query);
    const orderBy = [
      { [query?.ordenarPor ?? 'titulo']: query?.ordem ?? 'asc' },
      { id: 'asc' as const },
    ] as Prisma.LinhaPesquisaOrderByWithRelationInput[];
    const hasCustomOrdering = Boolean(query?.ordenarPor || query?.ordem);

    if (query) {
      if (query.grupo) {
        where.grupoId = query.grupo;
      }
      const nameQuery = query.nome ?? (query.modoBusca === 'textual' ? query.q : undefined);
      if (nameQuery) {
        where.id = {
          in: await findIdsByAccentInsensitiveText(this.prismaService, 'linhaPesquisa', nameQuery),
        };
      }
    }

    if (query?.modoBusca === 'semantica') {
      const { results, totalItems } = await this.langchainService.semanticSearch(
        query.q!, 'LINHA_PESQUISA', pagination.size, pagination.skip,
        withoutSearchControls(query as unknown as Record<string, unknown>),
      );
      const ids = results.map(result => result.sourceId);
      const linhas = ids.length === 0 ? [] : await this.prismaService.linhaPesquisa.findMany({
        where: { id: { in: ids } },
        omit: { criadoEm: true, atualizadoEm: true },
      });
      const linhasPorId = new Map(linhas.map(linha => [linha.id, linha]));

      return {
        data: ids.flatMap(id => {
          const linha = linhasPorId.get(id);
          return linha ? [linha] : [];
        }),
        meta: {
          page: pagination.page,
          size: pagination.size,
          totalItems,
          totalPages: Math.ceil(totalItems / pagination.size),
        },
      };
    }

    // Bypass cache if filters or pagination are present (except default pagination)
    if (Object.keys(where).length > 0 || pagination.page > 1 || pagination.size !== 30 || hasCustomOrdering) {
      const [data, totalItems] = await Promise.all([
        this.prismaService.linhaPesquisa.findMany({
          where,
          skip: pagination.skip,
          take: pagination.take,
          orderBy,
          omit: { criadoEm: true, atualizadoEm: true },
        }),
        this.prismaService.linhaPesquisa.count({ where }),
      ]);
      const totalPages = pagination.size === 0 ? 1 : Math.ceil(totalItems / pagination.size);

      return { data, meta: { page: pagination.page, size: pagination.size, totalItems, totalPages } };
    }

    return await this.cacheManager.wrap(
      LINHAS_PESQUISA_LIST_CACHE_KEY,
      async () => {
        const [data, totalItems] = await Promise.all([
          this.prismaService.linhaPesquisa.findMany({
            skip: pagination.skip,
            take: pagination.take,
            orderBy,
            omit: { criadoEm: true, atualizadoEm: true },
          }),
          this.prismaService.linhaPesquisa.count(),
        ]);
        const totalPages = pagination.size === 0 ? 1 : Math.ceil(totalItems / pagination.size);

        return { data, meta: { page: pagination.page, size: pagination.size, totalItems, totalPages } };
      },
    );
  }

  async findOne(id: string) {
    return await this.prismaService.linhaPesquisa.findUniqueOrThrow({
      where: { id },
      include: {
        membros: true,
        palavrasChave: true,
        setoresAplicacao: true,
      },
    });
  }

  async update(id: string, updateLinhaPesquisaDto: UpdateLinhaPesquisaRequest) {
    const {
      pesquisadorIds,
      palavraChaveIds,
      setorAplicacaoIds,
      ...linhaPesquisaData
    } = updateLinhaPesquisaDto;

    const linhaPesquisa = await this.prismaService.$transaction(async (tx) => {
      await tx.linhaPesquisa.update({
        where: { id },
        data: linhaPesquisaData,
      });

      if (pesquisadorIds !== undefined) {
        await tx.membroLinhaPesquisa.deleteMany({
          where: { linhaPesquisaId: id },
        });

        if (pesquisadorIds.length) {
          await tx.membroLinhaPesquisa.createMany({
            data: pesquisadorIds.map((pesquisadorId) => ({
              linhaPesquisaId: id,
              pesquisadorId,
            })),
          });
        }
      }

      if (palavraChaveIds !== undefined) {
        await tx.linhaPesquisaPalavraChave.deleteMany({
          where: { linhaPesquisaId: id },
        });

        if (palavraChaveIds.length) {
          await tx.linhaPesquisaPalavraChave.createMany({
            data: palavraChaveIds.map((palavraChaveId) => ({
              linhaPesquisaId: id,
              palavraChaveId,
            })),
          });
        }
      }

      if (setorAplicacaoIds !== undefined) {
        await tx.linhaPesquisaSetorAplicacao.deleteMany({
          where: { linhaPesquisaId: id },
        });

        if (setorAplicacaoIds.length) {
          await tx.linhaPesquisaSetorAplicacao.createMany({
            data: setorAplicacaoIds.map((setorAplicacaoId) => ({
              linhaPesquisaId: id,
              setorAplicacaoId,
            })),
          });
        }
      }

      return await tx.linhaPesquisa.findUniqueOrThrow({
        where: { id },
        include: {
          membros: true,
          palavrasChave: true,
          setoresAplicacao: true,
        },
      });
    });

    await this.cacheManager.del(LINHAS_PESQUISA_LIST_CACHE_KEY);

    return linhaPesquisa;
  }

  async remove(id: string) {
    const linhaPesquisa = await this.prismaService.$transaction(async (tx) => {
      await tx.membroLinhaPesquisa.deleteMany({
        where: { linhaPesquisaId: id },
      });

      await tx.linhaPesquisaPalavraChave.deleteMany({
        where: { linhaPesquisaId: id },
      });

      await tx.linhaPesquisaSetorAplicacao.deleteMany({
        where: { linhaPesquisaId: id },
      });

      return await tx.linhaPesquisa.delete({ where: { id } });
    });

    await this.cacheManager.del(LINHAS_PESQUISA_LIST_CACHE_KEY);

    return linhaPesquisa;
  }
}
