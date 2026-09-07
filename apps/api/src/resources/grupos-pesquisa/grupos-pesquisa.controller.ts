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
import {
  type CreateGruposPesquisaRequest,
  CreateGruposPesquisaRequestSchema,
  type UpdateGruposPesquisaRequest,
  UpdateGruposPesquisaRequestSchema,
} from '@oda/shared-types';
import { ZodValidationPipe } from '@/common/pipes/zod-validation.pipe';
import { GruposPesquisaService } from './grupos-pesquisa.service';
import { FindAllGruposPesquisaDto } from './dto/find-all-grupos-pesquisa.dto';

import { FindAllPesquisadoresDto } from '../pesquisadores/dto/find-all-pesquisadores.dto';
import { PesquisadoresService } from '../pesquisadores/pesquisadores.service';
import { MetricasService } from '../metricas/metricas.service';

import { FindPesquisadoresByGrupoQueryDto } from './dto/find-pesquisadores-by-grupo-query.dto';

@Controller('grupos-pesquisa')
export class GruposPesquisaController {
  constructor(
    private readonly gruposPesquisaService: GruposPesquisaService,
    private readonly pesquisadoresService: PesquisadoresService,
    private readonly metricasService: MetricasService,
  ) {}

  @Post()
  create(
    @Body(new ZodValidationPipe(CreateGruposPesquisaRequestSchema))
    createGruposPesquisaDto: CreateGruposPesquisaRequest,
  ) {
    return this.gruposPesquisaService.create(createGruposPesquisaDto);
  }

  @Get()
  async findAll(@Query() query: FindAllGruposPesquisaDto) {
    return  await this.gruposPesquisaService.findAll(query);
  }

  @Get('busca-semantica')
  buscaSemantica(
    @Query('q') query: string, 
    @Query('page') page?: number, 
    @Query('size') size?: number
  ) {
    return this.gruposPesquisaService.buscaSemantica(query, page, size);
  }

  @Get(':id/pesquisadores')
  findPesquisadores(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: FindPesquisadoresByGrupoQueryDto
  ) {
    const serviceQuery = query as any as FindAllPesquisadoresDto;
    serviceQuery.grupoPesquisaId = id;
    return this.pesquisadoresService.findAll(serviceQuery);
  }

  @Get(':id/metricas')
  findMetricas(@Param('id', ParseUUIDPipe) id: string) {
    return this.metricasService.findMetricasGrupoPesquisa(id);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.gruposPesquisaService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdateGruposPesquisaRequestSchema))
    updateGruposPesquisaDto: UpdateGruposPesquisaRequest,
  ) {
    return this.gruposPesquisaService.update(id, updateGruposPesquisaDto);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.gruposPesquisaService.remove(id);
  }
}
