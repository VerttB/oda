import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Put,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { createZodDto, ZodResponse } from 'nestjs-zod';
import {
  ProducoesConfirmadasQuerySchema,
  ProducoesConfirmadasResponseSchema,
  RevisaoProducaoGrupoResponseSchema,
  RevisarProducaoGrupoSchema,
} from '@oda/shared-types';
import { FilasJwtAuthGuard } from '../filas/filas-auth.guard';
import { ProducoesGrupoService } from './producoes-grupo.service';

class ListQueryDto extends createZodDto(ProducoesConfirmadasQuerySchema) {}
class ListResponseDto extends createZodDto(
  ProducoesConfirmadasResponseSchema,
) {}
class ReviewDto extends createZodDto(RevisarProducaoGrupoSchema) {}
class ReviewResponseDto extends createZodDto(
  RevisaoProducaoGrupoResponseSchema,
) {}

@ApiTags('grupos-pesquisa')
@Controller('grupos-pesquisa/:grupoId/producoes-confirmadas')
export class ProducoesConfirmadasController {
  constructor(private readonly service: ProducoesGrupoService) {}

  @Get()
  @ApiOperation({
    summary:
      'Lista produções atribuídas ao grupo mediante revisão administrativa',
  })
  @ZodResponse({ status: 200, type: ListResponseDto })
  list(
    @Param('grupoId', ParseUUIDPipe) grupoId: string,
    @Query() query: ListQueryDto,
  ) {
    return this.service.listConfirmed(grupoId, query);
  }
}

@ApiTags('admin-producoes-grupo')
@ApiBearerAuth()
@UseGuards(FilasJwtAuthGuard)
@Controller('admin/grupos-pesquisa/:grupoId/producoes/:producaoId/revisao')
export class RevisaoProducoesGrupoController {
  constructor(private readonly service: ProducoesGrupoService) {}

  @Get()
  @ApiOperation({
    summary: 'Consulta a decisão atual e a versão esperada para revisão',
  })
  @ZodResponse({ status: 200, type: ReviewResponseDto })
  latest(
    @Param('grupoId', ParseUUIDPipe) grupoId: string,
    @Param('producaoId', ParseUUIDPipe) producaoId: string,
  ) {
    return this.service.latest(grupoId, producaoId);
  }

  @Put()
  @ApiOperation({
    summary:
      'Registra uma decisão administrativa com justificativa e histórico',
  })
  @ApiConflictResponse({
    description: 'A versão da revisão mudou desde a consulta.',
  })
  @ZodResponse({ status: 200, type: ReviewResponseDto })
  review(
    @Param('grupoId', ParseUUIDPipe) grupoId: string,
    @Param('producaoId', ParseUUIDPipe) producaoId: string,
    @Body() input: ReviewDto,
    @Req() request: Request & { user?: { username?: string; userId?: string } },
  ) {
    const revisor = request.user?.username || request.user?.userId;
    if (!revisor)
      throw new UnauthorizedException('Identidade do revisor indisponível.');
    return this.service.review(grupoId, producaoId, input, revisor);
  }
}
