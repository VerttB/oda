import { Inject, Injectable } from '@nestjs/common';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
import { PrismaService } from '@/prisma/prisma.service';
import { CreatePesquisadoreDto } from './dto/create-pesquisadore.dto';
import { UpdatePesquisadoreDto } from './dto/update-pesquisadore.dto';

const PESQUISADORES_LIST_CACHE_KEY = 'pesquisadores:list';

@Injectable()
export class PesquisadoresService {
  constructor(
    private readonly prismaService: PrismaService,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
  ) {}

  async create(createPesquisadoreDto: CreatePesquisadoreDto) {
    await this.cacheManager.del(PESQUISADORES_LIST_CACHE_KEY);
    return await this.prismaService.pesquisador.create({data: createPesquisadoreDto})
  }

  async findAll() {
    return this.cacheManager.wrap(PESQUISADORES_LIST_CACHE_KEY, () =>
      this.prismaService.pesquisador.findMany({
        omit: {
          criadoEm: true,
          atualizadoEm: true,
        },
      }),
    );
  }

  findOne(id: string) {
    return this.prismaService.pesquisador.findUnique({ where: { id: id}, include: {
      producoes: true,
      membrosGrupo: {
        include: {
          grupoPesquisa: true
        }
      }
    }})
  }

  async update(id: string, updatePesquisadoreDto: UpdatePesquisadoreDto) {
    await this.cacheManager.del(PESQUISADORES_LIST_CACHE_KEY);
    return await this.prismaService.pesquisador.update({where: {id: id}, data: updatePesquisadoreDto},)
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
