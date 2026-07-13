import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import { LinhaPesquisaService } from './linha-pesquisa.service';
import { CreateLinhaPesquisaDto } from './dto/create-linha-pesquisa.dto';
import { UpdateLinhaPesquisaDto } from './dto/update-linha-pesquisa.dto';
import { FindAllLinhaPesquisaDto } from './dto/find-all-linha-pesquisa.dto';

@Controller('linha-pesquisa')
export class LinhaPesquisaController {
  constructor(private readonly linhaPesquisaService: LinhaPesquisaService) {}

  @Post()
  create(@Body() createLinhaPesquisaDto: CreateLinhaPesquisaDto) {
    return this.linhaPesquisaService.create(createLinhaPesquisaDto);
  }

  @Get()
  findAll(@Query() query: FindAllLinhaPesquisaDto) {
    return this.linhaPesquisaService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.linhaPesquisaService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateLinhaPesquisaDto: UpdateLinhaPesquisaDto,
  ) {
    return this.linhaPesquisaService.update(id, updateLinhaPesquisaDto);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.linhaPesquisaService.remove(id);
  }
}
