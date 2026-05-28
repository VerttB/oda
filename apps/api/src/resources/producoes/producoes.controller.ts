import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseUUIDPipe,
} from '@nestjs/common';
import type { UUID } from '@/common/types/uuid.type';
import { ProducoesService } from './producoes.service';
import { CreateProducoeDto } from './dto/create-producoe.dto';
import { UpdateProducoeDto } from './dto/update-producoe.dto';

@Controller('producoes')
export class ProducoesController {
  constructor(private readonly producoesService: ProducoesService) {}

  @Post()
  create(@Body() createProducoeDto: CreateProducoeDto) {
    return this.producoesService.create(createProducoeDto);
  }

  @Get()
  findAll() {
    return this.producoesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: UUID) {
    return this.producoesService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: UUID,
    @Body() updateProducoeDto: UpdateProducoeDto,
  ) {
    return this.producoesService.update(id, updateProducoeDto);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: UUID) {
    return this.producoesService.remove(id);
  }
}
