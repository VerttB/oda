import { Inject, Injectable } from '@nestjs/common';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateGruposPesquisaDto } from './dto/create-grupos-pesquisa.dto';
import { UpdateGruposPesquisaDto } from './dto/update-grupos-pesquisa.dto';

const GRUPOS_PESQUISA_LIST_CACHE_KEY = 'grupos-pesquisa:list';

@Injectable()
export class GruposPesquisaService {
  constructor(
    private readonly prismaService: PrismaService,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
  ) {}

  async create(createGruposPesquisa: CreateGruposPesquisaDto) {
    await this.cacheManager.del(GRUPOS_PESQUISA_LIST_CACHE_KEY);
    return await this.prismaService.grupoPesquisa.create({data: createGruposPesquisa})
  }

  async findAll() {
    return this.cacheManager.wrap(GRUPOS_PESQUISA_LIST_CACHE_KEY, () =>
      this.prismaService.grupoPesquisa.findMany({
        omit: {
          criadoEm: true,
          atualizadoEm: true,
        },
      }),
    );
  }

  async findOne(id: string) {
    return await this.prismaService.grupoPesquisa.findUniqueOrThrow({ where: { id }, include: {
      areaConhecimento: true,
      linhasPesquisa: true,
      instituicao: true,
      membros: true,
    }})
  }

  async update(id: string, updateGruposPesquisa: UpdateGruposPesquisaDto) {
    await this.cacheManager.del(GRUPOS_PESQUISA_LIST_CACHE_KEY);
    return await this.prismaService.grupoPesquisa.update({ where: { id }, data: updateGruposPesquisa})
  }


  async addMember(grupoId: string, pesquisadorId: string ){

    return this.prismaService.membroGrupo.create({ data: {
      grupoId, pesquisadorId,
    }})
  }
  async addManyMembers(grupoId: string, pesquisadoresId: string[]){
    return await this.prismaService.membroGrupo.createMany({ data: pesquisadoresId.map((id) => ({
      grupoId,
      pesquisadorId: id
    }))})
  }


  async removeMember(grupoId: string, pesquisadorId: string){
      return await this.prismaService.membroGrupo.deleteMany({ where: { grupoId, pesquisadorId}})
    
  }

  async removeManyMembers(grupoId: string, pesquisadoresId: string){}
  
  async remove(id: string) {
    await this.cacheManager.del(GRUPOS_PESQUISA_LIST_CACHE_KEY);
    return await this.prismaService.$transaction( async (tx) => {
      await tx.membroGrupo.deleteMany({ where: { grupoId: id}})
      await tx.logColetaGrupo.deleteMany({ where: { grupoId: id}})
      return await tx.grupoPesquisa.delete({ where: { id }})
      
    })
  }
}
