import { PrismaService } from '@/prisma/prisma.service';
import { Inject, Injectable } from '@nestjs/common';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
import { CreateUfDto } from './dto/create-uf.dto';
import { UpdateUfDto } from './dto/update-uf.dto';

const UF_LIST_CACHE_KEY = "uf:list"
@Injectable()
export class UfService {
    constructor(private readonly prismaService: PrismaService, @Inject(CACHE_MANAGER) private cacheManager: Cache){}

    async create(createUfDto: CreateUfDto){
        return this.prismaService.uf.create({data: createUfDto})
    }
    async findAll(){
        return this.cacheManager.wrap(UF_LIST_CACHE_KEY, async () => 
        this.prismaService.uf.findMany(
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
        return this.prismaService.uf.findUniqueOrThrow({
            where: {
                id
            }
        })
    }

    async findBySigla(sigla: string){
        return await this.prismaService.uf.findUniqueOrThrow({ where: { sigla}})
    }
    async update(id: string, updateUf: UpdateUfDto){
        return await this.prismaService.uf.update({ where: { id }, data: updateUf})
    }
    async delete(){}
}
