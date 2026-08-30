import { Inject, Injectable } from '@nestjs/common';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateInstituicaoDto } from './dto/create-instituicao.dto';
import { UpdateInstituicaoDto } from './dto/update-instituicao.dto';
import { FindAllInstituicaoDto } from './dto/find-all-instituicao.dto';
import { Prisma } from '@oda/database';

const INSTITUICOES_LIST_CACHE_KEY = 'instituicoes:list';

const instituicaoInclude = {
  estado: true,
  gruposPesquisaVinculos: {
    include: {
      grupoPesquisa: {
        select: {
          id: true,
          dgpId: true,
          nome: true,
          situacao: true,
          uf: true,
          cidade: true,
        },
      },
    },
  },
  _count: { select: { gruposPesquisaVinculos: true } },
} satisfies Prisma.InstituicaoInclude;

@Injectable()
export class InstituicaoService {
  constructor(
    private readonly prismaService: PrismaService,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
  ) {}

  async create(createInstituicaoDto: CreateInstituicaoDto) {
    await this.cacheManager.del(INSTITUICOES_LIST_CACHE_KEY);
    return await this.prismaService.instituicao.create({
      data: createInstituicaoDto,
      include: instituicaoInclude,
    })
  }

  async findAll(query?: FindAllInstituicaoDto) {
    const where: Prisma.InstituicaoWhereInput = {};

    if (query?.nome) {
      where.nome = { contains: query.nome, mode: 'insensitive' };
    }

    if (Object.keys(where).length > 0 || (query && (query.page > 1 || query.size !== 30))) {
      const [data, totalItems] = await Promise.all([
        this.prismaService.instituicao.findMany({
          where,
          skip: query?.skip,
          take: query?.take,
          include: instituicaoInclude,
          omit: { criadoEm: true, atualizadoEm: true },
        }),
        this.prismaService.instituicao.count({ where }),
      ]);
      const size = query?.size ?? 30;
      const page = query?.page ?? 1;
      const totalPages = size === 0 ? 1 : Math.ceil(totalItems / size);

      return { data, meta: { page, size, totalItems, totalPages } };
    }

    return this.cacheManager.wrap(INSTITUICOES_LIST_CACHE_KEY, async () => {
      const [data, totalItems] = await Promise.all([
        this.prismaService.instituicao.findMany({
          skip: query?.skip,
          take: query?.take,
          include: instituicaoInclude,
          omit: { criadoEm: true, atualizadoEm: true },
        }),
        this.prismaService.instituicao.count(),
      ]);
      const size = query?.size ?? 30;
      const page = query?.page ?? 1;
      const totalPages = size === 0 ? 1 : Math.ceil(totalItems / size);

      return { data, meta: { page, size, totalItems, totalPages } };
    });
  }

  async findOne(id: string) {
    return await this.prismaService.instituicao.findUniqueOrThrow({
      where: { id },
      include: instituicaoInclude,
    })
  }

  async update(id: string, updateInstituicaoDto: UpdateInstituicaoDto) {
    await this.cacheManager.del(INSTITUICOES_LIST_CACHE_KEY);
    return await this.prismaService.instituicao.update({
      where: { id },
      data: updateInstituicaoDto,
      include: instituicaoInclude,
    })
  }


  async remove(id: string) {
    await this.cacheManager.del(INSTITUICOES_LIST_CACHE_KEY);
    return await this.prismaService.instituicao.delete({where: { id }})
  }
}
