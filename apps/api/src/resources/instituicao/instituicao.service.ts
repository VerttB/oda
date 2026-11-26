import { Inject, Injectable } from '@nestjs/common';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateInstituicaoDto } from './dto/create-instituicao.dto';
import { UpdateInstituicaoDto } from './dto/update-instituicao.dto';
import { FindAllInstituicaoDto } from './dto/find-all-instituicao.dto';
import { Prisma } from '@oda/database';
import { InstituicaoResponseSchema, getPagination, buildPaginationMeta } from '@oda/shared-types';
import { searchNamePage } from '@/common/search/name-page';

const INSTITUICOES_LIST_CACHE_KEY = 'instituicoes:list:v3';
const nameSortColumns = { nome: Prisma.sql`i.nome`, sigla: Prisma.sql`i.sigla` };

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
    imageUrl: instituicao.imageUrl ?? null,
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
    if (query?.nome) {
      const filters: Prisma.Sql[] = [];
      if (query.estadoId) filters.push(Prisma.sql`i.estado_id = ${query.estadoId}`);
      if (query.uf) filters.push(Prisma.sql`EXISTS (
        SELECT 1 FROM public.estado e WHERE e.id = i.estado_id AND lower(e.sigla) = lower(${query.uf})
      )`);
      const { data, meta } = await searchNamePage(this.prismaService, query, query.nome, {
        from: Prisma.sql`public.instituicao i`, id: Prisma.sql`i.id`,
        name: Prisma.sql`concat_ws(' ', i.nome, i.sigla)`,
        orderBy: nameSortColumns[query.ordenarPor ?? 'nome'], filters,
      }, (tx, ids) => tx.instituicao.findMany({
        where: { id: { in: ids } }, include: instituicaoInclude,
        omit: { criadoEm: true, atualizadoEm: true },
      }));
      return { data: data.map(toInstituicaoResponse), meta };
    }

    const where: Prisma.InstituicaoWhereInput = {};
    const pagination = getPagination(query);
    const orderBy = [
      { [query?.ordenarPor ?? 'nome']: query?.ordem ?? 'asc' },
      { id: 'asc' as const },
    ] as Prisma.InstituicaoOrderByWithRelationInput[];
    const hasCustomOrdering = Boolean(query?.ordenarPor || query?.ordem);

    if (query?.estadoId) where.estadoId = query.estadoId;
    if (query?.uf) where.estado = { sigla: { equals: query.uf, mode: 'insensitive' } };

    if (Object.keys(where).length > 0 || !pagination.isDefault || hasCustomOrdering) {
      const [data, totalItems] = await Promise.all([
        this.prismaService.instituicao.findMany({
          where,
          skip: pagination.skip,
          take: pagination.take,
          orderBy,
          include: instituicaoInclude,
          omit: { criadoEm: true, atualizadoEm: true },
        }),
        this.prismaService.instituicao.count({ where }),
      ]);
      return { data: data.map(toInstituicaoResponse), meta: buildPaginationMeta(pagination, totalItems) };
    }

    return this.cacheManager.wrap(INSTITUICOES_LIST_CACHE_KEY, async () => {
      const [data, totalItems] = await Promise.all([
        this.prismaService.instituicao.findMany({
          skip: pagination.skip,
          take: pagination.take,
          orderBy,
          include: instituicaoInclude,
          omit: { criadoEm: true, atualizadoEm: true },
        }),
        this.prismaService.instituicao.count(),
      ]);
      return { data: data.map(toInstituicaoResponse), meta: buildPaginationMeta(pagination, totalItems) };
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
