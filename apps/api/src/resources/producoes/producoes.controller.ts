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
import { ProducoesService } from './producoes.service';
import { CreateProducoeDto } from './dto/create-producoe.dto';
import { UpdateProducoeDto } from './dto/update-producoe.dto';
import { FindAllProducoesDto } from './dto/find-all-producoes.dto';
import {
  PaginatedProducaoResponseDto,
  ProducaoResponseDto,
} from './dto/response-producoes.dto';
import { AiAccessGuard } from '@/common/rate-limit/ai-access.guard';

@ApiTags('producoes')
@Controller('producoes')
export class ProducoesController {
  constructor(private readonly producoesService: ProducoesService) {}

  @Post()
  @ApiOperation({ summary: 'Cria uma produção' })
  @ApiBody({ type: CreateProducoeDto })
  @ZodResponse({ status: 201, type: ProducaoResponseDto })
  @ApiBadRequestResponse({ description: 'Dados inválidos para criação da produção.' })
  create(@Body() createProducoeDto: CreateProducoeDto) {
    return this.producoesService.create(createProducoeDto);
  }

  @Get()
  @UseGuards(AiAccessGuard)
  @ApiOperation({
    summary: 'Lista produções',
    description: 'A busca padrão em q (ou titulo) pesquisa sempre título e resumo. Texto comum exige todos os termos, em qualquer ordem. Reconhece AND, OR, NOT (maiúsculos) e frases entre aspas. Precedência: NOT, AND, OR; parênteses alteram a ordem e termos adjacentes usam AND. Ignora caixa e acentos, sem expansão por radical ou prefixo. Buscas aceitam até 500 caracteres e 32 termos/frases; expressões aceitam cinco níveis de parênteses e size de 1 a 100, exigindo termo positivo em cada alternativa de OR. modoBusca=semantica mantém a busca por IA.',
  })
  @ApiQuery({ name: 'q', required: false, type: String, example: 'fisica AND plasma' })
  @ApiQuery({ name: 'modoBusca', required: false, enum: ['textual', 'semantica'] })
  @ApiBadRequestResponse({ description: 'Expressão booleana, filtros ou paginação inválidos.' })
  @ZodResponse({ status: 200, type: PaginatedProducaoResponseDto })
  findAll(@Query() query: FindAllProducoesDto) {
    return this.producoesService.findAll(query);
  }

  @Get('busca-semantica')
  @UseGuards(AiAccessGuard)
  @ApiOperation({ summary: 'Busca produções semanticamente (compatibilidade)', deprecated: true })
  @ApiQuery({ name: 'q', required: true, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'size', required: false, type: Number })
  @ZodResponse({ status: 200, type: PaginatedProducaoResponseDto })
  buscaSemantica(@Query() query: FindAllProducoesDto) {
    return this.producoesService.findAll({ ...query, modoBusca: 'semantica' });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Busca uma produção pelo ID' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ZodResponse({ status: 200, type: ProducaoResponseDto })
  @ApiBadRequestResponse({ description: 'ID da produção inválido.' })
  @ApiNotFoundResponse({ description: 'Produção não encontrada.' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.producoesService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualiza uma produção' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiBody({ type: UpdateProducoeDto })
  @ZodResponse({ status: 200, type: ProducaoResponseDto })
  @ApiBadRequestResponse({ description: 'ID ou dados inválidos para atualização da produção.' })
  @ApiNotFoundResponse({ description: 'Produção não encontrada.' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateProducoeDto: UpdateProducoeDto,
  ) {
    return this.producoesService.update(id, updateProducoeDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove uma produção' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ZodResponse({ status: 200, type: ProducaoResponseDto })
  @ApiBadRequestResponse({ description: 'ID da produção inválido.' })
  @ApiNotFoundResponse({ description: 'Produção não encontrada.' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.producoesService.remove(id);
  }
}
