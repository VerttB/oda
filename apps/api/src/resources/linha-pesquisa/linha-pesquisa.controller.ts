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
import { LinhaPesquisaService } from './linha-pesquisa.service';
import { FindAllLinhaPesquisaDto } from './dto/find-all-linha-pesquisa.dto';
import { CreateLinhaPesquisaDto } from './dto/create-linha-pesquisa.dto';
import { UpdateLinhaPesquisaDto } from './dto/update-linha-pesquisa.dto';
import {
  LinhaPesquisaResponseDto,
  PaginatedLinhaPesquisaResponseDto,
} from './dto/response-linha-pesquisa.dto';

@ApiTags('linha-pesquisa')
@Controller('linha-pesquisa')
export class LinhaPesquisaController {
  constructor(private readonly linhaPesquisaService: LinhaPesquisaService) {}

  @Post()
  @ApiOperation({ summary: 'Cria uma linha de pesquisa' })
  @ApiBody({ type: CreateLinhaPesquisaDto })
  @ZodResponse({ status: 201, type: LinhaPesquisaResponseDto })
  @ApiBadRequestResponse({ description: 'Dados inválidos para criação da linha de pesquisa.' })
  create(@Body() createLinhaPesquisaDto: CreateLinhaPesquisaDto) {
    return this.linhaPesquisaService.create(createLinhaPesquisaDto);
  }

  @Get()
  @ApiOperation({ summary: 'Lista linhas de pesquisa' })
  @ZodResponse({ status: 200, type: PaginatedLinhaPesquisaResponseDto })
  findAll(@Query() query: FindAllLinhaPesquisaDto) {
    return this.linhaPesquisaService.findAll(query);
  }

  @Get('busca-semantica')
  @ApiOperation({ summary: 'Busca linhas de pesquisa por similaridade semântica' })
  @ApiQuery({ name: 'q', type: String, required: true })
  @ApiQuery({ name: 'page', type: Number, required: false })
  @ApiQuery({ name: 'size', type: Number, required: false })
  @ZodResponse({ status: 200, type: PaginatedLinhaPesquisaResponseDto })
  buscaSemantica(
    @Query('q') query: string, 
    @Query('page') page?: number, 
    @Query('size') size?: number
  ) {
    return this.linhaPesquisaService.buscaSemantica(query, page, size);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Busca uma linha de pesquisa pelo ID' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ZodResponse({ status: 200, type: LinhaPesquisaResponseDto })
  @ApiBadRequestResponse({ description: 'ID da linha de pesquisa inválido.' })
  @ApiNotFoundResponse({ description: 'Linha de pesquisa não encontrada.' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.linhaPesquisaService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualiza uma linha de pesquisa' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiBody({ type: UpdateLinhaPesquisaDto })
  @ZodResponse({ status: 200, type: LinhaPesquisaResponseDto })
  @ApiBadRequestResponse({ description: 'ID ou dados inválidos para atualização da linha de pesquisa.' })
  @ApiNotFoundResponse({ description: 'Linha de pesquisa não encontrada.' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateLinhaPesquisaDto: UpdateLinhaPesquisaDto,
  ) {
    return this.linhaPesquisaService.update(id, updateLinhaPesquisaDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove uma linha de pesquisa' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ZodResponse({ status: 200, type: LinhaPesquisaResponseDto })
  @ApiBadRequestResponse({ description: 'ID da linha de pesquisa inválido.' })
  @ApiNotFoundResponse({ description: 'Linha de pesquisa não encontrada.' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.linhaPesquisaService.remove(id);
  }
}
