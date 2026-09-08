import { PrismaService } from '@/prisma/prisma.service';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
import { Inject, Injectable } from '@nestjs/common';
import { CreateAreaConhecimentoDto } from './dto/create-area-conhecimento.dto';
import { UpdateAreaConhecimentoDto } from './dto/update-area-conhecimento.dto';
import { FindAllAreaConhecimentoDto } from './dto/find-all-area-conhecimento.dto';
import { Prisma } from '@oda/database';

const AREA_CONHECIMENTO_LIST_KEY = 'area-conhecimento:list:v2';

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

const areaConhecimentoResumoSelect = {
  id: true,
  nome: true,
  nomeNormalizado: true,
  tipo: true,
  areaPaiId: true,
} satisfies Prisma.AreaConhecimentoSelect;

const areaConhecimentoDetalheSelect = {
  ...areaConhecimentoResumoSelect,
  areaPai: { select: areaConhecimentoResumoSelect },
  subareas: {
    select: areaConhecimentoResumoSelect,
    orderBy: { nome: 'asc' },
  },
} satisfies Prisma.AreaConhecimentoSelect;

@Injectable()
export class AreaConhecimentoService {
     constructor(
        private readonly prismaService: PrismaService,
        @Inject(CACHE_MANAGER)
        private readonly cacheManager: Cache,
      ) {}
      
      async create(createAreaConhecimento: CreateAreaConhecimentoDto) {
        await this.cacheManager.del(AREA_CONHECIMENTO_LIST_KEY);
        const nomeNormalizado = this.normalizeString(createAreaConhecimento.nome);
        return await this.prismaService.areaConhecimento.create({
          data: {
            ...createAreaConhecimento,
            nomeNormalizado,
          },
          select: areaConhecimentoResumoSelect,
        });
      }
    
      async findAll(query?: FindAllAreaConhecimentoDto) {
        const where: Prisma.AreaConhecimentoWhereInput = {};
        const pagination = getPagination(query);

        if (query?.nome) {
          where.nome = { contains: query.nome, mode: 'insensitive' };
        }
        if (query?.tipo) {
          where.tipo = query.tipo;
        }
        if (query?.areaPaiId) {
          where.areaPaiId = query.areaPaiId;
        }

        if (Object.keys(where).length > 0 || pagination.page > 1 || pagination.size !== 30) {
          const [data, totalItems] = await Promise.all([
            this.prismaService.areaConhecimento.findMany({
              where,
              skip: pagination.skip,
              take: pagination.take,
              select: areaConhecimentoResumoSelect,
              orderBy: { nome: 'asc' },
            }),
            this.prismaService.areaConhecimento.count({ where }),
          ]);
          const totalPages = pagination.size === 0 ? 1 : Math.ceil(totalItems / pagination.size);

          return { data, meta: { page: pagination.page, size: pagination.size, totalItems, totalPages } };
        }

        return this.cacheManager.wrap(AREA_CONHECIMENTO_LIST_KEY, async () => {
          const [data, totalItems] = await Promise.all([
            this.prismaService.areaConhecimento.findMany({
              skip: pagination.skip,
              take: pagination.take,
              select: areaConhecimentoResumoSelect,
              orderBy: { nome: 'asc' },
            }),
            this.prismaService.areaConhecimento.count(),
          ]);
          const totalPages = pagination.size === 0 ? 1 : Math.ceil(totalItems / pagination.size);

          return { data, meta: { page: pagination.page, size: pagination.size, totalItems, totalPages } };
        });
      }
      
      
      async findById(id: string) {
        return await this.prismaService.areaConhecimento.findUnique({
          where: { id },
          select: areaConhecimentoDetalheSelect,
        })
      }
    

      async update(id: string, updateAreaConhecimento: UpdateAreaConhecimentoDto){
        const updateData: any = { ...updateAreaConhecimento };
        if (updateAreaConhecimento.nome) {
          updateData.nomeNormalizado = this.normalizeString(updateAreaConhecimento.nome);
        }
        const area = await this.prismaService.areaConhecimento.update({
          where: { id },
          data: updateData,
          select: areaConhecimentoResumoSelect,
        });
        await this.cacheManager.del(AREA_CONHECIMENTO_LIST_KEY);
        return area;
      }

      private normalizeString(str: string): string {
        if (!str) return '';
        const stopwords = new Set([
            'de', 'do', 'da', 'dos', 'das', 'em', 'um', 'uma', 'uns', 'umas', 
            'para', 'com', 'por', 'sem', 'sob', 'sobre', 'a', 'o', 'as', 'os', 'e',
            'of', 'the', 'in', 'on', 'at', 'for', 'with', 'by', 'a', 'an', 'and', 'to', 'from', 'about'
        ]);
        const words = str
            .trim()
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9\s]/g, ' ')
            .replace(/\s+/g, ' ')
            .split(' ');
        return words
            .filter(word => word.length > 0 && !stopwords.has(word))
            .join('-');
      }
}
