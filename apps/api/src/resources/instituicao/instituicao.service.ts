import { Inject, Injectable } from '@nestjs/common';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateInstituicaoDto } from './dto/create-instituicao.dto';
import { UpdateInstituicaoDto } from './dto/update-instituicao.dto';
import { FindAllInstituicaoDto } from './dto/find-all-instituicao.dto';
import { Prisma } from '@oda/database';
import { InstituicaoResponseSchema } from '@oda/shared-types';

const INSTITUICOES_LIST_CACHE_KEY = 'instituicoes:list:v2';

const getPagination = (query?: { page?: number; size?: number }) => {
  const page = query?.page ?? 1;
  const size = query?.size ?? 30;

  return {
    page,
    size,
    skip: (page - 1) * size,
    take: size === 0 ? undefined : size,
  };
};

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

type InstituicaoInput = Omit<Prisma.InstituicaoGetPayload<{ include: typeof instituicaoInclude }>, 'criadoEm' | 'atualizadoEm'>;

export function toInstituicaoResponse(instituicao: InstituicaoInput) {
  return InstituicaoResponseSchema.parse({
    id: instituicao.id,
    nome: instituicao.nome,
    sigla: instituicao.sigla,
    estado: instituicao.estado,
    gruposPesquisa: instituicao.gruposPesquisaVinculos.map(vinculo => ({
      ...vinculo.grupoPesquisa,
      tipoRelacao: vinculo.tipoRelacao,
      unidade: vinculo.unidade !== null || vinculo.unidadeUf !== null
        ? { nome: vinculo.unidade, uf: vinculo.unidadeUf } : null,
    })),
    totalGruposPesquisa: instituicao._count.gruposPesquisaVinculos,
  });
}

@Injectable()
export class InstituicaoService {
  constructor(
    private readonly prismaService: PrismaService,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
  ) {}

  async create(createInstituicaoDto: CreateInstituicaoDto) {
    await this.cacheManager.del(INSTITUICOES_LIST_CACHE_KEY);
    const instituicao = await this.prismaService.instituicao.create({
      data: createInstituicaoDto,
      include: instituicaoInclude,
    });
    return toInstituicaoResponse(instituicao);
  }

  async findAll(query?: FindAllInstituicaoDto) {
    const where: Prisma.InstituicaoWhereInput = {};
    const pagination = getPagination(query);

    if (query?.nome) {
      where.nome = { contains: query.nome, mode: 'insensitive' };
    }
    if (query?.estadoId) where.estadoId = query.estadoId;
    if (query?.uf) where.estado = { sigla: { equals: query.uf, mode: 'insensitive' } };

    if (Object.keys(where).length > 0 || pagination.page > 1 || pagination.size !== 30) {
      const [data, totalItems] = await Promise.all([
        this.prismaService.instituicao.findMany({
          where,
          skip: pagination.skip,
          take: pagination.take,
          include: instituicaoInclude,
          omit: { criadoEm: true, atualizadoEm: true },
        }),
        this.prismaService.instituicao.count({ where }),
      ]);
      const totalPages = pagination.size === 0 ? 1 : Math.ceil(totalItems / pagination.size);

      return { data: data.map(toInstituicaoResponse), meta: { page: pagination.page, size: pagination.size, totalItems, totalPages } };
    }

    return this.cacheManager.wrap(INSTITUICOES_LIST_CACHE_KEY, async () => {
      const [data, totalItems] = await Promise.all([
        this.prismaService.instituicao.findMany({
          skip: pagination.skip,
          take: pagination.take,
          include: instituicaoInclude,
          omit: { criadoEm: true, atualizadoEm: true },
        }),
        this.prismaService.instituicao.count(),
      ]);
      const totalPages = pagination.size === 0 ? 1 : Math.ceil(totalItems / pagination.size);

      return { data: data.map(toInstituicaoResponse), meta: { page: pagination.page, size: pagination.size, totalItems, totalPages } };
    });
  }

  async findOne(id: string) {
    const instituicao = await this.prismaService.instituicao.findUniqueOrThrow({
      where: { id },
      include: instituicaoInclude,
    });
    return toInstituicaoResponse(instituicao);
  }

  async update(id: string, updateInstituicaoDto: UpdateInstituicaoDto) {
    await this.cacheManager.del(INSTITUICOES_LIST_CACHE_KEY);
    const instituicao = await this.prismaService.instituicao.update({
      where: { id },
      data: updateInstituicaoDto,
      include: instituicaoInclude,
    });
    return toInstituicaoResponse(instituicao);
  }


  async remove(id: string) {
    await this.cacheManager.del(INSTITUICOES_LIST_CACHE_KEY);
    return await this.prismaService.instituicao.delete({where: { id }})
  }
}
