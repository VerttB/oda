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
import { InstituicaoService } from './instituicao.service';
import { CreateInstituicaoDto } from './dto/create-instituicao.dto';
import { UpdateInstituicaoDto } from './dto/update-instituicao.dto';

@Controller('instituicao')
export class InstituicaoController {
  constructor(private readonly instituicaoService: InstituicaoService) {}

  @Post()
  create(@Body() createInstituicaoDto: CreateInstituicaoDto) {
    return this.instituicaoService.create(createInstituicaoDto);
  }

  @Get()
  findAll() {
    return this.instituicaoService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: UUID) {
    return this.instituicaoService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: UUID,
    @Body() updateInstituicaoDto: UpdateInstituicaoDto,
  ) {
    return this.instituicaoService.update(id, updateInstituicaoDto);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: UUID) {
    return this.instituicaoService.remove(id);
  }
}
