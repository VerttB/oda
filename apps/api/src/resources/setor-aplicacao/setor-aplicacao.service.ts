import { PrismaService } from '@/prisma/prisma.service';
import { Inject, Injectable } from '@nestjs/common';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
import { CreateSetorAplicacaoDto } from './dto/create-setor-aplicacao.dto';
import { UpdateSetorAplicacaoDto } from './dto/update-setor-aplicacao.dto';

const SETOR_APLICACAO_LIST_CACHE_KEY = "setoraplicacao:list"
@Injectable()
export class SetorAplicacaoService {
    constructor(private readonly prismaService: PrismaService, @Inject(CACHE_MANAGER) private cacheManager: Cache){}

    async create(createSetorAplicacao: CreateSetorAplicacaoDto){
        return this.prismaService.setorAplicacao.create({data: createSetorAplicacao})
    }
    async findAll(){
        return this.cacheManager.wrap(SETOR_APLICACAO_LIST_CACHE_KEY, async () => 
        this.prismaService.setorAplicacao.findMany(
            { 
                omit: {
                    criadoEm: true,
                    atualizadoEm: true,
                }
            }
        )
        )

    }
    async findById(id: string){

        return this.prismaService.setorAplicacao.findUniqueOrThrow({
            where: {
                id
            }
        })
    }

    async findByNome(nome: string){
        return await this.prismaService.setorAplicacao.findUniqueOrThrow({ where: { nomeNormalizado: nome}})
    }
    async update(id: string, updateSetorAplicacao: UpdateSetorAplicacaoDto){
        return await this.prismaService.setorAplicacao.update({ 
            where: { id },
            data: updateSetorAplicacao
        })
    }
    async delete(){}
}
