import { Inject, Injectable } from '@nestjs/common';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateGruposPesquisaDto } from './dto/create-grupos-pesquisa.dto';
import { UpdateGruposPesquisaDto } from './dto/update-grupos-pesquisa.dto';
import { FindAllGruposPesquisaDto } from './dto/find-all-grupos-pesquisa.dto';
import { GrupoPesquisaWhereInput } from '../../../generated/prisma/models';
const GRUPOS_PESQUISA_LIST_CACHE_KEY = 'grupos-pesquisa:list';

@Injectable()
export class GruposPesquisaService {
  constructor(
    private readonly prismaService: PrismaService,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
  ) { }

  async create(createGruposPesquisa: CreateGruposPesquisaDto) {
    await this.cacheManager.del(GRUPOS_PESQUISA_LIST_CACHE_KEY);
    return await this.prismaService.grupoPesquisa.create({ data: createGruposPesquisa })
  }

  async findAll(query?: FindAllGruposPesquisaDto) {
    const where: GrupoPesquisaWhereInput = {};

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
      if (query.instituicao) {
        where.instituicaoId = query.instituicao;
      }
      if (query.uf) {
        where.instituicao = {
          ufId: query.uf,
        };
      }
    }

    // Bypass cache if filters or pagination are present (except default pagination)
    if (Object.keys(where).length > 0 || (query && (query.page > 1 || query.size !== 30))) {
      return this.prismaService.grupoPesquisa.findMany({
        where,
        skip: query?.skip,
        take: query?.take,
        
      });
    }

    return this.cacheManager.wrap(GRUPOS_PESQUISA_LIST_CACHE_KEY, () =>
      this.prismaService.grupoPesquisa.findMany({
        skip: query?.skip,
        take: query?.take,
        omit: {
          criadoEm: true,
          atualizadoEm: true,
        },
      }),
    );
  }

  async findOne(id: string) {
    return await this.prismaService.grupoPesquisa.findUniqueOrThrow({
      where: { id }, include: {
        areaConhecimento: true,
        linhasPesquisa: true,
        instituicao: true,
        membros: true,
      }
    })
  }

  async update(id: string, updateGruposPesquisa: UpdateGruposPesquisaDto) {
    await this.cacheManager.del(GRUPOS_PESQUISA_LIST_CACHE_KEY);
    return await this.prismaService.grupoPesquisa.update({ where: { id }, data: updateGruposPesquisa })
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
      await tx.logColetaGrupo.deleteMany({ where: { grupoId: id } })
      return await tx.grupoPesquisa.delete({ where: { id } })

    })
  }
}
