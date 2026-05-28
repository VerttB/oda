import { Injectable } from '@nestjs/common';
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

  findOne(id: string) {
    return `This action returns a #${id} linhaPesquisa`;
  }

  update(id: string, updateLinhaPesquisaDto: UpdateLinhaPesquisaDto) {
    return `This action updates a #${id} linhaPesquisa`;
  }

  remove(id: string) {
    return `This action removes a #${id} linhaPesquisa`;
  }
}
