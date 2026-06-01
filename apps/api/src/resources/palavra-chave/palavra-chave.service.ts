import { PrismaService } from '@/prisma/prisma.service';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
import { Inject, Injectable } from '@nestjs/common';
import { CreatePalavraChaveDto } from './dto/create-palavra-chave.dto';
import { UpdatePalavraChaveDto } from './dto/update-palavra-chave.dto';

const PALAVRA_CHAVE_LIST_KEY = 'palavrachave:list';

@Injectable()
export class PalavraChaveService {
     constructor(
        private readonly prismaService: PrismaService,
        @Inject(CACHE_MANAGER)
        private readonly cacheManager: Cache,
      ) {}
      
      async create(createPalavraChaveDto: CreatePalavraChaveDto) {

        const termoNormalizado = createPalavraChaveDto.termo.trim().toLowerCase()
        await this.cacheManager.del(PALAVRA_CHAVE_LIST_KEY);

        return await this.prismaService.palavraChave.create({data: {termo: createPalavraChaveDto.termo, termoNormalizado}})
      }
    
      async findAll() {
        return this.cacheManager.wrap(PALAVRA_CHAVE_LIST_KEY,async () =>
          await this.prismaService.palavraChave.findMany({
            omit: {
              criadoEm: true,
              atualizadoEm: true,
            },
          }),
        );
      }
      
      
      async findById(id: string) {
        return await this.prismaService.palavraChave.findUnique({ where: { id: id}})
      }
    
      async findByTermo(termo: string) {

        return await this.prismaService.palavraChave.findUniqueOrThrow({ where: { termoNormalizado: termo}})
      }

      async update(id: string, updatePalavraChave: UpdatePalavraChaveDto){
        return await this.prismaService.palavraChave.update({ where: { id}, data: updatePalavraChave})
      }
}
