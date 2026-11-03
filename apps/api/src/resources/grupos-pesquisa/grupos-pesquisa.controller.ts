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
  UseGuards,
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
import { AiAccessGuard } from '@/common/rate-limit/ai-access.guard';

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
  @UseGuards(AiAccessGuard)
  @ApiOperation({ summary: 'Lista grupos de pesquisa' })
  @ApiQuery({ name: 'q', required: false, type: String, example: 'inteligência artificial na educação' })
  @ApiQuery({ name: 'modoBusca', required: false, enum: ['textual', 'semantica'] })
  @ZodResponse({ status: 200, type: PaginatedGruposPesquisaResponseDto })
  async findAll(@Query() query: FindAllGruposPesquisaDto) {
    return  await this.gruposPesquisaService.findAll(query);
  }

  @Get('busca-semantica')
  @UseGuards(AiAccessGuard)
  @ApiOperation({ summary: 'Busca grupos semanticamente (compatibilidade)', deprecated: true })
  @ApiQuery({ name: 'q', required: true, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'size', required: false, type: Number })
  @ZodResponse({ status: 200, type: PaginatedGruposPesquisaResponseDto })
  buscaSemantica(@Query() query: FindAllGruposPesquisaDto) {
    return this.gruposPesquisaService.findAll({ ...query, modoBusca: 'semantica' });
  }

  @Get('simcc')
  @UseGuards(AiAccessGuard)
  @ApiOperation({ summary: 'Lista grupos com sede nas instituições do SIMCC' })
  @ApiQuery({ name: 'q', required: false, type: String })
  @ApiQuery({ name: 'modoBusca', required: false, enum: ['textual', 'semantica'] })
  @ZodResponse({ status: 200, type: PaginatedGruposPesquisaResponseDto })
  findSimcc(@Query() query: FindAllGruposPesquisaDto) {
    return this.gruposPesquisaService.findSimcc(query);
  }

  @Get(':id/pesquisadores')
  @UseGuards(AiAccessGuard)
  @ApiOperation({
    summary: 'Lista pesquisadores vinculados a um grupo de pesquisa',
    description: 'A busca textual em nome ou q exige todos os termos do nome em qualquer ordem, ignorando acentos e caixa.',
  })
  @ApiQuery({ name: 'q', required: false, type: String })
  @ApiQuery({ name: 'modoBusca', required: false, enum: ['textual', 'semantica'] })
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
