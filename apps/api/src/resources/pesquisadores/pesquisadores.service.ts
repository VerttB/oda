import { Inject, Injectable } from '@nestjs/common';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
import { PrismaService } from '@/prisma/prisma.service';
import {
  CreatePesquisadorRequest,
  UpdatePesquisadorRequest,
} from '@oda/shared-types';
import { FindAllPesquisadoresDto } from './dto/find-all-pesquisadores.dto';
import { FormacaoAcademica, Prisma, TipoPesquisador } from '@oda/database';
import { LangchainGatewayService } from '../langchain/langchain.service';
import { toPesquisadorResponse } from './pesquisadores.response';
import { findResearchersByName } from './search/name-search';
import { validateSearchQuery, withoutSearchControls } from '@/common/search/semantic-query';
const PESQUISADORES_LIST_CACHE_KEY = 'pesquisadores:list:v3';

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
export class PesquisadoresService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly langchainService: LangchainGatewayService,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
  ) { }

  async create(createPesquisadoreDto: CreatePesquisadorRequest) {
    await this.cacheManager.del(PESQUISADORES_LIST_CACHE_KEY);
    const pesquisador = await this.prismaService.pesquisador.create({
      data: {
        ...createPesquisadoreDto,
        tipo: createPesquisadoreDto.tipo as TipoPesquisador | undefined,
        formacaoAcademica: createPesquisadoreDto.formacaoAcademica as
          | FormacaoAcademica
          | undefined,
      },
    });
    return toPesquisadorResponse(pesquisador);
  }

  async findAll(query?: FindAllPesquisadoresDto) {
    if (query?.q && !query.modoBusca) query = { ...query, modoBusca: 'textual' };
    validateSearchQuery(query);
    const nameQuery = query?.nome ?? (query?.modoBusca === 'textual' ? query.q : undefined);
    if (query && nameQuery && query.modoBusca !== 'semantica') {
      return findResearchersByName(this.prismaService, { ...query, nome: nameQuery });
    }
    const where: Prisma.PesquisadorWhereInput = {};
    const pagination = getPagination(query);
    const orderBy = [
      { [query?.ordenarPor ?? 'nome']: query?.ordem ?? 'asc' },
      { id: 'asc' as const },
    ] as Prisma.PesquisadorOrderByWithRelationInput[];
    const hasCustomOrdering = Boolean(query?.ordenarPor || query?.ordem);

    if (query) {
      if (query.formacaoAcademica) {
        where.formacaoAcademica = query.formacaoAcademica;
      }
      if (query.tipo) {
        where.tipo = query.tipo;
      }
      if (query.lattesId) {
        where.lattesId = query.lattesId;
      }
      if (query.orcidId) {
        where.orcidId = query.orcidId;
      }
      if (query.grupoPesquisaId || query.eLider !== undefined) {
        where.membrosGrupo = {
          some: {
            ...(query.grupoPesquisaId ? { grupoId: query.grupoPesquisaId } : {}),
            ...(query.eLider !== undefined ? { eLider: query.eLider } : {}),
          }
        };
      }
    }

    if (query?.modoBusca === 'semantica') {
      const pagination = getPagination(query);
      const filters = withoutSearchControls(query as unknown as Record<string, unknown>);
      const { results, totalItems } = await this.langchainService.semanticSearch(
        query.q!, 'PESQUISADOR', pagination.size, pagination.skip, filters,
      );
      const ids = results.map(result => result.sourceId);
      const pesquisadores = ids.length === 0 ? [] : await this.prismaService.pesquisador.findMany({
        where: { id: { in: ids } },
        omit: { criadoEm: true, atualizadoEm: true },
      });
      const pesquisadoresPorId = new Map(pesquisadores.map(pesquisador => [pesquisador.id, pesquisador]));

      return {
        data: ids.flatMap(id => {
          const pesquisador = pesquisadoresPorId.get(id);
          return pesquisador ? [toPesquisadorResponse(pesquisador)] : [];
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
        this.prismaService.pesquisador.findMany({
          where,
          skip: pagination.skip,
          take: pagination.take,
          orderBy,
          omit: { criadoEm: true, atualizadoEm: true },
        }),
        this.prismaService.pesquisador.count({ where }),
      ]);
      const totalPages = pagination.size === 0 ? 1 : Math.ceil(totalItems / pagination.size);

      return {
        data: data.map(toPesquisadorResponse),
        meta: {
          page: pagination.page,
          size: pagination.size,
          totalItems,
          totalPages,
        },
      };
    }

    return this.cacheManager.wrap(PESQUISADORES_LIST_CACHE_KEY, async () => {
      const [data, totalItems] = await Promise.all([
        this.prismaService.pesquisador.findMany({
          skip: pagination.skip,
          take: pagination.take,
          orderBy,
          omit: { criadoEm: true, atualizadoEm: true },
        }),
        this.prismaService.pesquisador.count(),
      ]);
      const totalPages = pagination.size === 0 ? 1 : Math.ceil(totalItems / pagination.size);

      return {
        data: data.map(toPesquisadorResponse),
        meta: {
          page: pagination.page,
          size: pagination.size,
          totalItems,
          totalPages,
        },
      };
    });
  }

  async findOne(id: string) {
    const pesquisador = await this.prismaService.pesquisador.findUnique({
      where: { id: id }, include: {
        producoes: {
          include: {
            producao: true
          }
        },
        membrosGrupo: {
          include: {
            grupoPesquisa: true
          }
        },
        areasConhecimento: {
          include: {
            area: true
          }
        }
      }
    });
    return pesquisador ? toPesquisadorResponse(pesquisador) : null;
  }

  async update(id: string, updatePesquisadoreDto: UpdatePesquisadorRequest) {
    await this.cacheManager.del(PESQUISADORES_LIST_CACHE_KEY);
    const pesquisador = await this.prismaService.pesquisador.update({
      where: { id: id },
      data: {
        ...updatePesquisadoreDto,
        tipo: updatePesquisadoreDto.tipo as TipoPesquisador | undefined,
        formacaoAcademica: updatePesquisadoreDto.formacaoAcademica as
          | FormacaoAcademica
          | undefined,
      },
    });
    return toPesquisadorResponse(pesquisador);
  }

  async remove(id: string) {
    const pesquisador = await this.prismaService.$transaction(async (tx) => {
      await tx.membroGrupo.deleteMany({
        where: { pesquisadorId: id },
      });

      await tx.membroLinhaPesquisa.deleteMany({
        where: { pesquisadorId: id },
      });

      await tx.producaoPesquisador.deleteMany({
        where: { pesquisadorId: id },
      });

      return await tx.pesquisador.delete({
        where: { id },
      });
    });

    await this.cacheManager.del(PESQUISADORES_LIST_CACHE_KEY);

    return toPesquisadorResponse(pesquisador);
  }
}
