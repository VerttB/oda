import { Injectable } from '@nestjs/common';
import { CreateProducoeDto } from './dto/create-producoe.dto';
import { UpdateProducoeDto } from './dto/update-producoe.dto';

@Injectable()
export class ProducoesService {
  create(createProducoeDto: CreateProducoeDto) {
    return 'This action adds a new producoe';
  }

  findAll() {
    return `This action returns all producoes`;
  }

  findOne(id: string) {
    return `This action returns a #${id} producoe`;
  }

  update(id: string, updateProducoeDto: UpdateProducoeDto) {
    return `This action updates a #${id} producoe`;
  }

  remove(id: string) {
    return `This action removes a #${id} producoe`;
  }
}
