import { Inject, Injectable } from '@nestjs/common';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
import { PrismaService } from '@/prisma/prisma.service';
import { CreatePesquisadoreDto } from './dto/create-pesquisadore.dto';
import { UpdatePesquisadoreDto } from './dto/update-pesquisadore.dto';
import { FindAllPesquisadoresDto } from './dto/find-all-pesquisadores.dto';
import { PesquisadorWhereInput } from '../../../generated/prisma/models';
const PESQUISADORES_LIST_CACHE_KEY = 'pesquisadores:list';

@Injectable()
export class PesquisadoresService {
  constructor(
    private readonly prismaService: PrismaService,
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
    const where: PesquisadorWhereInput = {};

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
    }

    // Bypass cache if filters or pagination are present (except default pagination)
    if (Object.keys(where).length > 0 || (query && (query.page! > 1 || query.size !== 30))) {
      return this.prismaService.pesquisador.findMany({
        where,
        skip: query?.skip,
        take: query?.take,
        omit: {
          criadoEm: true,
          atualizadoEm: true,
        },
      });
    }

    return this.cacheManager.wrap(PESQUISADORES_LIST_CACHE_KEY, () =>
      this.prismaService.pesquisador.findMany({
        skip: query?.skip,
        take: query?.take,
        omit: {
          criadoEm: true,
          atualizadoEm: true,
        },
      }),
    );
  }

  findOne(id: string) {
    return this.prismaService.pesquisador.findUnique({
      where: { id: id }, include: {
        producoes: true,
        membrosGrupo: {
          include: {
            grupoPesquisa: true
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
