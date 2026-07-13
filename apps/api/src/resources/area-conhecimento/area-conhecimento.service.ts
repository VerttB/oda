import { PrismaService } from '@/prisma/prisma.service';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
import { Inject, Injectable } from '@nestjs/common';
import { CreateAreaConhecimentoDto } from './dto/create-area-conhecimento.dto';
import { UpdateAreaConhecimentoDto } from './dto/update-area-conhecimento.dto';

const AREA_CONHECIMENTO_LIST_KEY = 'areaconhecimento:list';

@Injectable()
export class AreaConhecimentoService {
     constructor(
        private readonly prismaService: PrismaService,
        @Inject(CACHE_MANAGER)
        private readonly cacheManager: Cache,
      ) {}
      
      async create(createAreaConhecimento: CreateAreaConhecimentoDto) {
        await this.cacheManager.del(AREA_CONHECIMENTO_LIST_KEY);
        return await this.prismaService.areaConhecimento.create({data: createAreaConhecimento})
      }
    
      async findAll() {
        return this.cacheManager.wrap(AREA_CONHECIMENTO_LIST_KEY,async () =>
          await this.prismaService.areaConhecimento.findMany({
            omit: {
              criadoEm: true,
              atualizadoEm: true,
            },
          }),
        );
      }
      
      
      async findById(id: string) {
        return await this.prismaService.areaConhecimento.findUnique({ where: { id: id}})
      }
    

      async update(id: string, updateAreaConhecimento: UpdateAreaConhecimentoDto){
        return await this.prismaService.areaConhecimento.update({ where: { id}, data: updateAreaConhecimento})
      }
}
