import { Injectable } from '@nestjs/common';
import type { UUID } from '@/common/types/uuid.type';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateInstituicaoDto } from './dto/create-instituicao.dto';
import { UpdateInstituicaoDto } from './dto/update-instituicao.dto';

@Injectable()
export class InstituicaoService {
  constructor(private readonly prisma: PrismaService) {}
  create(createInstituicaoDto: CreateInstituicaoDto) {
    return 'This action adds a new instituicao';
  }

  findAll() {
    return this.prisma.instituicao.findMany({
      omit: {
        criadoEm: true,
        atualizadoEm: true,
      },
    });
  }

  findOne(id: UUID) {
    return `This action returns a #${id} instituicao`;
  }

  update(id: UUID, updateInstituicaoDto: UpdateInstituicaoDto) {
    return `This action updates a #${id} instituicao`;
  }

  remove(id: UUID) {
    return `This action removes a #${id} instituicao`;
  }
}
