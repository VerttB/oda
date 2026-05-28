import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { CreatePesquisadoreDto } from './dto/create-pesquisadore.dto';
import { UpdatePesquisadoreDto } from './dto/update-pesquisadore.dto';

@Injectable()
export class PesquisadoresService {
  constructor(private readonly prisma: PrismaService) {}
  create(createPesquisadoreDto: CreatePesquisadoreDto) {
    return 'This action adds a new pesquisadore';
  }

  findAll() {
    return this.prisma.pesquisador.findMany({
      omit: {
        criadoEm: true,
        atualizadoEm: true,
      },
    });
  }

  findOne(id: string) {
    return `This action returns a #${id} pesquisadore`;
  }

  update(id: string, updatePesquisadoreDto: UpdatePesquisadoreDto) {
    return `This action updates a #${id} pesquisadore`;
  }

  remove(id: string) {
    return `This action removes a #${id} pesquisadore`;
  }
}
