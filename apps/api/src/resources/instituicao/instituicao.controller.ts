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
  ApiTags,
} from '@nestjs/swagger';
import { ZodResponse } from 'nestjs-zod';
import { InstituicaoService } from './instituicao.service';
import { CreateInstituicaoDto } from './dto/create-instituicao.dto';
import { UpdateInstituicaoDto } from './dto/update-instituicao.dto';
import { FindAllInstituicaoDto } from './dto/find-all-instituicao.dto';
import {
  InstituicaoResponseDto,
  InstituicaoResumoResponseDto,
  PaginatedInstituicaoResponseDto,
} from './dto/response-instituicao.dto';

@ApiTags('instituicao')
@Controller('instituicao')
export class InstituicaoController {
  constructor(private readonly instituicaoService: InstituicaoService) {}

  @Post()
  @ApiOperation({ summary: 'Cria uma instituição' })
  @ApiBody({ type: CreateInstituicaoDto })
  @ZodResponse({ status: 201, type: InstituicaoResponseDto })
  @ApiBadRequestResponse({ description: 'Dados inválidos para criação da instituição.' })
  create(@Body() createInstituicaoDto: CreateInstituicaoDto) {
    return this.instituicaoService.create(createInstituicaoDto);
  }

  @Get()
  @ApiOperation({ summary: 'Lista instituições' })
  @ZodResponse({ status: 200, type: PaginatedInstituicaoResponseDto })
  findAll(@Query() query: FindAllInstituicaoDto) {
    return this.instituicaoService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Busca uma instituição pelo ID' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ZodResponse({ status: 200, type: InstituicaoResponseDto })
  @ApiBadRequestResponse({ description: 'ID da instituição inválido.' })
  @ApiNotFoundResponse({ description: 'Instituição não encontrada.' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.instituicaoService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualiza uma instituição' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiBody({ type: UpdateInstituicaoDto })
  @ZodResponse({ status: 200, type: InstituicaoResponseDto })
  @ApiBadRequestResponse({ description: 'ID ou dados inválidos para atualização da instituição.' })
  @ApiNotFoundResponse({ description: 'Instituição não encontrada.' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateInstituicaoDto: UpdateInstituicaoDto,
  ) {
    return this.instituicaoService.update(id, updateInstituicaoDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove uma instituição' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ZodResponse({ status: 200, type: InstituicaoResumoResponseDto })
  @ApiBadRequestResponse({ description: 'ID da instituição inválido.' })
  @ApiNotFoundResponse({ description: 'Instituição não encontrada.' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.instituicaoService.remove(id);
  }
}
