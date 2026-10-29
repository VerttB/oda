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
import { LinhaPesquisaService } from './linha-pesquisa.service';
import { FindAllLinhaPesquisaDto } from './dto/find-all-linha-pesquisa.dto';
import { CreateLinhaPesquisaDto } from './dto/create-linha-pesquisa.dto';
import { UpdateLinhaPesquisaDto } from './dto/update-linha-pesquisa.dto';
import {
  LinhaPesquisaResponseDto,
  PaginatedLinhaPesquisaResponseDto,
} from './dto/response-linha-pesquisa.dto';
import { AiAccessGuard } from '@/common/rate-limit/ai-access.guard';

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
  @UseGuards(AiAccessGuard)
  @ApiOperation({ summary: 'Lista linhas de pesquisa' })
  @ApiQuery({ name: 'q', required: false, type: String, example: 'bioinformática aplicada a doenças tropicais' })
  @ApiQuery({ name: 'modoBusca', required: false, enum: ['textual', 'semantica'] })
  @ZodResponse({ status: 200, type: PaginatedLinhaPesquisaResponseDto })
  findAll(@Query() query: FindAllLinhaPesquisaDto) {
    return this.linhaPesquisaService.findAll(query);
  }

  @Get('busca-semantica')
  @UseGuards(AiAccessGuard)
  @ApiOperation({ summary: 'Busca linhas de pesquisa semanticamente (compatibilidade)', deprecated: true })
  @ApiQuery({ name: 'q', required: true, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'size', required: false, type: Number })
  @ZodResponse({ status: 200, type: PaginatedLinhaPesquisaResponseDto })
  buscaSemantica(@Query() query: FindAllLinhaPesquisaDto) {
    return this.linhaPesquisaService.findAll({ ...query, modoBusca: 'semantica' });
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
