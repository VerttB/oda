import { Injectable } from '@nestjs/common';
import type { UUID } from '@/common/types/uuid.type';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateLinhaPesquisaDto } from './dto/create-linha-pesquisa.dto';
import { UpdateLinhaPesquisaDto } from './dto/update-linha-pesquisa.dto';

@Injectable()
export class LinhaPesquisaService {
  constructor(private readonly prisma: PrismaService) {}
  create(createLinhaPesquisaDto: CreateLinhaPesquisaDto) {
    return 'This action adds a new linhaPesquisa';
  }

  findAll() {
    return this.prisma.linhaPesquisa.findMany({
      omit: {
        criadoEm: true,
        atualizadoEm: true,
      },
    });
  }

  findOne(id: UUID) {
    return `This action returns a #${id} linhaPesquisa`;
  }

  update(id: UUID, updateLinhaPesquisaDto: UpdateLinhaPesquisaDto) {
    return `This action updates a #${id} linhaPesquisa`;
  }

  remove(id: UUID) {
    return `This action removes a #${id} linhaPesquisa`;
  }
}
