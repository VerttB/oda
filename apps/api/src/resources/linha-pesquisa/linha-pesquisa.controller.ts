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
import { LinhaPesquisaService } from './linha-pesquisa.service';
import { CreateLinhaPesquisaDto } from './dto/create-linha-pesquisa.dto';
import { UpdateLinhaPesquisaDto } from './dto/update-linha-pesquisa.dto';

@Controller('linha-pesquisa')
export class LinhaPesquisaController {
  constructor(private readonly linhaPesquisaService: LinhaPesquisaService) {}

  @Post()
  create(@Body() createLinhaPesquisaDto: CreateLinhaPesquisaDto) {
    return this.linhaPesquisaService.create(createLinhaPesquisaDto);
  }

  @Get()
  findAll() {
    return this.linhaPesquisaService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: UUID) {
    return this.linhaPesquisaService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: UUID,
    @Body() updateLinhaPesquisaDto: UpdateLinhaPesquisaDto,
  ) {
    return this.linhaPesquisaService.update(id, updateLinhaPesquisaDto);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: UUID) {
    return this.linhaPesquisaService.remove(id);
  }
}
