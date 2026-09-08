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
  ApiBadRequestResponse,
  ApiBody,
  ApiNotFoundResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { ZodResponse } from 'nestjs-zod';
import { GruposPesquisaService } from './grupos-pesquisa.service';
import { FindAllGruposPesquisaDto } from './dto/find-all-grupos-pesquisa.dto';

import { FindAllPesquisadoresDto } from '../pesquisadores/dto/find-all-pesquisadores.dto';
import { PesquisadoresService } from '../pesquisadores/pesquisadores.service';
import { MetricasService } from '../metricas/metricas.service';

import { FindPesquisadoresByGrupoQueryDto } from './dto/find-pesquisadores-by-grupo-query.dto';
import { CreateGruposPesquisaDto } from './dto/create-grupos-pesquisa.dto';
import { UpdateGruposPesquisaDto } from './dto/update-grupos-pesquisa.dto';
import {
  GrupoPesquisaMetricasResponseDto,
  GrupoPesquisaResponseDto,
  PaginatedGruposPesquisaResponseDto,
  PaginatedPesquisadoresGrupoResponseDto,
} from './dto/response-grupos-pesquisa.dto';

@ApiTags('grupos-pesquisa')
@Controller('grupos-pesquisa')
export class GruposPesquisaController {
  constructor(
    private readonly gruposPesquisaService: GruposPesquisaService,
    private readonly pesquisadoresService: PesquisadoresService,
    private readonly metricasService: MetricasService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Cria um grupo de pesquisa' })
  @ApiBody({ type: CreateGruposPesquisaDto })
  @ZodResponse({ status: 201, type: GrupoPesquisaResponseDto })
  @ApiBadRequestResponse({ description: 'Dados inválidos para criação do grupo de pesquisa.' })
  create(
    @Body() createGruposPesquisaDto: CreateGruposPesquisaDto,
  ) {
    return this.gruposPesquisaService.create(createGruposPesquisaDto);
  }

  @Get()
  @ApiOperation({ summary: 'Lista grupos de pesquisa' })
  @ZodResponse({ status: 200, type: PaginatedGruposPesquisaResponseDto })
  async findAll(@Query() query: FindAllGruposPesquisaDto) {
    return  await this.gruposPesquisaService.findAll(query);
  }

  @Get('busca-semantica')
  @ApiOperation({ summary: 'Busca grupos de pesquisa por similaridade semântica' })
  @ApiQuery({ name: 'q', type: String, required: true, example: 'inteligência artificial na educação' })
  @ApiQuery({ name: 'page', type: Number, required: false, example: 1 })
  @ApiQuery({ name: 'size', type: Number, required: false, example: 30 })
  @ZodResponse({ status: 200, type: PaginatedGruposPesquisaResponseDto })
  buscaSemantica(
    @Query('q') query: string, 
    @Query('page') page?: number, 
    @Query('size') size?: number
  ) {
    return this.gruposPesquisaService.buscaSemantica(query, page, size);
  }

  @Get(':id/pesquisadores')
  @ApiOperation({ summary: 'Lista pesquisadores vinculados a um grupo de pesquisa' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ZodResponse({ status: 200, type: PaginatedPesquisadoresGrupoResponseDto })
  @ApiBadRequestResponse({ description: 'ID do grupo inválido.' })
  findPesquisadores(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: FindPesquisadoresByGrupoQueryDto
  ) {
    const serviceQuery = query as any as FindAllPesquisadoresDto;
    serviceQuery.grupoPesquisaId = id;
    return this.pesquisadoresService.findAll(serviceQuery);
  }

  @Get(':id/metricas')
  @ApiOperation({ summary: 'Retorna métricas consolidadas de um grupo de pesquisa' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ZodResponse({ status: 200, type: GrupoPesquisaMetricasResponseDto })
  @ApiBadRequestResponse({ description: 'ID do grupo inválido.' })
  @ApiNotFoundResponse({ description: 'Grupo de pesquisa não encontrado.' })
  findMetricas(@Param('id', ParseUUIDPipe) id: string) {
    return this.metricasService.findMetricasGrupoPesquisa(id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Busca um grupo de pesquisa pelo ID' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ZodResponse({ status: 200, type: GrupoPesquisaResponseDto })
  @ApiBadRequestResponse({ description: 'ID do grupo inválido.' })
  @ApiNotFoundResponse({ description: 'Grupo de pesquisa não encontrado.' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.gruposPesquisaService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualiza um grupo de pesquisa' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiBody({ type: UpdateGruposPesquisaDto })
  @ZodResponse({ status: 200, type: GrupoPesquisaResponseDto })
  @ApiBadRequestResponse({ description: 'ID ou dados inválidos para atualização do grupo.' })
  @ApiNotFoundResponse({ description: 'Grupo de pesquisa não encontrado.' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateGruposPesquisaDto: UpdateGruposPesquisaDto,
  ) {
    return this.gruposPesquisaService.update(id, updateGruposPesquisaDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove um grupo de pesquisa' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ZodResponse({ status: 200, type: GrupoPesquisaResponseDto })
  @ApiBadRequestResponse({ description: 'ID do grupo inválido.' })
  @ApiNotFoundResponse({ description: 'Grupo de pesquisa não encontrado.' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.gruposPesquisaService.remove(id);
  }
}
