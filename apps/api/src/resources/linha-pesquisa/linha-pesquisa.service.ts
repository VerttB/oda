import { Inject, Injectable } from '@nestjs/common';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateLinhaPesquisaDto } from './dto/create-linha-pesquisa.dto';
import { UpdateLinhaPesquisaDto } from './dto/update-linha-pesquisa.dto';
import { FindAllLinhaPesquisaDto } from './dto/find-all-linha-pesquisa.dto';
import { Prisma } from '../../../generated/prisma';

const LINHAS_PESQUISA_LIST_CACHE_KEY = 'linhas-pesquisa:list';

@Injectable()
export class LinhaPesquisaService {
  constructor(
    private readonly prismaService: PrismaService,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
  ) {}

  async create(createLinhaPesquisaDto: CreateLinhaPesquisaDto) {
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
    const where: Prisma.LinhaPesquisaWhereInput = {};

    if (query) {
      if (query.grupo) {
        where.grupoId = query.grupo;
      }
      if (query.nome) {
        where.titulo = { contains: query.nome, mode: 'insensitive' };
      }
    }

    // Bypass cache if filters or pagination are present (except default pagination)
    if (Object.keys(where).length > 0 || (query && (query.page > 1 || query.size !== 30))) {
      return await this.prismaService.linhaPesquisa.findMany({
        where,
        skip: query?.skip,
        take: query?.take,
        omit: {
          criadoEm: true,
          atualizadoEm: true,
        },
      });
    }

    return await this.cacheManager.wrap(
      LINHAS_PESQUISA_LIST_CACHE_KEY,
      async () =>
        await this.prismaService.linhaPesquisa.findMany({
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
    return await this.prismaService.linhaPesquisa.findUniqueOrThrow({
      where: { id },
      include: {
        membros: true,
        palavrasChave: true,
        setoresAplicacao: true,
      },
    });
  }

  async update(id: string, updateLinhaPesquisaDto: UpdateLinhaPesquisaDto) {
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
