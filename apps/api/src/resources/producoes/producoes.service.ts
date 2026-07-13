import { Inject, Injectable } from '@nestjs/common';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateProducoeDto } from './dto/create-producoe.dto';
import { UpdateProducoeDto } from './dto/update-producoe.dto';

const PRODUCOES_LIST_CACHE_KEY = 'producoes:list';

@Injectable()
export class ProducoesService {
  constructor(
    private readonly prismaService: PrismaService,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
  ) {}

  async create(createProducoeDto: CreateProducoeDto) {
    const { autores, palavraChaveIds, ...producaoData } = createProducoeDto;

    const producao = await this.prismaService.$transaction(async (tx) => {
      const producaoCriada = await tx.producao.create({
        data: producaoData,
      });

      if (autores?.length) {
        await tx.producaoPesquisador.createMany({
          data: autores.map((autor) => ({
            producaoId: producaoCriada.id,
            pesquisadorId: autor.pesquisadorId,
            ordemAutoria: autor.ordemAutoria,
          })),
        });
      }

      if (palavraChaveIds?.length) {
        await tx.producaoPalavraChave.createMany({
          data: palavraChaveIds.map((palavraChaveId) => ({
            producaoId: producaoCriada.id,
            palavraChaveId,
          })),
        });
      }

      return await tx.producao.findUniqueOrThrow({
        where: { id: producaoCriada.id },
        include: {
          autores: true,
          palavrasChave: true,
        },
      });
    });

    await this.cacheManager.del(PRODUCOES_LIST_CACHE_KEY);

    return producao;
  }

  async findAll() {
    return await this.cacheManager.wrap(
      PRODUCOES_LIST_CACHE_KEY,
      async () =>
        await this.prismaService.producao.findMany({
          omit: {
            criadoEm: true,
            atualizadoEm: true,
          },
        }),
    );
  }

  async findOne(id: string) {
    return await this.prismaService.producao.findUniqueOrThrow({
      where: { id },
      include: {
        autores: true,
        palavrasChave: true,
      },
    });
  }

  async update(id: string, updateProducoeDto: UpdateProducoeDto) {
    const { autores, palavraChaveIds, ...producaoData } = updateProducoeDto;

    const producao = await this.prismaService.$transaction(async (tx) => {
      await tx.producao.update({
        where: { id },
        data: producaoData,
      });

      if (autores !== undefined) {
        await tx.producaoPesquisador.deleteMany({
          where: { producaoId: id },
        });

        if (autores.length) {
          await tx.producaoPesquisador.createMany({
            data: autores.map((autor) => ({
              producaoId: id,
              pesquisadorId: autor.pesquisadorId,
              ordemAutoria: autor.ordemAutoria,
            })),
          });
        }
      }

      if (palavraChaveIds !== undefined) {
        await tx.producaoPalavraChave.deleteMany({
          where: { producaoId: id },
        });

        if (palavraChaveIds.length) {
          await tx.producaoPalavraChave.createMany({
            data: palavraChaveIds.map((palavraChaveId) => ({
              producaoId: id,
              palavraChaveId,
            })),
          });
        }
      }

      return await tx.producao.findUniqueOrThrow({
        where: { id },
        include: {
          autores: true,
          palavrasChave: true,
        },
      });
    });

    await this.cacheManager.del(PRODUCOES_LIST_CACHE_KEY);

    return producao;
  }

  async remove(id: string) {
    const producao = await this.prismaService.$transaction(async (tx) => {
      await tx.producaoPesquisador.deleteMany({
        where: { producaoId: id },
      });

      await tx.producaoPalavraChave.deleteMany({
        where: { producaoId: id },
      });

      return await tx.producao.delete({ where: { id } });
    });

    await this.cacheManager.del(PRODUCOES_LIST_CACHE_KEY);

    return producao;
  }
}
