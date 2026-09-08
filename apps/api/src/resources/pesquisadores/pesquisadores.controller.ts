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
  ApiOkResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { ZodResponse, ZodSerializerDto } from 'nestjs-zod';
import { PesquisadorResponseSchema } from '@oda/shared-types';
import { PesquisadoresService } from './pesquisadores.service';
import { FindAllPesquisadoresDto } from './dto/find-all-pesquisadores.dto';
import { ProducoesService } from '../producoes/producoes.service';
import { FindAllProducoesDto } from '../producoes/dto/find-all-producoes.dto';
import { MetricasService } from '../metricas/metricas.service';

import { FindProducoesByPesquisadorQueryDto } from './dto/find-producoes-by-pesquisador-query.dto';
import { CreatePesquisadoreDto } from './dto/create-pesquisadore.dto';
import { UpdatePesquisadoreDto } from './dto/update-pesquisadore.dto';
import {
  PaginatedPesquisadorResponseDto,
  PaginatedProducoesPesquisadorResponseDto,
  PesquisadorMetricasResponseDto,
  PesquisadorResponseDto,
} from './dto/response-pesquisadores.dto';

@ApiTags('pesquisadores')
@Controller('pesquisadores')
export class PesquisadoresController {
  constructor(
    private readonly pesquisadoresService: PesquisadoresService, 
    private readonly producoesService: ProducoesService,
    private readonly metricasService: MetricasService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Cria um pesquisador' })
  @ApiBody({ type: CreatePesquisadoreDto })
  @ZodResponse({ status: 201, type: PesquisadorResponseDto })
  @ApiBadRequestResponse({ description: 'Dados inválidos para criação do pesquisador.' })
  create(@Body() createPesquisadoreDto: CreatePesquisadoreDto) {
    return this.pesquisadoresService.create(createPesquisadoreDto);
  }

  @Get()
  @ApiOperation({ summary: 'Lista pesquisadores' })
  @ZodResponse({ status: 200, type: PaginatedPesquisadorResponseDto })
  findAll(@Query() query: FindAllPesquisadoresDto) {
    return this.pesquisadoresService.findAll(query);
  }

  @Get('busca-semantica')
  @ApiOperation({ summary: 'Busca pesquisadores por similaridade semântica' })
  @ApiQuery({ name: 'q', type: String, required: true })
  @ApiQuery({ name: 'page', type: Number, required: false })
  @ApiQuery({ name: 'size', type: Number, required: false })
  @ZodResponse({ status: 200, type: PaginatedPesquisadorResponseDto })
  buscaSemantica(
    @Query('q') query: string, 
    @Query('page') page?: number, 
    @Query('size') size?: number
  ) {
    return this.pesquisadoresService.buscaSemantica(query, page, size);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Busca um pesquisador pelo ID' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiOkResponse({
    schema: {
      nullable: true,
      allOf: [{ $ref: getSchemaPath(PesquisadorResponseDto) }],
    },
  })
  @ZodSerializerDto(PesquisadorResponseSchema.nullable())
  @ApiBadRequestResponse({ description: 'ID do pesquisador inválido.' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.pesquisadoresService.findOne(id);
  }

  @Get(':id/metricas')
  @ApiOperation({ summary: 'Retorna métricas consolidadas de um pesquisador' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ZodResponse({ status: 200, type: PesquisadorMetricasResponseDto })
  @ApiBadRequestResponse({ description: 'ID do pesquisador inválido.' })
  @ApiNotFoundResponse({ description: 'Pesquisador não encontrado.' })
  findMetricas(@Param('id', ParseUUIDPipe) id: string) {
    return this.metricasService.findMetricasPesquisador(id);
  }

  @Get(':id/producoes')
  @ApiOperation({ summary: 'Lista produções vinculadas a um pesquisador' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ZodResponse({ status: 200, type: PaginatedProducoesPesquisadorResponseDto })
  @ApiBadRequestResponse({ description: 'ID do pesquisador inválido.' })
  findProductions(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: FindProducoesByPesquisadorQueryDto
  ) {
    const serviceQuery = query as any as FindAllProducoesDto;
    serviceQuery.pesquisadorId = id;
    return this.producoesService.findAll(serviceQuery);
  }
  @Patch(':id')
  @ApiOperation({ summary: 'Atualiza um pesquisador' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiBody({ type: UpdatePesquisadoreDto })
  @ZodResponse({ status: 200, type: PesquisadorResponseDto })
  @ApiBadRequestResponse({ description: 'ID ou dados inválidos para atualização do pesquisador.' })
  @ApiNotFoundResponse({ description: 'Pesquisador não encontrado.' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updatePesquisadoreDto: UpdatePesquisadoreDto,
  ) {
    return this.pesquisadoresService.update(id, updatePesquisadoreDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove um pesquisador' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ZodResponse({ status: 200, type: PesquisadorResponseDto })
  @ApiBadRequestResponse({ description: 'ID do pesquisador inválido.' })
  @ApiNotFoundResponse({ description: 'Pesquisador não encontrado.' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.pesquisadoresService.remove(id);
  }
}
