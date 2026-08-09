import { Inject, Injectable } from '@nestjs/common';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
import { PrismaService } from '@/prisma/prisma.service';
import { CreatePesquisadoreDto } from './dto/create-pesquisadore.dto';
import { UpdatePesquisadoreDto } from './dto/update-pesquisadore.dto';
import { FindAllPesquisadoresDto } from './dto/find-all-pesquisadores.dto';
import { Prisma } from '@oda/database';
import { LangchainGatewayService } from '../langchain/langchain.service';
const PESQUISADORES_LIST_CACHE_KEY = 'pesquisadores:list';

@Injectable()
export class PesquisadoresService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly langchainService: LangchainGatewayService,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
  ) { }

  async create(createPesquisadoreDto: CreatePesquisadoreDto) {
    await this.cacheManager.del(PESQUISADORES_LIST_CACHE_KEY);
    return await this.prismaService.pesquisador.create({
      data: createPesquisadoreDto,
    });
  }

  async findAll(query?: FindAllPesquisadoresDto) {
    const where: Prisma.PesquisadorWhereInput = {};

    if (query) {
      if (query.nome) {
        where.nome = { contains: query.nome, mode: 'insensitive' };
      }
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

    if (Object.keys(where).length > 0 || (query && (query.page! > 1 || query.size !== 30))) {
      const [data, totalItems] = await Promise.all([
        this.prismaService.pesquisador.findMany({
          where,
          skip: query?.skip,
          take: query?.take,
          omit: { criadoEm: true, atualizadoEm: true },
        }),
        this.prismaService.pesquisador.count({ where }),
      ]);
      const size = query?.size ?? 30;
      const page = query?.page ?? 1;
      const totalPages = size === 0 ? 1 : Math.ceil(totalItems / size);

      return { data, meta: { page, size, totalItems, totalPages } };
    }

    return this.cacheManager.wrap(PESQUISADORES_LIST_CACHE_KEY, async () => {
      const [data, totalItems] = await Promise.all([
        this.prismaService.pesquisador.findMany({
          skip: query?.skip,
          take: query?.take,
          omit: { criadoEm: true, atualizadoEm: true },
        }),
        this.prismaService.pesquisador.count(),
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

    const { results, totalItems } = await this.langchainService.semanticSearch(query, 'PESQUISADOR', sizeNum, offset);
    const ids = results.map(r => r.sourceId);

    if (ids.length === 0) {
      return { data: [], meta: { page: pageNum, size: sizeNum, totalItems: 0, totalPages: 0 } };
    }

    const pesquisadores = await this.prismaService.pesquisador.findMany({
      where: { id: { in: ids } },
      include: {
        areasConhecimento: { include: { area: true } }
      }
    });

    const data = ids.map(id => pesquisadores.find(p => p.id === id)).filter(Boolean);
    const totalPages = Math.ceil(totalItems / sizeNum);

    return { data, meta: { page: pageNum, size: sizeNum, totalItems, totalPages } };
  }

  findOne(id: string) {
    return this.prismaService.pesquisador.findUnique({
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
    })
  }

  async update(id: string, updatePesquisadoreDto: UpdatePesquisadoreDto) {
    await this.cacheManager.del(PESQUISADORES_LIST_CACHE_KEY);
    return await this.prismaService.pesquisador.update({ where: { id: id }, data: updatePesquisadoreDto },)
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

    return pesquisador;
  }
}
