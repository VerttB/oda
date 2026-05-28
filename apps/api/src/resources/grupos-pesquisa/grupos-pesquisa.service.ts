import { Injectable } from '@nestjs/common';
import type { UUID } from '@/common/types/uuid.type';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateGruposPesquisaDto } from './dto/create-grupos-pesquisa.dto';
import { UpdateGruposPesquisaDto } from './dto/update-grupos-pesquisa.dto';

@Injectable()
export class GruposPesquisaService {
  constructor(private readonly prisma: PrismaService) {}
  create(createGruposPesquisaDto: CreateGruposPesquisaDto) {
    return 'This action adds a new gruposPesquisa';
  }

  findAll() {
    return this.prisma.grupoPesquisa.findMany({
      omit: {
        criadoEm: true,
        atualizadoEm: true,
      },
    });
  }

  findOne(id: UUID) {
    return `This action returns a #${id} gruposPesquisa`;
  }

  update(id: UUID, updateGruposPesquisaDto: UpdateGruposPesquisaDto) {
    return `This action updates a #${id} gruposPesquisa`;
  }

  remove(id: UUID) {
    return `This action removes a #${id} gruposPesquisa`;
  }
}
