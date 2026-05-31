import { PrismaService } from '@/prisma/prisma.service';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
import { Inject, Injectable } from '@nestjs/common';

const PALAVRA_CHAVE_LIST_KEY = 'palavrachave:list';

@Injectable()
export class PalavraChaveService {
     constructor(
        private readonly prismaService: PrismaService,
        @Inject(CACHE_MANAGER)
        private readonly cacheManager: Cache,
      ) {}
      
      async create(createPalavraChaveDto: any) {
        await this.cacheManager.del(PALAVRA_CHAVE_LIST_KEY);
        return await this.prismaService.palavraChave.create({data: createPalavraChaveDto})
      }
    
      async findAll() {
        return this.cacheManager.wrap(PALAVRA_CHAVE_LIST_KEY, () =>
          this.prismaService.palavraChave.findMany({
            omit: {
              criadoEm: true,
              atualizadoEm: true,
            },
          }),
        );
      }
    
      findOne(id: string) {
        return this.prismaService.palavraChave.findUnique({ where: { id: id}})
      }
    
      async findByTermo(termo: string) {

        return this.prismaService.palavraChave.findUniqueOrThrow({ where: { termoNormalizado: termo}})
      }
}
