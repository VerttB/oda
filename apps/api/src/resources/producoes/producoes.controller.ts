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
import { ProducoesService } from './producoes.service';
import { CreateProducoeDto } from './dto/create-producoe.dto';
import { UpdateProducoeDto } from './dto/update-producoe.dto';
import { FindAllProducoesDto } from './dto/find-all-producoes.dto';
import {
  PaginatedProducaoResponseDto,
  ProducaoResponseDto,
} from './dto/response-producoes.dto';

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
  @ApiOperation({ summary: 'Lista produções' })
  @ZodResponse({ status: 200, type: PaginatedProducaoResponseDto })
  findAll(@Query() query: FindAllProducoesDto) {
    return this.producoesService.findAll(query);
  }

  @Get('busca-semantica')
  @ApiOperation({ summary: 'Busca produções por similaridade semântica' })
  @ApiQuery({ name: 'q', type: String, required: true })
  @ApiQuery({ name: 'page', type: Number, required: false })
  @ApiQuery({ name: 'size', type: Number, required: false })
  @ZodResponse({ status: 200, type: PaginatedProducaoResponseDto })
  buscaSemantica(
    @Query('q') query: string, 
    @Query('page') page?: number, 
    @Query('size') size?: number
  ) {
    return this.producoesService.buscaSemantica(query, page, size);
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
