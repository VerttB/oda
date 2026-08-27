import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateGruposPesquisaDto } from './dto/create-grupos-pesquisa.dto';
import { UpdateGruposPesquisaDto } from './dto/update-grupos-pesquisa.dto';
import { FindAllGruposPesquisaDto } from './dto/find-all-grupos-pesquisa.dto';
import { Prisma, TipoRelacaoGrupoInstituicao } from '@oda/database';
import { LangchainGatewayService } from '../langchain/langchain.service';
const GRUPOS_PESQUISA_LIST_CACHE_KEY = 'grupos-pesquisa:list';

const grupoPesquisaInclude = {
  instituicoes: { include: { instituicao: { include: { estado: true } } } },
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

  async create(createGruposPesquisa: CreateGruposPesquisaDto) {
    const { instituicoes, ...grupoData } = createGruposPesquisa;

    const grupo = await this.prismaService.$transaction(async (tx) => {
      const created = await tx.grupoPesquisa.create({ data: grupoData });
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
    return grupo;
  }

  async findAll(query?: FindAllGruposPesquisaDto) {
    const where: Prisma.GrupoPesquisaWhereInput = {};
    const andConditions: Prisma.GrupoPesquisaWhereInput[] = [];

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
          instituicoes: { some: { instituicaoId: query.instituicaoId } },
        });
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

    if (Object.keys(where).length > 0 || (query && (query.page > 1 || query.size !== 30))) {
      const [data, totalItems] = await Promise.all([
        this.prismaService.grupoPesquisa.findMany({
          where,
          skip: query?.skip,
          take: query?.take,
          include: grupoPesquisaInclude,
          omit: { criadoEm: true, atualizadoEm: true },
        }),
        this.prismaService.grupoPesquisa.count({ where }),
      ]);
      const size = query?.size ?? 30;
      const page = query?.page ?? 1;
      const totalPages = size === 0 ? 1 : Math.ceil(totalItems / size);

      return { data, meta: { page, size, totalItems, totalPages } };
    }

    return this.cacheManager.wrap(GRUPOS_PESQUISA_LIST_CACHE_KEY, async () => {
      const [data, totalItems] = await Promise.all([
        this.prismaService.grupoPesquisa.findMany({
          skip: query?.skip,
          take: query?.take,
          include: grupoPesquisaInclude,
          omit: { criadoEm: true, atualizadoEm: true },
        }),
        this.prismaService.grupoPesquisa.count(),
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

    const { results, totalItems } = await this.langchainService.semanticSearch(query, 'GRUPO_PESQUISA', sizeNum, offset);
    const ids = results.map(r => r.sourceId);

    if (ids.length === 0) {
      return { data: [], meta: { page: pageNum, size: sizeNum, totalItems: 0, totalPages: 0 } };
    }

    const grupos = await this.prismaService.grupoPesquisa.findMany({
      where: { id: { in: ids } },
      include: grupoPesquisaInclude,
    });

    const data = ids.map(id => grupos.find(g => g.id === id)).filter(Boolean);
    const totalPages = Math.ceil(totalItems / sizeNum);

    return { data, meta: { page: pageNum, size: sizeNum, totalItems, totalPages } };
  }

  async findOne(id: string) {
    return await this.prismaService.grupoPesquisa.findUniqueOrThrow({
      where: { id }, include: {
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
    })
  }

  async update(id: string, updateGruposPesquisa: UpdateGruposPesquisaDto) {
    const { instituicoes, ...grupoData } = updateGruposPesquisa;

    const grupo = await this.prismaService.$transaction(async (tx) => {
      const updated = await tx.grupoPesquisa.update({ where: { id }, data: grupoData });

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
    return grupo;
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
    return await this.prismaService.$transaction(async (tx) => {
      await tx.membroGrupo.deleteMany({ where: { grupoId: id } })
      await tx.grupoPesquisaInstituicao.deleteMany({ where: { grupoId: id } })
      await tx.pipelineLogItem.deleteMany({ where: { entidadeId: id } })
      return await tx.grupoPesquisa.delete({ where: { id } })

    })
  }

  private async syncGrupoInstituicoes(
    tx: Prisma.TransactionClient,
    grupoId: string,
    instituicoes?: CreateGruposPesquisaDto['instituicoes'],
    replace = false,
  ) {
    const desired = new Map<
      string,
      { tipoRelacao: TipoRelacaoGrupoInstituicao; unidade?: string | null }
    >();

    for (const vinculo of instituicoes ?? []) {
      desired.set(vinculo.instituicaoId, {
        tipoRelacao: vinculo.tipoRelacao ?? TipoRelacaoGrupoInstituicao.PARCEIRA,
        unidade: vinculo.unidade ?? null,
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
        },
        create: {
          grupoId,
          instituicaoId,
          tipoRelacao: vinculo.tipoRelacao,
          unidade: vinculo.unidade,
        },
      });
    }
  }
}
