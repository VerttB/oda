import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
import { PrismaService } from '@/prisma/prisma.service';
import {
  CreateGruposPesquisaRequest,
  UpdateGruposPesquisaRequest,
} from '@oda/shared-types';
import { FindAllGruposPesquisaDto } from './dto/find-all-grupos-pesquisa.dto';
import { Prisma, Situacao, TipoRelacaoGrupoInstituicao } from '@oda/database';
import { LangchainGatewayService } from '../langchain/langchain.service';
import { toGrupoPesquisaResponse } from './grupos-pesquisa.response';
const GRUPOS_PESQUISA_LIST_CACHE_KEY = 'grupos-pesquisa:list:v2';

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

const grupoPesquisaInclude = {
  instituicoes: { include: { instituicao: { include: { estado: true } } } },
  areaConhecimento: true,
  areasConhecimento: { include: { area: true } },
} satisfies Prisma.GrupoPesquisaInclude;

@Injectable()
export class GruposPesquisaService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly langchainService: LangchainGatewayService,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
  ) { }

  async create(createGruposPesquisa: CreateGruposPesquisaRequest) {
    const { instituicoes, situacao, ...grupoData } = createGruposPesquisa;

    const grupo = await this.prismaService.$transaction(async (tx) => {
      const created = await tx.grupoPesquisa.create({
        data: {
          ...grupoData,
          situacao: situacao as Situacao | undefined,
        },
      });
      await this.syncGrupoInstituicoes(
        tx,
        created.id,
        instituicoes,
      );

      return tx.grupoPesquisa.findUniqueOrThrow({
        where: { id: created.id },
        include: grupoPesquisaInclude,
      });
    });

    await this.cacheManager.del(GRUPOS_PESQUISA_LIST_CACHE_KEY);
    return toGrupoPesquisaResponse(grupo);
  }

  async findAll(query?: FindAllGruposPesquisaDto) {
    const where: Prisma.GrupoPesquisaWhereInput = {};
    const andConditions: Prisma.GrupoPesquisaWhereInput[] = [];
    const pagination = getPagination(query);

    if (query) {
      if (query.situacao) {
        where.situacao = query.situacao;
      }
      if (query.nome) {
        where.nome = { contains: query.nome, mode: 'insensitive' };
      }
      if (query.anoFormacao) {
        where.anoFormacao = query.anoFormacao;
      }
      if (query.instituicaoId) {
        andConditions.push({
          instituicoes: {
            some: {
              instituicaoId: query.instituicaoId,
              tipoRelacao: TipoRelacaoGrupoInstituicao.SEDE,
            },
          },
        });
      }
      if (query.areaConhecimentoId) {
        where.areaConhecimentoId = query.areaConhecimentoId;
      }
      if (query.estadoId) {
        andConditions.push({
          instituicoes: { some: { instituicao: { estadoId: query.estadoId } } },
        });
      }
      if (query.cidade) {
        where.cidade = { contains: query.cidade, mode: 'insensitive' };
      }
      if (query.uf) {
        where.uf = { equals: query.uf, mode: 'insensitive' };
      }
    }
    if (andConditions.length > 0) {
      where.AND = andConditions;
    }

    if (Object.keys(where).length > 0 || pagination.page > 1 || pagination.size !== 30) {
      const [data, totalItems] = await Promise.all([
        this.prismaService.grupoPesquisa.findMany({
          where,
          skip: pagination.skip,
          take: pagination.take,
          include: grupoPesquisaInclude,
          omit: { criadoEm: true, atualizadoEm: true },
        }),
        this.prismaService.grupoPesquisa.count({ where }),
      ]);
      const totalPages = pagination.size === 0 ? 1 : Math.ceil(totalItems / pagination.size);

      return {
        data: data.map(toGrupoPesquisaResponse),
        meta: {
          page: pagination.page,
          size: pagination.size,
          totalItems,
          totalPages,
        },
      };
    }

    return this.cacheManager.wrap(GRUPOS_PESQUISA_LIST_CACHE_KEY, async () => {
      const [data, totalItems] = await Promise.all([
        this.prismaService.grupoPesquisa.findMany({
          skip: pagination.skip,
          take: pagination.take,
          include: grupoPesquisaInclude,
          omit: { criadoEm: true, atualizadoEm: true },
        }),
        this.prismaService.grupoPesquisa.count(),
      ]);
      const totalPages = pagination.size === 0 ? 1 : Math.ceil(totalItems / pagination.size);

      return {
        data: data.map(toGrupoPesquisaResponse),
        meta: {
          page: pagination.page,
          size: pagination.size,
          totalItems,
          totalPages,
        },
      };
    });
  }

  async buscaSemantica(query: string, page?: number, size?: number) {
    const pageNum = page ? Number(page) : 1;
    const sizeNum = size ? Number(size) : 30;
    const offset = (pageNum - 1) * sizeNum;

    const { results, totalItems } = await this.langchainService.semanticSearch(query, 'GRUPO_PESQUISA', sizeNum, offset);
    const ids = results.map(r => r.sourceId);

    if (ids.length === 0) {
      return { data: [], meta: { page: pageNum, size: sizeNum, totalItems: 0, totalPages: 0 } };
    }

    const grupos = await this.prismaService.grupoPesquisa.findMany({
      where: { id: { in: ids } },
      include: grupoPesquisaInclude,
    });

    const data = ids.flatMap(id => {
      const grupo = grupos.find(g => g.id === id);
      return grupo ? [toGrupoPesquisaResponse(grupo)] : [];
    });
    const totalPages = Math.ceil(totalItems / sizeNum);

    return { data, meta: { page: pageNum, size: sizeNum, totalItems, totalPages } };
  }

  async findOne(id: string) {
    const grupo = await this.prismaService.grupoPesquisa.findUniqueOrThrow({
      where: { id }, include: {
        areaConhecimento: true,
        areasConhecimento: {
          include: {
            area: true
          }
        },
        linhasPesquisa: true,
        instituicoes: { include: { instituicao: { include: { estado: true } } } },
        membros: {
          include: {
            pesquisador: true
          }
        },
      }
    });
    return toGrupoPesquisaResponse(grupo);
  }

  async update(id: string, updateGruposPesquisa: UpdateGruposPesquisaRequest) {
    const { instituicoes, situacao, ...grupoData } = updateGruposPesquisa;

    const grupo = await this.prismaService.$transaction(async (tx) => {
      const updated = await tx.grupoPesquisa.update({
        where: { id },
        data: {
          ...grupoData,
          situacao: situacao as Situacao | undefined,
        },
      });

      if (instituicoes !== undefined) {
        await this.syncGrupoInstituicoes(
          tx,
          updated.id,
          instituicoes,
          instituicoes !== undefined,
        );
      }

      return tx.grupoPesquisa.findUniqueOrThrow({
        where: { id },
        include: grupoPesquisaInclude,
      });
    });

    await this.cacheManager.del(GRUPOS_PESQUISA_LIST_CACHE_KEY);
    return toGrupoPesquisaResponse(grupo);
  }


  async addMember(grupoId: string, pesquisadorId: string) {

    return this.prismaService.membroGrupo.create({
      data: {
        grupoId, pesquisadorId,
      }
    })
  }
  async addManyMembers(grupoId: string, pesquisadoresId: string[]) {
    return await this.prismaService.membroGrupo.createMany({
      data: pesquisadoresId.map((id) => ({
        grupoId,
        pesquisadorId: id
      }))
    })
  }


  async removeMember(grupoId: string, pesquisadorId: string) {
    return await this.prismaService.membroGrupo.deleteMany({ where: { grupoId, pesquisadorId } })

  }

  async removeManyMembers(grupoId: string, pesquisadoresId: string) { }

  async remove(id: string) {
    await this.cacheManager.del(GRUPOS_PESQUISA_LIST_CACHE_KEY);
    const grupo = await this.prismaService.$transaction(async (tx) => {
      await tx.membroGrupo.deleteMany({ where: { grupoId: id } })
      await tx.grupoPesquisaInstituicao.deleteMany({ where: { grupoId: id } })
      await tx.pipelineLogItem.deleteMany({ where: { entidadeId: id } })
      return await tx.grupoPesquisa.delete({ where: { id } })

    });
    return toGrupoPesquisaResponse(grupo);
  }

  private async syncGrupoInstituicoes(
    tx: Prisma.TransactionClient,
    grupoId: string,
    instituicoes?: CreateGruposPesquisaRequest['instituicoes'],
    replace = false,
  ) {
    const desired = new Map<
      string,
      {
        tipoRelacao: TipoRelacaoGrupoInstituicao;
        unidade?: string | null;
        unidadeUf?: string | null;
      }
    >();

    for (const vinculo of instituicoes ?? []) {
      desired.set(vinculo.instituicaoId, {
        tipoRelacao:
          (vinculo.tipoRelacao as TipoRelacaoGrupoInstituicao | undefined) ??
          TipoRelacaoGrupoInstituicao.PARCEIRA,
        unidade: vinculo.unidade ?? null,
        unidadeUf: vinculo.unidadeUf ?? null,
      });
    }

    if (desired.size === 0) {
      throw new BadRequestException('Informe ao menos uma instituicao vinculada ao grupo de pesquisa.');
    }

    if (!Array.from(desired.values()).some((vinculo) => vinculo.tipoRelacao === TipoRelacaoGrupoInstituicao.SEDE)) {
      const firstInstituicaoId = desired.keys().next().value;
      if (firstInstituicaoId) {
        const current = desired.get(firstInstituicaoId);
        desired.set(firstInstituicaoId, {
          tipoRelacao: TipoRelacaoGrupoInstituicao.SEDE,
          unidade: current?.unidade ?? null,
          unidadeUf: current?.unidadeUf ?? null,
        });
      }
    }

    if (replace) {
      await tx.grupoPesquisaInstituicao.deleteMany({
        where: {
          grupoId,
          instituicaoId: { notIn: Array.from(desired.keys()) },
        },
      });
    }

    for (const [instituicaoId, vinculo] of desired.entries()) {
      await tx.grupoPesquisaInstituicao.upsert({
        where: {
          grupoId_instituicaoId: {
            grupoId,
            instituicaoId,
          },
        },
        update: {
          tipoRelacao: vinculo.tipoRelacao,
          unidade: vinculo.unidade,
          unidadeUf: vinculo.unidadeUf,
        },
        create: {
          grupoId,
          instituicaoId,
          tipoRelacao: vinculo.tipoRelacao,
          unidade: vinculo.unidade,
          unidadeUf: vinculo.unidadeUf,
        },
      });
    }
  }
}
