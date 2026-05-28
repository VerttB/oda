import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { GruposPesquisaService } from './grupos-pesquisa.service';
import { CreateGruposPesquisaDto } from './dto/create-grupos-pesquisa.dto';
import { UpdateGruposPesquisaDto } from './dto/update-grupos-pesquisa.dto';

@Controller('grupos-pesquisa')
export class GruposPesquisaController {
  constructor(private readonly gruposPesquisaService: GruposPesquisaService) {}

  @Post()
  create(@Body() createGruposPesquisaDto: CreateGruposPesquisaDto) {
    return this.gruposPesquisaService.create(createGruposPesquisaDto);
  }

  @Get()
  findAll() {
    return this.gruposPesquisaService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.gruposPesquisaService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateGruposPesquisaDto: UpdateGruposPesquisaDto,
  ) {
    return this.gruposPesquisaService.update(id, updateGruposPesquisaDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.gruposPesquisaService.remove(id);
  }
}
