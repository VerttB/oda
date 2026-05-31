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

  async create(createGruposPesquisaDto: CreateGruposPesquisaDto) {
    await this.cacheManager.del(GRUPOS_PESQUISA_LIST_CACHE_KEY);
    return await this.prismaService.grupoPesquisa.create({data: createGruposPesquisaDto})
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

  findOne(id: string) {
    return `This action returns a #${id} gruposPesquisa`;
  }

  async update(id: string, updateGruposPesquisaDto: UpdateGruposPesquisaDto) {
    await this.cacheManager.del(GRUPOS_PESQUISA_LIST_CACHE_KEY);
    return `This action updates a #${id} gruposPesquisa`;
  }

  async remove(id: string) {
    await this.cacheManager.del(GRUPOS_PESQUISA_LIST_CACHE_KEY);
    return `This action removes a #${id} gruposPesquisa`;
  }
}
