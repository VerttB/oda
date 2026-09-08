import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
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
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { ZodResponse, ZodSerializerDto } from 'nestjs-zod';
import { AreaConhecimentoDetalheResponseSchema } from '@oda/shared-types';
import { AreaConhecimentoService } from './area-conhecimento.service';
import { CreateAreaConhecimentoDto } from './dto/create-area-conhecimento.dto';
import { UpdateAreaConhecimentoDto } from './dto/update-area-conhecimento.dto';
import { FindAllAreaConhecimentoDto } from './dto/find-all-area-conhecimento.dto';
import {
  AreaConhecimentoDetalheResponseDto,
  AreaConhecimentoResponseDto,
  PaginatedAreaConhecimentoResponseDto,
} from './dto/response-area-conhecimento.dto';

@ApiTags('area-conhecimento')
@Controller('area-conhecimento')
export class AreaConhecimentoController {
  constructor(private readonly areaConhecimentoService: AreaConhecimentoService) {}

  @Post()
  @ApiOperation({ summary: 'Cria uma área de conhecimento' })
  @ApiBody({ type: CreateAreaConhecimentoDto })
  @ZodResponse({ status: 201, type: AreaConhecimentoResponseDto })
  @ApiBadRequestResponse({ description: 'Dados inválidos para criação da área de conhecimento.' })
  create(@Body() createAreaConhecimentoDto: CreateAreaConhecimentoDto) {
    return this.areaConhecimentoService.create(createAreaConhecimentoDto);
  }

  @Get()
  @ApiOperation({ summary: 'Lista áreas de conhecimento' })
  @ZodResponse({ status: 200, type: PaginatedAreaConhecimentoResponseDto })
  findAll(@Query() query: FindAllAreaConhecimentoDto) {
    return this.areaConhecimentoService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Busca uma área de conhecimento pelo ID' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiOkResponse({
    schema: {
      nullable: true,
      allOf: [{ $ref: getSchemaPath(AreaConhecimentoDetalheResponseDto) }],
    },
  })
  @ZodSerializerDto(AreaConhecimentoDetalheResponseSchema.nullable())
  @ApiBadRequestResponse({ description: 'ID da área de conhecimento inválido.' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.areaConhecimentoService.findById(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualiza uma área de conhecimento' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiBody({ type: UpdateAreaConhecimentoDto })
  @ZodResponse({ status: 200, type: AreaConhecimentoResponseDto })
  @ApiBadRequestResponse({ description: 'ID ou dados inválidos para atualização da área de conhecimento.' })
  @ApiNotFoundResponse({ description: 'Área de conhecimento não encontrada.' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateAreaConhecimentoDto: UpdateAreaConhecimentoDto,
  ) {
    return this.areaConhecimentoService.update(id, updateAreaConhecimentoDto);
  }
}
